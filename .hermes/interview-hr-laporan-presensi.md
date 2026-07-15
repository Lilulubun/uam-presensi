# Panduan Wawancara HR Manager — Fitur Laporan Presensi UAM

> **Target**: HR Manager UII Ayo Mengajar (UAM)
> **Tanggal**: Besok pagi
> **Durasi**: 60–90 menit
> **Tujuan**: Menggali kebutuhan fitur halaman Laporan Presensi untuk prioritas pengembangan selanjutnya

---

## Konteks Aplikasi Saat Ini (Briefing Internal)

| Aspek | Kondisi Saat Ini |
|---|---|
| **URL** | `/pengurus/laporan` (hanya role `pengurus`) |
| **Tampilan** | Pivot table per TPA: baris = pengajar, kolom = tanggal |
| **Filter** | Bulan, Tahun, Tanggal Dari/Sampai, TPA |
| **Metrik** | Total kehadiran (%), Tepat Waktu, Terlambat, Alpa |
| **Status Sel** | Jam masuk/keluar, "Izin", "Tidak Masuk", "-" |
| **Ekspor** | CSV, Excel, PDF (tanpa kop surat) |
| **RPC** | `get_laporan_presensi(p_dari, p_sampai, p_tpa_ids)` |
| **Data Sources** | `sessions`, `attendances`, `users`, `tpas`, `pengajar_tpa`, `izin_requests` |
| **Belum Ada** | Approval workflow, KPI dashboard, filter semester, rekap per pengajar, histori perubahan, notifikasi, kop surat PDF |

---

## 1. Daftar Pertanyaan Wawancara (25 Pertanyaan)

### A. KPI & Target Kehadiran (4 pertanyaan)

| # | Pertanyaan | Tujuan | Contoh Jawaban Mungkin |
|---|---|---|---|
| 1 | **Apa KPI atau target kehadiran minimal yang ditetapkan UAM untuk setiap pengajar per bulan?** Apakah ada standar persentase tertentu (misal 80%, 90%)? | Menentukan threshold untuk indikator "memenuhi target" vs "tidak memenuhi target" di laporan | "Target kehadiran minimal 80% per bulan. Di bawah itu masuk kategori perlu perhatian." |
| 2 | **Apakah ada sanksi atau tindak lanjut untuk pengajar yang kehadirannya di bawah target?** Jika ya, seperti apa prosesnya? | Memahami workflow HR yang perlu didukung sistem (notifikasi otomatis, flag, eskalasi) | "Di bawah 75% dapat surat peringatan. Di bawah 50% selama 2 bulan berturut-turut bisa diberhentikan." |
| 3 | **Apakah keterlambatan juga masuk KPI tersendiri?** Misalnya maksimal 3x terlambat per bulan? | Menentukan apakah perlu metrik keterlambatan terpisah di dashboard KPI | "Iya, maksimal 3x terlambat per bulan. Lebih dari itu dipotong insentif." |
| 4 | **Apakah izin yang disetujui dihitung sebagai "absen sah" atau tetap mengurangi persentase kehadiran?** | Menentukan formula perhitungan persentase: `hadir / (total_sesi - izin_approved)` atau `hadir / total_sesi` | "Izin yang disetujui tidak mengurangi persentase. Hanya alpa dan izin ditolak yang dihitung sebagai tidak hadir." |

### B. Data yang Dilaporkan (5 pertanyaan)

