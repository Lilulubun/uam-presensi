# Draf Pertanyaan Wawancara — Fitur Laporan Presensi UAM

**Tujuan:** Mengetahui bagaimana HR Manager ingin laporan presensi disajikan di aplikasi UAM.
**Pembanding:** File `Dashboard UAM.xlsx` (cara lama) vs Halaman Laporan di aplikasi (cara baru).
**Pewawancara:** Nawal Haq — Skripsi Sistem Informasi Monitoring Presensi Pengajar UAM.

---

## 🔰 Pengantar

Pak/Bu, saya sedang mengembangkan aplikasi presensi digital untuk UAM. Aplikasi ini nantinya akan menggantikan cara manual yang sekarang masih pakai Excel. Saya sudah melihat file `Dashboard UAM.xlsx` yang biasa Bapak/Ibu gunakan.

Dari situ saya melihat ada beberapa data yang sudah tercatat di Excel, dan ada juga fitur baru di aplikasi yang tidak ada di Excel. Saya ingin menanyakan pendapat Bapak/Ibu agar tampilan laporan di aplikasi nanti sesuai dengan kebutuhan.

---

## A. Kolom Ringkasan di Tabel Laporan

Di Excel UAM yang sekarang, untuk setiap guru dicatat:
- **Nama guru**
- **Target kehadiran** (misal 6 kali/bulan)
- **Jumlah Hadir & Tidak Hadir** per pekan
- **Persentase kehadiran** keseluruhan
- **Streak** (berapa kali berturut-turut hadir)

Di aplikasi, tabel ringkasan menampilkan kolom: **Nama | Total% | Tepat Waktu | Lambat | Alpa%**

---

### A1 — Kolom "Total%" (Persentase Kehadiran)

**Ada di Excel maupun aplikasi.**

Di Excel, persentase dihitung dari jumlah hadir dibagi target (misal 3/6 = 50%). Di aplikasi, perhitungannya: `Hadir ÷ (Total Hari − Izin) × 100%`.

| Pertanyaan | Jawaban |
|------------|---------|
| Rumus mana yang lebih sesuai menurut Bapak/Ibu? | ☐ Rumus aplikasi (Hadir dibagi total hari dikurangi izin) |
| | ☐ Rumus Excel (Hadir dibagi target) |
| | ☐ Lainnya: ______________ |

---

### A2 — Kolom "Tepat Waktu" dan "Lambat"

**Baru — tidak ada di Excel.** Aplikasi bisa menghitung berapa kali seorang guru datang tepat waktu dan berapa kali terlambat.

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah informasi "berapa kali tepat waktu" dan "berapa kali terlambat" perlu ditampilkan di laporan? | ☐ Ya, perlu |
| | ☐ Tidak perlu — cukup total kehadiran saja |
| Jika perlu, bagaimana cara menampilkannya? | ☐ Cukup angka saja (contoh: Tepat Waktu: 12, Lambat: 3) |
| | ☐ Tampilkan juga persentasenya (contoh: 80% tepat waktu) |
| | ☐ Beri warna: hijau jika ≥80%, kuning 50-79%, merah <50% |

---

### A3 — Kolom "Alpa%" (Persentase Tidak Hadir Tanpa Keterangan)

**Ada di Excel maupun aplikasi.** Di Excel ditampilkan sebagai jumlah "Tidak Hadir". Di aplikasi ditampilkan sebagai persentase merah.

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah cara menampilkan alpa sebagai persentase (contoh: 17%) sudah sesuai? | ☐ Ya, sudah sesuai |
| | ☐ Lebih baik tampilkan jumlah harinya saja (contoh: 3 hari) |
| | ☐ Tampilkan keduanya (jumlah + persentase) |
| Apakah perlu ada batas toleransi yang diberi tanda khusus? | ☐ Tidak perlu |
| | ☐ Ya, tandai merah jika alpa > 20% |
| | ☐ Ya, tandai merah jika alpa > 50% |

---

### A4 — Kolom "Izin" (Jumlah Hari Izin)

**Ada di Excel (tercatat sebagai tidak hadir dengan alasan), tetapi tidak ada kolom khusus di aplikasi.**

Di aplikasi, izin hanya muncul di sel tanggal sebagai teks "Izin" warna kuning. Tidak ada kolom yang menampilkan total hari izin per guru.

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah perlu menambahkan kolom "Izin" untuk menampilkan jumlah hari izin per guru? | ☐ Tidak perlu — cukup lihat di sel harian saja |
| | ☐ Ya, tampilkan jumlah hari izin |
| | ☐ Ya, tampilkan jumlah + persentase izin |

