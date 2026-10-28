### PRODUCT REQUIREMENTS DOCUMENT (PRD) 2026

**Sistem Komando Pengelolaan & Validasi Eviden Terotomatisasi (GORO)**
**Versi:** 2.2 (Local-Optimized MVP)
**Status:** Approved for Engineering Implementation
**Target Audiens:** Tim Pengembang (Full-Stack Engineers, AI/Vision Engineers, Database Architects, Data Engineers)

---

#### 1. Latar Belakang & Pernyataan Masalah

**1.1 Konteks & Alur Kerja Operasional Lama (As-Is Workflow)**

Sistem pelaporan sebelumnya mengandalkan alur kerja semi-manual multi-peran dengan tahapan sebagai berikut:

1. **Pengumpulan Data Lapangan (Intake):** Pihak lapangan menggunakan Google Form untuk mendata pelanggan yang telah memberikan ulasan dan rating pada aplikasi PLN Mobile di Google Play Store. Respon formulir ini terhubung langsung dan tertampung secara otomatis ke berkas spreadsheet (misalnya `GORO S2JB 2026 (Jawaban).xlsx`) pada lembar data mentah (*sheet* **Form Responses 1**).
2. **Validasi Manual Baris per Baris oleh Pegawai:** Pegawai membuka spreadsheet dan meninjau setiap baris data mentah satu per satu:
   * Membuka tautan Google Drive pada *Column 6 (Foto Eviden)*.
   * Mencocokkan secara visual informasi nama pengulas Play Store pada gambar tangkapan layar eviden dengan data teks di *Column 4 (Nama Pengulas Playstore)*.
   * Jika informasi cocok dan valid, pegawai memberikan tanda centang atau nilai `TRUE` secara manual pada *Column 12*. Alur ini terus diulang untuk ratusan hingga ribuan baris data baru.
3. **Penyusunan Lembar Monitoring & Laporan Manajerial:** Pegawai membuat *sheet* baru secara mandiri di dalam spreadsheet yang sama—seperti *Laporan Harian H-1*, *Laporan Harian*, dan *Laporan Bulanan*—berdasarkan data dari *Form Responses 1* sebagai instrumen monitoring realisasi entri data yang disuguhkan secara berkala kepada pihak manajer.
4. **Kendala Batas Baris & Ekspor CSV:** Seiring berjalannya operasional, akumulasi data ulasan mencapai volume masif (mencapai lebih dari 100.000 hingga 140.000+ baris data). Karena melampaui batas kemampuan olah dan stabilitas baris spreadsheet, seluruh data historis ini (*Form Responses 1*, *Laporan Harian*, *Laporan Harian H-1*, dan *Laporan Bulanan*) sengaja diekspor ke dalam beberapa berkas CSV statis terpisah.

**1.2 Titik Lemah Sistem Lama (Pain Points)**

1. **Beban Validasi Manual Pegawai:** Pegawai harus membuka tautan Google Drive pada *Column 6 (Foto Eviden)* satu per satu, membaca nama pengulas pada tangkapan layar, memverifikasinya secara visual dengan *Column 4 (Nama Pengulas Playstore)*, lalu mencentang atau memberi nilai TRUE/FALSE secara manual pada *Column 12*.
2. **Kerapuhan Pengecekan Duplikasi Teks:** Mengandalkan Timestamp (*Column 1*) dan Nama Pengulas untuk deteksi duplikasi sering memicu *false positive* atau *false negative*. "Display name" pada Play Store bersifat non-unik dan publik (hanya ada sekitar 24.500 nama unik dari 143.000+ data). Mengunci keunikan mutlak pada nama pengulas berisiko membuang data yang sebenarnya valid.
3. **Inkonsistensi Historis Target Kinerja:** Pada laporan manual (CSV/Spreadsheet), jika ada penyesuaian target harian ULP di tengah periode pada formula manual spreadsheet, hal ini berisiko menimpa dan merusak perhitungan capaian persentase kumulatif di bulan-bulan sebelumnya pada sheet *Laporan Harian* dan *Laporan Bulanan*.
4. **Izin Berkas Eksternal:** Tautan bukti (URL) di Google Drive sering mengalami kendala izin akses publik (*access denied*), yang melumpuhkan kemampuan sistem membaca data gambar secara otomatis.

---

#### 2. Objektif Strategis