| # | Pertanyaan | Tujuan | Contoh Jawaban Mungkin |
|---|---|---|---|
| 5 | **Selain data yang sudah ada (jam masuk, jam keluar, izin, tidak masuk), data apa lagi yang Ibu butuhkan dalam laporan presensi?** Misalnya: durasi mengajar, lokasi GPS, catatan sesi, nama session opener? | Mengidentifikasi kolom/field tambahan | "Kami perlu lihat durasi mengajar per sesi, supaya tahu pengajar yang sering pulang lebih awal. Juga nama pembuka sesi." |
| 6 | **Apakah perlu metrik "kehadiran tepat waktu" vs "kehadiran total" sebagai dua kolom terpisah?** Saat ini hanya ada Total (gabungan). | Menentukan granularitas metrik | "Pisah ya. Kami perlu lihat persentase yang benar-benar tepat waktu, bukan sekadar hadir." |
| 7 | **Apakah Ibu memerlukan laporan yang bisa di-breakdown per pengajar (bukan hanya per TPA)?** Misalnya: klik nama pengajar lalu lihat detail rekap bulanannya. | Menentukan apakah perlu halaman drill-down detail pengajar | "Wah, itu bagus sekali. Jadi bisa lihat satu pengajar ngajar di TPA mana saja dan rekapnya." |
| 8 | **Apakah perlu data komparatif?** Misalnya perbandingan antar TPA, antar bulan, atau trend kehadiran dari waktu ke waktu? | Menentukan apakah perlu chart/grafik tren | "Iya, kami sering bandingkan performa antar TPA. Kalau ada grafik tren per bulan lebih bagus." |
| 9 | **Bagaimana dengan data pengajar yang mengajar di lebih dari satu TPA?** Apakah perlu ditampilkan gabungan atau dipisah per TPA? | Memahami kebutuhan multi-TPA | "Perlu dua tampilan: per TPA untuk evaluasi TPA, dan per pengajar untuk evaluasi individu. Jangan digabung kehadirannya — hari yang sama di TPA berbeda dihitung dua sesi." |

### C. Format Ekspor & Kop Surat (3 pertanyaan)

| # | Pertanyaan | Tujuan | Contoh Jawaban Mungkin |
|---|---|---|---|
| 10 | **Untuk PDF yang akan dikirim ke pihak eksternal (misalnya yayasan, universitas), kop surat seperti apa yang dibutuhkan?** Apa saja elemen wajib: logo UAM, logo UII, alamat, nomor surat, tanda tangan? | Mendesain template PDF formal | "Harus ada logo UII dan UAM di header. Nama dokumen 'Laporan Presensi Bulanan', periode, nama penanggung jawab, dan tempat tanda tangan HR Manager dan Ketua." |
| 11 | **Apakah format ekspor yang ada (CSV, Excel, PDF) sudah cukup atau perlu format lain?** Misalnya: PDF yang langsung bisa print dengan layout tertentu, atau format yang compatible dengan sistem lain? | Memastikan format ekspor sesuai kebutuhan operasional | "PDF sudah cukup tapi butuh kop surat. Untuk Excel, perlu sheet 'Rekap' di depan yang merangkum semua TPA dalam satu tabel." |
| 12 | **Untuk keperluan audit atau arsip, apakah perlu fitur "export terjadwal" atau "bulk export" untuk beberapa bulan sekaligus?** | Menentukan apakah perlu batch export | "Kalau bisa ekspor satu semester langsung dalam satu PDF atau satu Excel dengan multiple sheet, sangat membantu untuk laporan ke yayasan." |

### D. Workflow Approval & Tanda Tangan (4 pertanyaan)

| # | Pertanyaan | Tujuan | Contoh Jawaban Mungkin |
|---|---|---|---|
| 13 | **Apakah laporan presensi perlu melalui proses approval sebelum dianggap "final"?** Siapa yang perlu menyetujui — HR Manager saja atau ada pihak lain? | Mendesain workflow approval | "Iya, laporan harus disetujui HR dulu. Setelah itu baru bisa di-export dengan kop surat dan tanda tangan." |
| 14 | **Apakah laporan yang sudah di-approve perlu dikunci (tidak bisa diubah datanya)?** Atau masih bisa direvisi dengan audit trail? | Menentukan mekanisme lock/revisi | "Setelah di-approve, tidak boleh diubah. Kalau ada kesalahan, harus di-unapprove dulu oleh yang menyetujui." |
| 15 | **Apakah perlu fitur tanda tangan digital di PDF laporan?** Siapa saja yang perlu menandatangani? | Menentukan integrasi e-signature | "Untuk laporan resmi ke yayasan, perlu tanda tangan HR Manager. Kalau bisa digital (misalnya upload gambar TTD), lebih praktis." |
| 16 | **Bagaimana alur approval izin saat ini mempengaruhi laporan?** Apakah izin yang masih "pending" dihitung sebagai apa di laporan sampai disetujui/ditolak? | Memahami dampak status izin terhadap perhitungan laporan | "Pending izin harusnya tetap dihitung sebagai 'Izin (Pending)' terpisah, jangan langsung dihitung alpa. Setelah approved baru jadi 'Izin'." |

