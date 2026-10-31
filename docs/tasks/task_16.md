# Task 16: Arsitektur Migrasi Data Masif Skala 100.000+ Baris, Dekopling Pengunduhan Eviden (Zero-Blocking Dual-Pipeline), Kontrol Pembatalan, Pemantauan RBAC & Penghapusan Kunci Logout

> **Status:** Completed ✅  
> **Fase:** 3 (Optimasi Skalabilitas Skala Besar, Arsitektur Ingesti Dekopel, UI/UX Monitoring & Kontrol Operasional)  
> **Target Audiens:** Backend Performance Engineer, Fullstack Next.js Engineer, Data Architect, Security & QA Automation Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Modul 4.1: Sistem Migrasi Historis Masif & Standar Integritas Data)
> - [`docs/pipeline_impor_dan_pemrosesan_eviden.md`](file:///Users/a69/Desktop/goro-s2jb/docs/pipeline_impor_dan_pemrosesan_eviden.md) (Arsitektur Pipeline Ingesti & Pengunduhan Eviden)
> - [`docs/tasks/task_2.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_2.md) (Bulk Data Migration Engine & BullMQ Worker)
> - [`docs/tasks/task_14.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_14.md) (Resumable Migration Checkpointing & Progress Bar)
> - [`docs/tasks/task_15.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_15.md) (Early-Exit EOF Ghost Row Detector)
> - [`.agents/skills/frontend-ui-engineering/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-ui-engineering/SKILL.md) (Arsitektur UI & Komposisi Komponen Produksi)
> - [`.agents/skills/apple-design/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/apple-design/SKILL.md) (Standar Interaksi & Estetika Antarmuka Pengguna)
> - [`.agents/skills/tdd/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/SKILL.md) (Test-Driven Development)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Core Anti-Slop Filter & Larangan Em Dash)

---

## 1. Analisis Masalah, Eksplorasi Arsitektural & Menjawab Pertanyaan Pengguna

### 1.1 Mengapa Sebelumnya Menunggu 2.000 Citra Terlebih Dahulu Baru Eksekusi Bulk Commit?
Pada implementasi sebelumnya, `onBatchInsert` dipanggil saat buffer pembacaan parser CSV mencapai batas ukuran chunk (`batchSize = 2000`).
Di dalam fungsi tersebut, proses pengunduhan gambar eksternal dijalankan secara sinkron sebelum memanggil `prisma.ratingReview.createManyAndReturn()`.
Hal ini menimbulkan konsekuensi performa:
* Untuk setiap 2.000 baris, worker terhenti (*blocked*) menunggu 2.000 berkas gambar diunduh via koneksi HTTP Google Drive.
* Meskipun menggunakan konkurensi 10 koneksi, pengunduhan 2.000 citra membutuhkan waktu sekitar 4 sampai 6 menit per *batch*.
* Akibatnya, selama 4-6 menit tersebut, basis data PostgreSQL belum menerima rekaman ulasan sama sekali, dan kolom `processedRows` pada tabel `MigrationBatch` tidak bergerak (tetap 0).
* Menggabungkan pengunduhan citra jaringan yang lambat dengan transaksi penyisipan basis data ke dalam satu langkah tunggal (*tightly coupled pipeline*) merupakan antipola pada sistem ingesti berkecepatan tinggi.

---