1. Menggantikan peran Google Form (untuk pihak lapangan) serta Spreadsheet manual (untuk pegawai dan manajer) dengan sistem aplikasi web internal tersentralisasi.
2. Memutus masalah otorisasi URL dengan mengarahkan unggahan *Foto Eviden* secara langsung dari formulir ke **Penyimpanan Lokal (Local Storage/File System)** di dalam infrastruktur *server* aplikasi.
3. Mengotomatisasi validasi kesesuaian "Nama Pengulas" dan "Foto Eviden" menggunakan *Computer Vision (OCR)* dan logika pencocokan toleran (*Fuzzy Matching*) dengan mekanisme pengamanan triase tiga zona (*Confidence Score*) untuk menentukan nilai validasi secara otomatis (menggantikan centang manual pada *Column 12*).
4. Mengeliminasi manipulasi duplikasi data menggunakan sidik jari kriptografis gambar (*Perceptual Hashing / pHash*) dan metode penandaan aman (*soft-flagging*), menghentikan praktik penghapusan permanen dari sistem lama.
5. Mengotomatisasi kalkulasi agregasi *real-time* untuk Laporan Harian, Laporan Harian H-1, dan Laporan Bulanan bagi pihak manajerial tanpa risiko rusaknya riwayat target lampau akibat keterbatasan formula manual *spreadsheet*.

---

#### 3. Arsitektur Fundamental (Tech Stack)

* **Framework Inti:** Next.js 16 (App Router) & React 19 untuk eksekusi *rendering* berkecepatan tinggi dan optimalisasi sisi server.
* **Styling & UI Kit:** Tailwind CSS v4 dikombinasikan dengan shadcn/ui untuk antarmuka komando yang bersih dan taktis serta bergaya korporat.
* **Komunikasi Data:** tRPC v11 untuk jaminan sinkronisasi tipe data (*type-safety*) yang mutlak secara *end-to-end* antara *client* dan *server*.
* **Database & ORM:** PostgreSQL sebagai mesin basis data relasional untuk mengeliminasi batas baris *spreadsheet*, **dipasangkan secara eksklusif dengan Prisma ORM**.
* **Vision & OCR Engine:** **Layanan mikro Python (Local)** menggunakan *Tesseract OCR* atau pustaka *Computer Vision* lokal lainnya yang berjalan berdampingan (secara internal) dengan *server* utama.
* **Penyimpanan Aset (Storage):** **Local File System (Penyimpanan Lokal)** menggunakan metode *best practice* (contoh: pemisahan direktori `uploads` berdasarkan tahun/bulan/hari, dan penyajian *file statis* via rute API khusus di Next.js) untuk menyimpan *byte array* gambar.
* **Antrean Pemrosesan Latar Belakang (Background Queue):** Redis + BullMQ (untuk memproses tugas OCR asinkron dan eksekusi *batch import* CSV historis tanpa memblokir *server* utama).

---

#### 4. Modul Taktis Utama (Core Features)

**4.1 Modul Ingesti & Akuisisi Data (Garis Depan)**

* **Web Intake Engine (Formulir Internal Petugas Lapangan):** Menggantikan fungsi Google Form untuk pihak lapangan saat mendata rating pelanggan di Play Store. Input form langsung mengunggah "Foto Eviden" ke **Penyimpanan Lokal (*Local Storage*)** pada *server*. Tampilan antarmuka (*UI*) formulir dirancang adaptif dan intuitif dengan mempertahankan kesesuaian atribut data operasional lama (UP3, ULP, Nama Pengulas, Tanggal Entri, Versi PLN Mobile, dll.) yang secara otomatis terpetakan ke dalam model basis data relasional.
* **Sistem Migrasi Historis:** Fitur *drag-and-drop* untuk mengimpor fail `.csv` dan `.xlsx` secara masif (mencakup data mentah *Form Responses 1*, serta laporan monitoring *Laporan Harian H-1*, *Laporan Harian*, dan *Laporan Bulanan*).
* **Proses Impor Asinkron:** Penggunaan *queue worker* (Redis + BullMQ) untuk mem-parsing ratusan ribu baris CSV/XLSX di latar belakang (*background thread*) agar mencegah kelumpuhan memori *server* (*Out of Memory*).

**4.2 Mesin AI & Logika Probabilitas (Inti Eksekusi)**

* **Ekstraksi Teks (OCR):** Sistem memindai seluruh teks pada gambar tangkapan layar **menggunakan eksekusi Python lokal**.
* **Fuzzy Logic Matching:** Membandingkan *string* nama dari input *form* ("Nama Pengulas" / *Column 4*) dengan hasil ekstraksi teks (OCR) dari gambar.
* **Sistem Triase Zona Kepercayaan (Confidence Score):**
  * **Zona Hijau (> 90%):** Kemiripan tinggi. Sistem otomatis mencatat *Approve* (ekivalen dengan nilai `TRUE`/`1` pada *Column 12* lama) tanpa intervensi.
  * **Zona Kuning (70% - 89%):** Kemiripan moderat (buram/salah eja). Sistem menahan data dengan status `NEEDS_REVIEW` untuk intervensi manusia oleh pegawai.
  * **Zona Merah (< 70%):** Ketidaksesuaian parah. Sistem otomatis mencatat *Reject* (ekivalen dengan nilai `FALSE`/`0`) sebagai indikasi manipulasi atau salah gambar.
