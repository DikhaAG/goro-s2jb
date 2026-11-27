# GORO S2JB Domain Glossary

Sistem komando pengelolaan, triase OCR, dan pelaporan bukti ulasan rating pelanggan aplikasi PLN Mobile di lingkungan PLN UID S2JB.

## Language

### Pengumpulan Eviden (Field Intake)

**Pengumpulan Eviden**:
Penyerahan satu Eviden Ulasan beserta data ulasannya oleh Petugas Lapangan, yang berakhir diterima untuk Verifikasi Eviden atau ditolak dengan alasan yang jelas.
_Avoid_: Upload, intake form, input eviden

**Eviden Ulasan**:
Bukti gambar ulasan rating PLN Mobile pada Google Play Store yang dikirim petugas untuk divalidasi, mencakup baik Foto Kamera Langsung maupun Tangkapan Layar.
_Avoid_: Screenshot saja, foto mentah, lampiran

**Foto Kamera Langsung**:
Citra fisik layar perangkat pelanggan yang dipotret langsung menggunakan kamera perangkat petugas di lapangan.
_Avoid_: Foto kamera, jepretan langsung

**Tangkapan Layar**:
Berkas gambar hasil tangkapan layar (*screenshot*) yang dipilih petugas dari galeri atau penyimpanan berkas perangkat.
_Avoid_: Capture, screen, foto galeri

### Verifikasi Eviden

**Akuisisi Eviden**:
Pengambilan dan validasi format berkas **Eviden Ulasan** dari penyimpanan lokal maupun tautan eksternal Google Drive dengan pengamanan host dan pemeriksaan *magic bytes*.
_Avoid_: Downloader, proxy gambar, fetch gdrive

**Verifikasi Eviden**:
Penilaian otomatis atas Eviden Ulasan untuk mencocokkan nama pengulas, mendeteksi indikasi duplikasi, dan menetapkan kelayakan awal ke dalam tiga zona kepercayaan (Hijau, Kuning, Merah).
_Avoid_: Proses OCR saja, validasi AI, cek gambar

### Migrasi Historis

**Batch Migrasi**:
Satuan unggahan arsip spreadsheet historis beserta siklus hidup pemrosesan bertahap (*checkpoint*), deduplikasi baris, dan catatan galatnya ke dalam data ulasan.
_Avoid_: Bulk job, raw import, antrean impor mentah

### Triase & Manajemen Ulasan

**Triase Ulasan**:
Penilaian manual oleh operator atas Eviden Ulasan yang menunggu verifikasi atau perlu triase (Zona Kuning) untuk menetapkan status akhir, termasuk koreksi kuratif dan peninjauan duplikasi.
_Avoid_: Kurasi saja, approval manual, antrean triage terpisah

### Pelaporan Capaian

**Laporan Capaian**:
Perbandingan Realisasi terhadap target per ULP, subtotal UP3, dan total UID pada satu Posisi Tanggal, disajikan sebagai Laporan Harian, Laporan Bulanan, Kurva Pacing, dan KPI Eksekutif.
_Avoid_: Report service, laporan eksekutif saja, dashboard

**Posisi Tanggal**:
Satu hari kalender WIB yang menjadi acuan seluruh Laporan Capaian; bulan laporan adalah bulan yang memuat tanggal ini, dan tidak boleh melewati hari ini.
_Avoid_: Periode, asOfDate, tanggal target, year/month terpisah

**Kalender Target**:
Target harian per tanggal yang berlaku seragam untuk setiap ULP di UID; tanggal sebelum hari ini terkunci, dan nilai 0 berarti tidak ada target pada hari itu.
_Avoid_: Target config, TargetMaster, target hari kerja/akhir pekan

**Target Kumulatif**:
Jumlah Kalender Target sejak tanggal 1 bulan berjalan hingga Posisi Tanggal; selalu dihitung, tidak pernah disimpan.
_Avoid_: Target bulanan tetap, target 1100

**Realisasi**:
Jumlah ulasan berstatus disetujui (APPROVED) per ULP menurut tanggal entri, harian pada Posisi Tanggal atau kumulatif sejak tanggal 1 bulan berjalan.
_Avoid_: Capaian mentah, jumlah ulasan, entri

### Telemetri & Kesehatan Sistem

**Telemetri Sistem**:
Pengukuran langsung status layanan inti, antrean pemrosesan, pengunduhan eviden eksternal, dan kinerja mesin visi di seluruh proses aplikasi.
_Avoid_: Log saja, metrik mentah, monitoring UI

**Peringatan Anomali**:
Sinyal gangguan operasional hasil evaluasi Telemetri Sistem yang memisahkan detail teknis bagi administrator dari ringkasan aman bagi operator.
_Avoid_: Error log, notifikasi umum, status kesehatan mentah

### Keamanan Akses

**Sesi Pengguna**:
Status masuk pengguna yang dapat dicabut, dengan masa berlaku tetap per peran (7 hari untuk Petugas Lapangan, 24 jam untuk peran lain), dan berakhir saat logout atau saat akun dinonaktifkan.
_Avoid_: Token, JWT, cookie

**Penguncian Login**:
Pemblokiran sementara upaya masuk setelah 5 kegagalan untuk pasangan username+IP yang sama dalam 15 menit.
_Avoid_: Rate limit, throttle, ban