### E. Frekuensi & Distribusi Pelaporan (3 pertanyaan)

| # | Pertanyaan | Tujuan | Contoh Jawaban Mungkin |
|---|---|---|---|
| 17 | **Seberapa sering Ibu membutuhkan laporan presensi?** Harian, mingguan, bulanan, per semester? | Menentukan apakah perlu scheduled report generation | "Laporan mingguan untuk monitoring internal. Bulanan untuk arsip. Per semester untuk laporan ke yayasan." |
| 18 | **Apakah laporan perlu dikirim otomatis ke pihak tertentu?** Misalnya email ke ketua yayasan setiap akhir bulan, atau WhatsApp ke koordinator TPA? | Menentukan apakah perlu scheduled delivery | "Kalau bisa kirim otomatis ke email HR setiap akhir bulan, itu sangat membantu. Tidak perlu kirim ke yang lain — HR yang distribusikan." |
| 19 | **Apakah pengajar (role `pengajar`) juga perlu melihat laporan presensinya sendiri?** Atau cukup pengurus/HR saja? | Menentukan apakah perlu halaman laporan untuk role pengajar | "Pengajar perlu lihat rekap kehadirannya sendiri, minimal yang sederhana. Supaya mereka bisa self-monitoring." |

### F. Dashboard & Ringkasan Eksekutif (3 pertanyaan)

| # | Pertanyaan | Tujuan | Contoh Jawaban Mungkin |
|---|---|---|---|
| 20 | **Apa yang Ibu ingin lihat dalam satu tampilan "ringkasan eksekutif" di dashboard laporan?** Misalnya: persentase kehadiran tertinggi/terendah, TPA dengan masalah, alert? | Mendesain dashboard summary | "Ringkasan harus ada: rata-rata kehadiran semua TPA, TPA dengan kehadiran terendah, pengajar yang perlu perhatian, dan tren vs bulan lalu." |
| 21 | **Apakah perlu alert otomatis untuk kondisi tertentu?** Misalnya: pengajar yang 3x berturut-turut tidak hadir, atau TPA yang kehadirannya di bawah threshold? | Menentukan kebutuhan notifikasi/alert system | "Iya, kalau ada pengajar yang tidak hadir 3x berturut-turut tanpa izin, saya harus dapat notifikasi." |
| 22 | **Apakah Ibu membutuhkan laporan terpisah khusus untuk izin?** Misalnya rekap izin per pengajar: berapa kali izin, alasan, status approval? | Menentukan apakah laporan izin perlu halaman sendiri | "Saat ini sudah ada halaman Riwayat Izin, tapi kurang rekap statistik. Perlu summary: total izin diajukan, disetujui, ditolak per periode." |

### G. Kebutuhan Lain / Open-Ended (3 pertanyaan)

| # | Pertanyaan | Tujuan | Contoh Jawaban Mungkin |
|---|---|---|---|
| 23 | **Apakah ada laporan yang saat ini masih dibuat manual di Excel atau kertas yang sebenarnya bisa diotomatisasi oleh sistem?** | Menemukan hidden workflow yang belum terotomatisasi | "Saya masih buat rekap insentif manual di Excel. Kalau sistem bisa hitung insentif berdasarkan kehadiran, akan sangat menghemat waktu." |
| 24 | **Jika ada satu hal yang paling membuat frustrasi dengan laporan presensi saat ini, apa itu?** | Menemukan pain point utama untuk prioritisasi | "Yang paling frustrasi: tidak bisa lihat tren dari bulan ke bulan. Harus ekspor satu-satu lalu bandingkan manual." |
| 25 | **Adakah fitur laporan presensi dari aplikasi lain yang pernah Ibu lihat dan berharap UAM juga punya?** | Menggali inspirasi dari ekspektasi pengguna | "Saya pernah lihat aplikasi HR yang ada 'attendance heatmap' seperti GitHub contribution graph. Jadi kelihatan pola ketidakhadiran per hari." |

