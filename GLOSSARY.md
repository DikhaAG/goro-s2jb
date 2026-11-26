# GORO S2JB Domain Glossary

Sistem komando pengelolaan, triase OCR, dan pelaporan bukti ulasan rating pelanggan aplikasi PLN Mobile di lingkungan PLN UID S2JB.

## Language

### Pengumpulan Eviden (Field Intake)

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

### Telemetri & Kesehatan Sistem

**Telemetri Sistem**:
Pengukuran langsung status layanan inti, antrean pemrosesan, pengunduhan eviden eksternal, dan kinerja mesin visi di seluruh proses aplikasi.
_Avoid_: Log saja, metrik mentah, monitoring UI

**Peringatan Anomali**:
Sinyal gangguan operasional hasil evaluasi Telemetri Sistem yang memisahkan detail teknis bagi administrator dari ringkasan aman bagi operator.
_Avoid_: Error log, notifikasi umum, status kesehatan mentah



