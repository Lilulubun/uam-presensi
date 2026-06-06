# Izin & Tidak Masuk — Design Spec

## 1. Ringkasan

Fitur izin memungkinkan pengajar mengajukan ketidakhadiran untuk rentang hari tertentu.
Pengurus menyetujui/menolak pengajuan. Status akhir per hari per TPA menjadi:
**Hadir** (scan_in), **Izin** (approved izin mencakup tanggal tsb), atau **Tidak Masuk**
(tidak scan & tidak ada approved izin). Izin retroaktif diperbolehkan — status
"Izin" menggantikan "Tidak Masuk" otomatis melalui query.

## 2. Perubahan Database

### 2a. Enforce satu TPA per pengajar

Tambahkan unique constraint pada `user_id` di tabel `pengajar_tpa`:

```sql
create unique index if not exists idx_pengajar_tpa_one_per_user on public.pengajar_tpa (user_id);
```

**Efek**: `assign_pengajar_to_tpa` akan error jika user sudah punya TPA —
pengurus harus unassign dulu sebelum assign ke TPA baru.

### 2b. Tabel `izin_requests`

```sql
create type public.izin_status as enum ('pending', 'approved', 'rejected');

create table if not exists public.izin_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  alasan text not null,
  status public.izin_status not null default 'pending',
  reviewed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint izin_dates_check check (end_date >= start_date)
);

create index if not exists idx_izin_requests_user_date
  on public.izin_requests (user_id, start_date, end_date);
```

### 2c. RPC baru

| RPC | Parameter | Deskripsi |
|---|---|---|
| `submit_izin(p_start_date, p_end_date, p_alasan)` | date, date, text | Insert izin_request status pending, user_id = auth.uid() |
| `approve_izin(p_izin_id)` | uuid | Set status = 'approved', reviewed_by, reviewed_at |
| `reject_izin(p_izin_id)` | uuid | Set status = 'rejected', reviewed_by, reviewed_at |
| `get_pending_izins()` | — | SELECT all izin_requests dg status = 'pending', JOIN users utk nama |
| `get_my_izins()` | — | SELECT izin_requests milik auth.uid() |
| `get_teacher_monthly_report(p_user_id, p_year, p_month)` | uuid, int, int | Per-hari: hadir/izin/tidak_masuk (lihat 2d) |

### 2d. RPC `get_teacher_monthly_report` — logika

Untuk setiap hari dalam bulan tsb:
1. Cari sesi di TPA milik user (via `pengajar_tpa`) yg `date_opened` = hari tsb
2. Jika ada sesi:
   - Cek attendances: apakah user punya scan_in? → **Hadir**
   - Jika tidak: cek izin_requests approved yg mencakup hari tsb → **Izin**
   - Jika tidak: → **Tidak Masuk**
3. Jika tidak ada sesi: skip (tidak perlu dicatat)

## 3. Perubahan Frontend

### 3a. Store baru: `izinStore.ts`

```
state:
  myIzins: IzinRequest[]       // izin milik pengajar yg login
  pendingIzins: IzinRequest[]  // semua izin pending (pengurus only)
  loading: boolean

actions:
  submitIzin(start: Date, end: Date, alasan: string): Promise<ValidationResult>
  approveIzin(id: string): Promise<ValidationResult>
  rejectIzin(id: string): Promise<ValidationResult>
  fetchMyIzins(userId: string): Promise<void>
  fetchPendingIzins(): Promise<void>

Catatan: fetchPendingIzins dipanggil ulang otomatis setelah approveIzin/rejectIzin
```

### 3b. Route baru

```
/pengajar/izin → IzinPage
```

### 3c. IzinPage (pengajar)

- Header + tombol back
- **Form ajukan izin**:
  - Input start_date, end_date (date picker native — `type="date"`)
  - Textarea alasan
  - Tombol submit
- **Riwayat izin sendiri**: tabel/list pengajuan sebelumnya (status pending/approved/rejected)
- Bisa dilihat `TeacherMonthlyReport` untuk bulan berjalan

### 3d. DashboardPengajar — tombol Izin

- Tombol "Ajukan Izin" di bawah "Scan QR Presensi"
  - Icon: `FileText`
  - variant="outline"
  - onClick → navigate `/pengajar/izin`
- Jika ada izin pending: badge kecil (lingkaran oranye) di pojok tombol

### 3e. DashboardPengurus — section Pending Izin

- Kartu/section baru di antara "Status TPA" dan "Rekap Pengajar"
- Judul: **"Izin Pending"** + count badge
- List per pengajuan:
  - Nama pengajar
  - Rentang tanggal (formatted: "5 Jun – 7 Jun 2026")
  - Alasan (truncated, bisa expand)
  - Tombol hijau "Setujui" dan tombol merah "Tolak"
- Setelah approve/reject: kartu hilang + count badge update

### 3f. DetailPengajar — TeacherMonthlyReport

- Di bawah summary cards, tambahkan tabel/bagian:
  - Per baris: tanggal, status (Hadir / Izin / Tidak Masuk)
  - Warna: hijau untuk Hadir, biru untuk Izin, merah untuk Tidak Masuk
  - Ringkasan: total hadir, izin, tidak masuk

## 4. UI/UX

Mobile-first. Layout yang didesain untuk browser HP:
- Form izin: stacked vertical, label di atas input
- Tombol aksi lebar penuh
- List pengajuan: kartu horizontal dengan status badge

Implementasi akan menggunakan skill `impeccable` untuk memastikan kualitas
UI/UX mobile.

## 5. Tidak Perlu Sinkronisasi Khusus

Status "Tidak Masuk" → "Izin" terjadi otomatis karena query RPC
`get_teacher_monthly_report` membaca real-time dari `izin_requests` + `attendances`.
Tidak ada batch job, trigger, atau cron.

## 6. Non-Goals

- Histori pindah TPA — tidak disimpan
- Notifikasi realtime saat izin di-approve — pengajar lihat di halaman riwayat izin
- Export laporan izin ke CSV — out of scope