---

### A5 — Kolom "Target Kehadiran"

**Ada di Excel (setiap guru punya target, misal 6 atau 8 kali/bulan). Tidak ada di aplikasi.**

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah setiap guru memiliki target kehadiran per bulan? | ☐ Tidak ada target |
| | ☐ Ya, semua guru targetnya sama yaitu ______ kali/bulan |
| | ☐ Ya, target berbeda-beda tergantung TPA/guru |
| Jika ada target, apakah perlu ditampilkan sebagai kolom pembanding di laporan? | ☐ Ya, kolom target dan kolom realisasi (total %) |
| | ☐ Cukup beri warna pada Total%: hijau jika tercapai, merah jika tidak |

---

## B. Sel Harian (Matriks Tanggal)

Di laporan aplikasi, setiap guru memiliki baris dengan kolom per tanggal. Setiap sel menunjukkan:

- **Jam masuk** (contoh: 07:30) atau status **"Izin"** (kuning) atau **"Tidak Masuk"** (merah)
- **Jam keluar** (contoh: 16:00)

---

### B1 — Tampilan Jam di Sel

**Baru — tidak ada di Excel.** Excel hanya mencentang TRUE/FALSE (hadir/tidak hadir).

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah menampilkan jam masuk dan jam keluar seperti ini sudah sesuai? | ☐ Ya, jam saja sudah cukup |
| | ☐ Cukup centang hadir/tidak seperti Excel (lebih sederhana) |
| | ☐ Tampilkan jam masuk saja, tidak perlu jam keluar |
| Jika guru terlambat, bagaimana menampilkannya? | ☐ Cukup warna sel yang dibedakan (oranye) |
| | ☐ Tampilkan menit keterlambatan (contoh: 07:45 +15m) |
| | ☐ Tampilkan jam masuk saja, tanpa info terlambat |

---

### B2 — Warna Sel

**Baru — tidak ada di Excel.** Aplikasi menggunakan warna:
- **Oranye** (terlambat)
- **Kuning** (izin)
- **Merah** (tidak masuk)
- **Tanpa warna** (tepat waktu)

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah pilihan warna ini sudah sesuai? | ☐ Ya, sudah sesuai |
| | ☐ Sebaiknya beri warna hijau untuk "tepat waktu" |
| | ☐ Tidak perlu warna — cukup teks saja |
| | ☐ Lebih suka pakai ikon: ✅ tepat, ⏰ terlambat, 📝 izin, ❌ tidak masuk |

---

### B3 — Detail Izin di Sel

**Baru — tidak ada di Excel.** Saat ini sel izin hanya bertuliskan "Izin".

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah perlu informasi tambahan di sel izin? | ☐ Cukup "Izin" saja |
| | ☐ Bedakan warna: "Izin (Disetujui)" vs "Izin (Menunggu)" |
| | ☐ Tampilkan alasan izin (sakit/keluarga/dll) saat kursor diarahkan |

---

### B4 — Detail "Tidak Masuk" di Sel

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah perlu dibedakan antara "tidak masuk karena tidak ada sesi" vs "tidak masuk tanpa keterangan"? | ☐ Cukup "Tidak Masuk" saja |
| | ☐ Ya, bedakan |
| | ☐ Tidak perlu dibedakan |

---

## C. Ringkasan / Summary di Atas Tabel

**Baru — tidak ada di Excel (ringkasan hanya berupa persentase keseluruhan di pojok).**

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah perlu ringkasan di bagian atas laporan per TPA? | ☐ Tidak perlu |
| | ☐ Ya, perlu ringkasan berupa: |
| | ☐ Jumlah total guru |
| | ☐ Rata-rata kehadiran (%) |
| | ☐ Rata-rata keterlambatan (menit) |
| | ☐ Total izin bulan ini |
| | ☐ Jumlah guru yang alpa > 20% |
| Jika ada ringkasan, formatnya seperti apa? | ☐ Kartu/box (seperti dashboard) |
| | ☐ Baris total di bawah tabel |
| | ☐ Bentuk grafik mini |

---

## D. Data Lokasi GPS