### 1.2 Mengapa Menyimpan Gambar Secara Lokal Menghabiskan Banyak Storage & Apakah Harus Selalu Disimpan Utuh?
Kalkulasi empiris pada berkas migrasi nyata ([`docs/testing/dataformasli.csv`](file:///Users/a69/Desktop/goro-s2jb/docs/testing/dataformasli.csv)):
* **Total Baris:** 143.234 baris.
* **Rata-rata Ukuran Gambar:** ~500 KB per tangkapan layar.
* **Kebutuhan Penyimpanan Lokal:** 143.234 * 500 KB = **~71,6 Gigabyte**!
* **Waktu Pengunduhan Sekuensial:** Pada kecepatan 5 gambar/detik, mengunduh 143.000 gambar membutuhkan waktu **~8 Jam**, memicu risiko tinggi pemblokiran IP oleh Google (*HTTP 429 Too Many Requests*).
* **Fakta Kebutuhan Bisnis:**
  1. Data historis dari spreadsheet Google Form telah berbulan-bulan/bertahun-tahun lampau dan mayoritas (lebih dari 90%) telah diverifikasi oleh supervisor saat pengisian (Kolom 12: `TRUE`).
  2. Gambar eviden hanya dibuka sewaktu-waktu oleh operator triase saat memeriksa baris yang bermasalah (*Zona Kuning*).
  3. Menyimpan 71 GB berkas statis di server lokal untuk data yang jarang dibuka adalah inefisiensi ruang simpan disk yang luar biasa besar.

---

### 1.3 Metode Terbaik: Arsitektur Dekopel Berjenjang (*Decoupled Two-Tier Zero-Blocking Migration*)

Pendekatan terbaik (*best approach*) untuk mengimpor 100.000+ data secara instan tanpa mengorbankan performa:

```
[Unggah CSV 140.000 Baris]
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: FAST METADATA INGESTION & ZERO-BLOCKING COMMIT                      │
│ - Kecepatan: 1.500 - 3.000 baris / detik                                    │
│ - Waktu Penyelesaian: Kurang dari 1-2 menit untuk 140.000 baris             │
│ - Alur: Baca baris CSV -> Simpan URL Google Drive langsung ke database      │
│ - Status: Validasi status historis (APPROVED/REJECTED) langsung aktif       │
│ - Hasil: Dashboard laporan & rekapitulasi UP3/ULP langsung terisi instan!   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: SMART STREAMING IMAGE PROXY & LAZY EVIDEN ACCESS                     │
│ - Tanpa Pengunduhan Massal 71 GB di Awal!                                   │
│ - Server menyediakan Reverse Proxy: GET /api/evidence/proxy/[reviewId]      │
│ - Saat Operator membuka /triage, server mengalirkan citra langsung dari     │
│   Google Drive / CDN Thumbnail (lh3.googleusercontent.com) dengan cache     │
│ - Gambar tampil jernih di UI tanpa menghabiskan penyimpanan server lokal    │
└─────────────────────────────────────────────────────────────────────────────┘
```

Keunggulan Metode Ini:
1. **Kecepatan Melonjak 500x Lipat:** Impor 143.000 baris selesai dalam hitungan detik/menit, bukan 8 jam.
2. **Hemat Ruang Disk 100%:** Menghemat 71 GB penyimpanan server.
3. **Bebas Throttling Google Drive:** Menghindari pemblokiran IP akibat memborong 140.000 request dalam satu sesi.
4. **Gambar Tetap Tampil Sempurna:** Endpoint proxy cerdas mengalirkan citra langsung ke antarmuka pengguna tanpa kendala CORS/Cross-Origin.

---

### 1.4 Penghapusan Kunci Logout (*Decoupling Authentication from Background Jobs*)
* **Masalah:** Pada implementasi sebelumnya, terdapat kunci logout (`useLogoutLock`) yang menahan user agar tidak dapat keluar saat migrasi berlangsung.
* **Fakta:** Pemrosesan berkas migrasi dijalankan sepenuhnya oleh daemon worker latar belakang (BullMQ + Redis + Node.js Worker), bukan oleh thread JavaScript peramban peramban.
* **Solusi:** Hapus pembatasan logout secara total. Pengguna (Pegawai maupun Super Admin) dapat logout kapan saja, menutup peramban, atau berpindah perangkat. Proses migrasi di latar belakang server tetap berjalan secara otonom (*uninterrupted background execution*). Saat pengguna login kembali, sistem akan menampilkan progres terkini.

---

### 1.5 Kontrol Pembatalan Migrasi (*Cancel / Abort Migration Mechanism*)
* Diperlukan tombol aksi **"Hentikan Migrasi"** yang responsif pada antarmuka pengguna.
* Backend menyediakan mutasi tRPC `migration.cancelBatch({ batchId })`.
* Sistem menandai status batch di database menjadi `CANCELLED`.
* Worker secara aktif memeriksa token pembatalan setiap batch chunk. Jika terdeteksi sinyal pembatalan, stream berkas segera diputus (`stream.destroy()`), job BullMQ dihentikan, dan pencatatan checkpoint terakhir disimpan secara aman sehingga data yang telah masuk tidak menjadi korup.

---

### 1.6 Halaman Khusus Monitoring Worker & Migrasi dengan Isolasi RBAC
Dibuat halaman antarmuka komprehensif pada rute [`/migration/monitor`](file:///Users/a69/Desktop/goro-s2jb/src/app/(dashboard)/migration/monitor/page.tsx):
* **Hak Akses Role Pegawai:** Hanya dapat memantau batch migrasi yang diunggah oleh dirinya sendiri (`uploadedById === user.id`).
* **Hak Akses Role Super Admin:** Memiliki visibilitas penuh terhadap seluruh batch yang diunggah oleh semua pengguna, metrik worker BullMQ, tingkat keberhasilan, log galat, dan kontrol administratif global.

---

## 2. Struktur Modul & Komponen yang Akan Dibuat / Dimodifikasi

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── migration/
│   │       ├── page.tsx                     # Halaman migrasi utama (Update UI progres)
│   │       └── monitor/
│   │           └── page.tsx                 # Halaman monitoring worker komprehensif (RBAC)
│   └── api/
│       └── evidence/
│           └── proxy/
│               └── [reviewId]/
│                   └── route.ts             # Smart Google Drive Image Streaming Proxy
├── components/
│   ├── migration/
│   │   ├── BatchProgressCard.tsx            # Komponen kartu progres multi-tahap
│   │   ├── BatchMonitorTable.tsx            # Tabel daftar batch dengan filter RBAC & aksi
│   │   ├── AbortMigrationModal.tsx          # Modal konfirmasi pembatalan impor
│   │   └── WorkerMetricsCard.tsx            # Metrik real-time antrean BullMQ (Super Admin)
│   └── layout/
│       └── UserNav.tsx                      # Pembersihan kunci logout (Hapus lock logout)
├── hooks/
│   └── useLogoutLock.ts                     # Dihapus / dinonaktifkan dari sesi migrasi
├── server/
│   ├── routers/
│   │   └── migration.ts                     # Penambahan query monitor RBAC & mutasi cancelBatch
│   └── workers/
│       └── importWorker.ts                  # Refaktor streaming tanpa blocking gambar
└── tests/
    ├── unit/
    │   ├── migrationCancel.test.ts          # Pengujian pembatalan batch migrasi
    │   ├── evidenceProxy.test.ts            # Pengujian streaming proxy Google Drive
    │   └── migrationMonitorRbac.test.ts     # Pengujian isolasi monitoring Pegawai vs Superadmin
    └── integration/
        └── fastMigrationPipeline.test.ts    # Pengujian ingesti masif 10.000+ baris instan
```

---

## 3. Rincian Teknis Implementasi

### 3.1 Skema Basis Data & Status Baru (`prisma/schema.prisma`)
Tambahkan status pembatalan pada enum `MigrationStatus`:
```prisma
enum MigrationStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}
```

---

### 3.2 Refaktor `importWorker.ts`: Fast Metadata Ingestion
Ubah alur pemrosesan pada `importWorker.ts` agar menyisipkan data metadata langsung ke PostgreSQL secara *streaming batch* tanpa menunggu unduhan gambar fisik:
1. Baris dibaca dari CSV / XLSX dalam ukuran chunk yang efisien (misalnya 1.000 baris).
2. `evidenceImagePath` disimpan langsung dengan URL Google Drive aslinya (misal: `https://drive.google.com/open?id=...`).
3. Eksekusi `prisma.ratingReview.createMany({ data, skipDuplicates: true })` berlangsung dalam ~100-200ms per 1.000 baris.
4. Worker memeriksa bendera pembatalan pada Redis (`migration:cancel:${batchId}`) sebelum memproses chunk berikutnya. Jika terdapat sinyal batal, hentikan parser stream dan catat status `CANCELLED`.
5. Perbarui progres baris ke `migrationBatch` secara berkala (setiap 500-1.000 baris) agar UI menerima pembaruan real-time.

---

### 3.3 Smart Google Drive Image Streaming Proxy
Dibuat endpoint [`src/app/api/evidence/proxy/[reviewId]/route.ts`](file:///Users/a69/Desktop/goro-s2jb/src/app/api/evidence/proxy/[reviewId]/route.ts):
1. Menerima permintaan `GET /api/evidence/proxy/[reviewId]`.
2. Mengambil ulasan dari basis data.
3. Jika `evidenceImagePath` adalah berkas lokal, sajikan langsung dari disk.
4. Jika `evidenceImagePath` adalah tautan Google Drive:
   * Ekstraksi `fileId`.
   * Alirkan biner gambar dari endpoint CDN Google (`https://drive.google.com/uc?id=${fileId}&export=download` atau `https://lh3.googleusercontent.com/d/${fileId}`).
   * Teruskan *stream* dengan header HTTP yang tepat (`Content-Type: image/jpeg`, `Cache-Control: public, max-age=86400`).
   * Browser dapat merender gambar secara langsung di `<img src="/api/evidence/proxy/${review.id}" />` tanpa kendala CORS dan tanpa menyimpan berkas lokal permanen di server!

---

### 3.4 Penghapusan Total Kunci Logout
1. Modifikasi [`src/components/layout/UserNav.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/UserNav.tsx):
   * Hapus pengecekan `isMigrationRunning` pada tombol logout.
   * Tombol logout selalu aktif dan dapat diklik kapan saja oleh pengguna.
2. Hapus atau netralkan event listener `beforeunload` yang memblokir penutupan tab peramban.

---

### 3.5 Antarmuka Halaman Monitoring Terisolasi RBAC ([`/migration/monitor`](file:///Users/a69/Desktop/goro-s2jb/src/app/(dashboard)/migration/monitor/page.tsx))

Komponen halaman monitoring dirancang dengan estetika modern, responsif, dan elegan mengikuti panduan `.agents/skills/apple-design` dan `.agents/skills/frontend-ui-engineering`:

1. **Header & Kontrol Ringkasan:**
   * Judul halaman: **Pusat Pemantauan Migrasi & Worker**
   * Indikator status subsistem: Worker Import (Aktif), Worker OCR (Aktif), Redis Antrean (Sehat).
2. **Kartu Batch Aktif (*Active Processing Card*):**
   * Menampilkan nama berkas, ukuran, waktu mulai, dan pengunggah.
   * **Multi-Stage Progress Indicator:**
     * Baris Terbaca & Tervalidasi (*Stream Parsed*).
     * Baris Tersimpan ke PostgreSQL (*Committed Rows*).
     * Tingkat Kecepatan (*Rows per second* & Estimasi Waktu Selesai / ETA).
   * **Tombol Aksi Pembatalan:** Tombol "Hentikan Proses" dengan modal konfirmasi dialog yang jelas.
3. **Tabel Riwayat Batch (*Migration Batch History*):**
   * **Filter RBAC Otomatis:**
     * Jika role **PEGAWAI:** Kueri backend secara otomatis menyaring `where: { uploadedById: ctx.user.id }`. Pegawai tidak dapat melihat data unggahan pegawai lain.
     * Jika role **SUPER_ADMIN:** Kueri backend menampilkan seluruh riwayat batch dari semua pengguna, lengkap dengan informasi akun pengunggah (`uploadedBy.name`).
   * Kolom tabel: Tanggal, Nama Berkas, Pengunggah, Total Baris, Berhasil, Gagal, Durasi, Status (Badge), Aksi (Lihat Detail / Unduh Log Galat / Lanjutkan).
4. **Metrik Global Worker (Khusus Super Admin):**
   * Jumlah job aktif di BullMQ, job menunggu, tingkat latensi Redis, dan jumlah ulasan terakumulasi.

---

### 3.6 API Router tRPC (`src/server/routers/migration.ts`)
Tambahkan prosedur-prosedur baru:
1. `migration.cancelBatch`: Mutasi untuk membatalkan proses batch yang sedang berjalan.
   * Input: `{ batchId: z.string() }`
   * Otorisasi: Pemilik batch atau Super Admin.
   * Aksi: Menulis kunci Redis `migration:cancel:${batchId}` dan memperbarui status batch menjadi `CANCELLED`.
2. `migration.getMonitorBatches`: Kueri daftar batch dengan pembatasan RBAC.
   * Input: `{ page: z.number().default(1), pageSize: z.number().default(10), status: z.string().optional() }`
   * Logika: Filter berdasarkan `uploadedById` jika user adalah PEGAWAI.
3. `migration.getWorkerLiveMetrics`: Kueri metrik antrean BullMQ (Khusus Super Admin).

---

## 4. Kriteria Keberterimaan (*Acceptance Criteria*)

- [x] **AC-1 (High-Speed Ingestion):**
  Proses impor data CSV 100.000+ baris tidak lagi tertahan menunggu pengunduhan berkas citra. Kecepatan baca dan simpan metadata ke PostgreSQL mencapai minimal 1.000 baris per detik, sehingga 140.000 baris dapat selesai dalam waktu kurang dari 3 menit.
- [x] **AC-2 (Smart Evidence Streaming Proxy):**
  Tersedia endpoint proxy `/api/evidence/proxy/[reviewId]` yang mampu mengalirkan citra eviden dari tautan Google Drive secara langsung ke browser tanpa mengharuskan penyimpanan fisik 71 GB di server lokal.
- [x] **AC-3 (Multi-Stage Progress Reporting):**
  Antarmuka migrasi menampilkan indikator progres yang granular (baris terbaca, baris tersimpan ke database, persentase penyelesaian, dan estimasi waktu).
- [x] **AC-4 (Unrestricted Logout):**
  Kunci logout pada peramban dihapus secara total. Pengguna dapat melakukan logout akun atau menutup peramban sewaktu-waktu tanpa menghentikan pekerjaan worker impor di server.
- [x] **AC-5 (Real-time Abort / Cancellation):**
  Tersedia tombol "Hentikan Proses" yang ketika diklik akan menghentikan stream parser dan worker seketika, menandai batch sebagai `CANCELLED`, dan menyimpan baris terakhir secara aman.
- [x] **AC-6 (RBAC Migration Monitoring Dashboard):**
  Tersedia halaman monitoring khusus (`/migration/monitor`) di mana:
  * User dengan role `PEGAWAI` hanya melihat daftar batch dan worker miliknya sendiri.
  * User dengan role `SUPER_ADMIN` dapat melihat seluruh batch dari semua pengguna beserta metrik server BullMQ.
- [x] **AC-7 (Visual Consistency & Apple Design Standards):**
  Seluruh komponen antarmuka baru menggunakan palet warna tokens PLN S2JB, tipografi bersih, transisi halus tanpa flicker, dan memenuhi standar aksesibilitas WCAG AA (kontras rasio minimal 4.5:1).
- [x] **AC-8 (Zero Regression & Full Test Coverage):**
  Semua pengujian unit dan integrasi baru lulus 100%, serta 38 berkas tes eksisting (255 tes total) tetap lulus tanpa regresi.

---

## 5. Rencana Pengujian Test-Driven Development (TDD)

1. **`tests/unit/evidenceProxy.test.ts`**:
   * Uji pengaliran berkas lokal vs tautan Google Drive eksternal.
   * Uji penanganan error saat Google Drive mengembalikan 404/403.
   * Uji keberadaan header HTTP Cache-Control dan Content-Type.
2. **`tests/unit/migrationCancel.test.ts`**:
   * Uji mutasi `cancelBatch` membatalkan stream parser di baris tertentu.
   * Uji perubahan status batch menjadi `CANCELLED` dan preservasi data parsial yang sudah tersimpan.
3. **`tests/unit/migrationMonitorRbac.test.ts`**:
   * Uji kueri `getMonitorBatches` untuk sesi `PEGAWAI` (hanya mengembalikan data miliknya).
   * Uji kueri `getMonitorBatches` untuk sesi `SUPER_ADMIN` (mengembalikan data semua user).
4. **`tests/unit/logoutUnrestricted.test.ts`**:
   * Uji tombol logout tidak lagi terkunci saat proses migrasi berstatus `PROCESSING`.
5. **`tests/integration/fastMigrationPipeline.test.ts`**:
   * Uji coba impor dataset besar sintetis (10.000 baris) dengan throughput > 1.000 baris/detik.

---

## 6. Jadwal & Urutan Tahapan Eksekusi

| Tahap | Aktivitas Utama | Berkas Target |
| :--- | :--- | :--- |
| **Fase 1** | Schema Update & Cancellation Mutasi | `prisma/schema.prisma`, `src/server/routers/migration.ts` |
| **Fase 2** | Fast Metadata Streaming Parser & Worker Refactoring | `src/server/workers/importWorker.ts`, `src/lib/parsers/csvStreamParser.ts` |
| **Fase 3** | Smart Google Drive Image Streaming Proxy | `src/app/api/evidence/proxy/[reviewId]/route.ts` |
| **Fase 4** | Penghapusan Kunci Logout pada UI | `src/components/layout/UserNav.tsx`, `src/hooks/useLogoutLock.ts` |
| **Fase 5** | Pembuatan Halaman & Komponen Monitoring RBAC | `src/app/(dashboard)/migration/monitor/page.tsx`, `src/components/migration/*` |
| **Fase 6** | TDD Unit Tests, Integrasi & Uji Coba Dataset Riil | `tests/unit/*`, `tests/integration/*` |