* **Anti-Fraud Kriptografis (pHash):** Sistem (melalui *engine* Python) menghasilkan *Perceptual Hash (pHash)* untuk setiap tangkapan layar guna mendeteksi kecurangan jika gambar yang sama persis diunggah ulang di hari yang berbeda (mengatasi masalah *Column 1/Timestamp* dari sistem lama).
* **Soft-flagging Komparatif:** Alih-alih menghapus data baru yang terindikasi duplikat, sistem menghubungkan ulasan baru tersebut ke ulasan lama yang memiliki kesamaan pHash/metadata tanpa menghapusnya, memungkinkan peninjauan lebih lanjut.

**4.3 Dasbor Operator (Human-in-the-Loop)**

* **Antarmuka Triase Pegawai:** Area kerja yang didedikasikan murni bagi pegawai untuk menyaring data yang tertahan di Zona Kuning, mengeliminasi kebutuhan membuka tautan Google Drive satu per satu.
* **Komponen Visual Vertikal/Horizontal:** Menampilkan informasi berikut dalam satu baris pandangan yang kohesif:
  1. Foto Eviden (Di-render langsung dari *Local Storage* *server*)
  2. Nama Pengulas Target (*Column 4*)
  3. Teks Hasil Ekstraksi AI
  4. Skor Kemiripan (Probabilitas)
* **Aksi Cepat:** Tombol `[Approve]` dan `[Reject]` sekali klik untuk mempercepat alur kerja manual pegawai dalam menetapkan status validasi (*Column 12*).
* **Performa UI:** Wajib menggunakan virtualisasi tabel (TanStack Virtual) untuk menjaga performa peramban (*browser*) agar tidak lumpuh (*crash*) saat merender ribuan data *pending*.

**4.4 Modul Laporan Eksekutif (Pusat Agregasi)**

* **Otomatisasi Kalkulasi (Real-time):** Menggantikan beban penyusunan manual *Laporan Harian*, *Laporan Harian H-1*, dan *Laporan Bulanan*. Sistem secara otonom mengunci dan mengakumulasikan parameter dari laporan historis tanpa risiko kerusakan target masa lalu:
  * Realisasi Harian (per ULP/UP3)
  * Target Harian & Target Kumulatif
  * Realisasi Kumulatif
  * Persentase (%) Capaian Harian & Kumulatif
  * Status Keterangan (TERCAPAI / TIDAK TERCAPAI)
* **Penyajian Khusus Manajerial:** Mereplikasi dan menyempurnakan tampilan monitoring berkala (Harian, H-1, dan Bulanan) yang sebelumnya disajikan pegawai kepada manajer.
* **Filter Rentang Waktu (Date Range):** Memungkinkan *sorting* dari tanggal 1 hingga akhir bulan berjalan (mereplikasi format Laporan Bulanan lama).
* **Ekspor Otomatis:** Fitur konversi/unduh tabel hasil filter ke dalam format `.xlsx` atau `.pdf` baku sebagai laporan resmi untuk pimpinan.

---

#### 5. Keamanan & Hak Akses (Role-Based Access Control / RBAC)

Pemisahan otorisasi keamanan berpusat pada tiga entitas utama yang merefleksikan alur kerja operasional:

* **Role PETUGAS LAPANGAN (Surveyor / Kontributor):** Hak akses hanya pada Modul 4.1 (Web Intake Engine) untuk menginput data ulasan rating pelanggan beserta unggahan foto eviden secara langsung tanpa akses ke data validasi internal maupun modul laporan manajerial.
* **Role PEGAWAI (Operator / Verifikator):** Hak akses diarahkan pada Modul 4.3 (Dasbor Operator/Triase). Entitas ini bertugas sebagai peninjau manual untuk kasus-kasus marginal di Zona Kuning dan memantau antrean data masuk, tanpa dibebani penyusunan laporan spreadsheet manual.
* **Role MANAGER (Komandan / Eksekutif):** Hak akses eksklusif untuk Modul 4.4 (Modul Laporan Eksekutif). Fokus secara murni pada pemantauan metrik, kalkulasi agregasi harian/bulanan, dan ekspor ringkasan performa tanpa terdistraksi oleh proses validasi data mentah.

---

#### 6. Strategi Eksekusi (Roadmap MVP)

Fase pertama pengembangan (*Minimum Viable Product / MVP*) WAJIB dipusatkan pada pengerjaan Modul 4.1 (Modul Ingesti & Akuisisi Data).
Sistem tidak dapat bermanuver lebih jauh sebelum titik kelemahan utama (keterbatasan I/O *spreadsheet* dan otorisasi Google Drive) diselesaikan. Tanpa adanya jalur pasokan data masuk (*Web Intake Engine* untuk pihak lapangan) dan migrasi CSV/XLSX historis yang kokoh ke *local storage*, Mesin AI (Modul 4.2) dan Dasbor Operator (Modul 4.3) bagi pegawai sama sekali tidak memiliki bahan baku intelijen operasional untuk dikalkulasi dan dirender, serta Modul Laporan Eksekutif (Modul 4.4) tidak memiliki data agregat yang valid untuk disuguhkan kepada Manager.