---

## 2. Checklist Asset yang Perlu Disiapkan

### Cetak / Print

- [ ] **Screenshot halaman Laporan saat ini** (3-4 varian: dengan data, kosong, filter aktif)
  - `/pengurus/laporan` — tampilan full dengan beberapa TPA
  - Tampilan filter expanded
  - Tampilan hasil ekspor PDF (sekarang — tanpa kop)
- [ ] **Daftar TPA yang terdaftar** — 12 TPA dengan nama asli
- [ ] **Daftar pengajar sample** — nama (bisa disamarkan) dengan assignment TPA-nya
- [ ] **Print-out daftar pertanyaan ini** (lampiran di atas)

### Digital / Tampil di Layar

- [ ] **Demo aplikasi live** — buka halaman `/pengurus/laporan`
- [ ] **Contoh PDF ekspor saat ini** — tunjukkan hasil export PDF tanpa kop surat sebagai "baseline"
- [ ] **Draft mockup kertas / wireframe** — gambar kasar di kertas untuk:
  - Tampilan ringkasan eksekutif / dashboard KPI
  - Template PDF dengan kop surat yang diinginkan
  - Halaman detail per pengajar
- [ ] **Contoh kop surat UAM/UII** — jika ada format resmi dari lembaga

### Dokumen Pendukung

- [ ] **Dokumen kebijakan kehadiran UAM** — aturan tertulis tentang KPI, sanksi, target
- [ ] **Form penilaian kinerja pengajar** — apakah data presensi masuk ke form penilaian
- [ ] **Struktur organisasi HR UAM** — stakeholder terkait laporan presensi

### Alat Bantu Wawancara

- [ ] **Notebook / laptop** untuk mencatat
- [ ] **Voice recorder** (minta izin dulu) untuk transkrip
- [ ] **Sticky notes** — untuk menangkap ide spontan dan ditempel di mockup
- [ ] **Pulpen/spidol warna** — untuk menandai prioritas di mockup kertas

---

## 3. Rekomendasi Teknis Awal
*(Berdasarkan Kemungkinan Jawaban HR — untuk antisipasi, jangan dibahas detail di wawancara)*

### 3A. Tabel Database Baru

| Tabel | Trigger Scenario | Kolom Utama |
|---|---|---|
| `report_approvals` | Workflow approval laporan | `id`, `report_period_start`, `report_period_end`, `approved_by`, `approved_at`, `status`, `locked_at` |
| `report_signatures` | TTD digital | `id`, `user_id`, `signature_image_url`, `position`, `created_at` |
| `report_exports` | Audit trail ekspor | `id`, `exported_by`, `exported_at`, `format`, `period_start`, `period_end`, `tpa_ids` |
| `kpi_config` | Target kehadiran dinamis | `id`, `metric_name`, `threshold_value`, `effective_from`, `effective_to` |
| `attendance_alerts` | Alert otomatis | `id`, `user_id`, `alert_type`, `triggered_at`, `acknowledged_at` |

### 3B. Kolom Baru di Tabel Existing

| Tabel | Kolom | Trigger Scenario |
|---|---|---|
| `users` | `signature_url`, `position_title` | TTD digital & jabatan di kop surat |
| `tpas` | `report_header_config` (JSONB) | Kop surat berbeda per TPA |
| `attendances` | `duration_minutes` | Durasi mengajar per sesi |
| `izin_requests` | `report_category` | Membedakan izin sakit/dinas/pribadi |
| `sessions` | `verified_by`, `verified_at` | Verifikasi sesi sebelum laporan final |

### 3C. RPC Database Baru