**Baru — tidak ada di Excel.** Aplikasi menyimpan data GPS saat guru scan presensi.

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah data GPS perlu ditampilkan di laporan? | ☐ Tidak perlu — cukup disimpan sebagai bukti audit |
| | ☐ Ya, tampilkan status: "Di dalam area" / "Di luar area" |
| | ☐ Ya, tampilkan jarak dari TPA (meter) |
| | ☐ Ya, cukup dengan ikon 📍 hijau/merah |

---

## E. Detail Menit Keterlambatan

**Baru — tidak ada di Excel.** Aplikasi menyimpan jumlah menit keterlambatan (contoh: 15 menit) tapi tidak ditampilkan.

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah perlu menampilkan detail menit keterlambatan? | ☐ Tidak perlu — cukup jumlah hari lambat saja |
| | ☐ Ya, tampilkan rata-rata menit terlambat per guru |
| | ☐ Ya, kategorikan: 1-15 menit (ringan), 16-30 (sedang), >30 (berat) |

---

## F. Proses Persetujuan Laporan (Approval)

**Baru — tidak ada di Excel.** Excel langsung jadi tanpa approval.

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah laporan presensi perlu melewati proses persetujuan? | ☐ Tidak perlu — laporan bisa langsung dilihat kapan saja |
| | ☐ Ya, perlu disetujui oleh Pengurus/Ketua |
| | ☐ Ya, dan setelah disetujui data tidak bisa diubah lagi |

---

## G. Format Ekspor (CSV / Excel / PDF)

**Ada di Excel (ekspor manual dari Excel file). Tapi aplikasi bisa ekspor otomatis.**

### G1 — Jenis Ekspor

| Pertanyaan | Jawaban |
|------------|---------|
| Format ekspor apa yang paling sering Bapak/Ibu butuhkan? | ☐ Excel (paling penting) |
| | ☐ PDF (untuk arsip/laporan resmi) |
| | ☐ CSV (untuk diolah lanjut) |
| | ☐ Semuanya |

### G2 — Kolom di Ekspor

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah kolom di ekspor sudah sesuai? Jika ada tambahan, sebutkan. | ☐ Ya, sudah sesuai |
| | ☐ Perlu tambahan kolom: ______________ |

### G3 — Kop Surat / Header PDF

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah laporan PDF perlu dilengkapi kop surat resmi? | ☐ Tidak perlu |
| | ☐ Cukup logo UAM |
| | ☐ Perlu logo UAM + kop surat + tempat tanda tangan |

---

## H. Tampilan Halaman

### H1 — Pengelompokan TPA

| Pertanyaan | Jawaban |
|------------|---------|
| Cara manakah yang lebih mudah dibaca? | ☐ Per TPA (seperti sekarang — tabel terpisah per TPA) |
| | ☐ Semua TPA dalam satu tabel, dengan kolom "TPA" |
| | ☐ Bisa ganti-ganti antara kedua tampilan (toggle) |

### H2 — Filter

| Pertanyaan | Jawaban |
|------------|---------|
| Filter apa yang paling sering Bapak/Ibu gunakan? | ☐ Filter per TPA (sudah ada) |
| | ☐ Pilih bulan/tahun (sudah ada) |
| | ☐ Cari nama guru tertentu |
| | ☐ Lihat hanya guru yang bermasalah (alpa/terlambat) |
| | ☐ Semua filter di atas |

---

## I. Grafik dan Visualisasi

**Baru — tidak ada di Excel (tidak ada grafik, hanya tabel).**

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah perlu grafik di halaman laporan? | ☐ Tidak perlu — cukup tabel |
| | ☐ Ya, grafik batang perbandingan antar TPA |
| | ☐ Ya, grafik pie komposisi (tepat waktu/lambat/izin/alpa) |
| | ☐ Ya, grafik tren kehadiran per bulan |

---

## J. Pertanyaan Terbuka

| Pertanyaan | Jawaban |
|------------|---------|
| Selain yang sudah dibahas, adakah data atau fitur lain yang Bapak/Ibu inginkan di laporan presensi ini? | (Jawaban bebas) |
| Adakah laporan lain yang saat ini masih dibuat manual di Excel yang ingin diotomatisasi? | (Jawaban bebas) |

---

> **Terima kasih banyak atas waktu dan masukannya, Pak/Bu!** Jawaban Bapak/Ibu akan sangat membantu saya menyempurnakan aplikasi ini sesuai kebutuhan UAM.