| RPC | Tujuan | Parameter |
|---|---|---|
| `get_laporan_ringkasan` | Dashboard KPI | `p_dari`, `p_sampai`, `p_tpa_ids` |
| `get_laporan_per_pengajar` | Detail rekap satu pengajar | `p_user_id`, `p_dari`, `p_sampai` |
| `get_laporan_izin_summary` | Statistik izin per periode | `p_dari`, `p_sampai`, `p_tpa_ids` |
| `get_laporan_tren_bulanan` | Data tren grafik | `p_tahun`, `p_tpa_ids` |
| `approve_laporan` | Approval laporan | `p_period_start`, `p_period_end`, `p_approved_by` |
| `get_pengajar_below_threshold` | Alert KPI | `p_threshold`, `p_dari`, `p_sampai` |

### 3D. Halaman Frontend Baru / Update

| Halaman | Route | Keterangan |
|---|---|---|
| Laporan Ringkasan / Dashboard KPI | `/pengurus/laporan/ringkasan` | Grafik tren, TPA cards, alert, perbandingan |
| Detail Laporan per Pengajar | `/pengurus/laporan/pengajar/:userId` | Drill-down rekap individu |
| Laporan Izin Summary | `/pengurus/laporan/izin` | Statistik izin, pie chart |
| Laporan untuk Pengajar | `/pengajar/laporan` | Self-service rekap sendiri |
| Update LaporanPage.tsx | `/pengurus/laporan` | Filter semester, approval badge |

---

## 4. Prioritas Implementasi

### 🔴 P1 — Kritis (Harus Ada Sebelum Rilis Berikutnya)

1. **Kop Surat di Ekspor PDF** — logo UAM+UII, judul, periode, tanda tangan
2. **Ringkasan Eksekutif / Dashboard KPI** — rata-rata kehadiran, TPA terendah, total pengajar
3. **Perhitungan Izin Pending di Laporan** — pisahkan status izin pending vs approved

### 🟡 P2 — Penting (Segera Setelah P1)

4. Filter Semester (Ganjil/Genap)
5. Detail Laporan per Pengajar (Drill-Down)
6. Export Excel dengan Sheet "Rekap"
7. Grafik Tren Bulanan

### 🟢 P3 — Nice-to-Have (Bisa Ditunda)

8. Workflow Approval Laporan + Kunci Data
9. Tanda Tangan Digital di PDF
10. Halaman Laporan untuk Role Pengajar
11. Alert Otomatis
12. Attendance Heatmap
13. Export Terjadwal + Email Otomatis
14. Perbandingan Antar TPA (Comparative)

---

## Catatan Penting untuk Wawancara

- **Jangan langsung menawarkan solusi teknis** — fokus pada menggali masalah dan kebutuhan
- **Gunakan mockup kertas** sebagai alat bantu visual
- **Tanyakan "kenapa"** untuk setiap jawaban
- **Catat istilah spesifik yang digunakan HR** (misal: "insentif", "SP1", "evaluasi kinerja") — ini penting untuk naming di UI
- **Konfirmasi role dan tanggung jawab** — siapa yang approve, lihat, ekspor
- **Validasi asumsi di akhir** — rangkum dan minta konfirmasi

---

## Template Catatan Wawancara

```
Narasumber  : _________________________
Jabatan     : HR Manager UAM
Tanggal     : _________________________
Durasi      : _________________________

[ ] Pertanyaan 1-4 (KPI) — Catatan: _________________________________
[ ] Pertanyaan 5-9 (Data) — Catatan: _________________________________
[ ] Pertanyaan 10-12 (Ekspor) — Catatan: _____________________________
[ ] Pertanyaan 13-16 (Approval) — Catatan: ___________________________
[ ] Pertanyaan 17-19 (Frekuensi) — Catatan: __________________________
[ ] Pertanyaan 20-22 (Dashboard) — Catatan: __________________________
[ ] Pertanyaan 23-25 (Lain-lain) — Catatan: __________________________

Kesimpulan / Insight Utama:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

Action Items:
[ ] _______________________________________________________________
[ ] _______________________________________________________________
[ ] _______________________________________________________________
```
