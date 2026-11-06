# Task 21: Visibilitas Telemetri Pemrosesan Baris per Baris Real-Time, Pengendali Zombie Lintas Platform, & Pemberdayaan Kontrol Operator Pegawai

> **Status:** Planned 📋  
> **Inisiatif:** Pengelolaan Proses Latar Belakang & Pemberdayaan Operator Pegawai  
> **Fokus Utama:** Real-time Row Telemetry, Cross-Platform Zombie Process Killer (macOS, Windows, Linux, Docker), dan Kontrol Operator Mandiri.  
> **Berkas Terkait:**
> - `src/server/services/rowTelemetryService.ts` (Baru)
> - `src/server/workers/importWorker.ts` (Pembaruan)
> - `src/server/workers/ocrWorker.ts` (Pembaruan)
> - `src/lib/processManager.ts` (Pembaruan: Windows & Docker Support)
> - `src/server/routers/systemProcesses.ts` (Pembaruan: Hak Akses PEGAWAI)
> - `src/server/routers/migration.ts` (Pembaruan: Endpoint Telemetri Baris Aktif)
> - `src/components/migration/ActiveRowProcessingCard.tsx` (Baru)
> - `src/components/migration/WorkerDetailInspector.tsx` (Pembaruan)
> - `src/app/(operator)/migration/monitor/page.tsx` (Pembaruan)
> - `src/components/layout/GlobalSidebar.tsx` (Pembaruan: Navigasi PEGAWAI)
> - `tests/unit/rowTelemetry.test.ts` (Baru)
> - `tests/unit/crossPlatformProcessManager.test.ts` (Baru)

---

## Primary Goal

Pengguna dengan peran **Pegawai (Operator)** dapat secara gamblang memantau apakah ada data yang sedang diproses baris demi baris beserta tahapan kerjanya secara real-time di halaman `/migration/monitor`, serta memiliki otoritas penuh untuk menghentikan proses latar belakang (*graceful abort*) dan membersihkan proses zombie yang memakan *resource*, baik pada lingkungan pengembangan maupun produksi di macOS, Windows, dan Linux (baik dijalankan secara native maupun via Docker).

---

## Phase 0: Penelusuran Pola & Arsitektur Kode Eksisting

> **How this serves the primary goal:** Mengidentifikasi fondasi teknis yang telah ada (Redis connection, BullMQ queue telemetry, Windows script launcher, dan struktur tRPC) agar modul baru terintegrasi secara mulus tanpa membuat duplikasi atau inkonsistensi.

### Temuan Arsitektur:
1. **Redis Klien (`src/lib/redis.ts`):** Menggunakan `ioredis` yang sudah terpasang dan siap digunakan untuk membaca/menulis state sementara baris aktif dengan masa kadaluarsa (TTL).
2. **Worker BullMQ (`src/server/workers/importWorker.ts` & `ocrWorker.ts`):** Telah mengimplementasikan mekanisme token pembatalan `migration:cancel:${id}` di Redis. Perlu penambahan publikasi state baris aktif (`migration:active_row:${batchId}`).
3. **Process Manager (`src/lib/processManager.ts`):** Menggunakan perintah Linux `ps -axo` yang saat ini gagal jika dijalankan di Windows native. Perlu percabangan deteksi platform `win32` menggunakan PowerShell CIM / `tasklist` dan `taskkill /F /T`.
4. **Otorisasi tRPC (`src/server/trpc.ts`):** Memiliki middleware `operatorProcedure` yang mengizinkan `Role.PEGAWAI` dan `Role.SUPER_ADMIN`. Rute kontrol proses di `systemProcessesRouter` perlu dialihkan dari `adminProcedure` ke `operatorProcedure`.

---

## Phase 1: Engine Telemetri Baris per Baris Real-Time di Redis

> **How this serves the primary goal:** Menyediakan saluran pencatatan data baris per baris berkecepatan tinggi di memori (Redis) agar antarmuka pengguna dapat mengetahui baris data apa yang sedang aktif diproses dan berada pada tahap pengerjaan apa, tanpa membebani disk basis data relasional.

### Langkah Rinci:
1. **Buat Modul Telemetri Baris (`src/server/services/rowTelemetryService.ts`):**
   ```typescript
   export type ProcessingStage =
     | "PARSING_STREAM"
     | "DEDUPLICATION_CHECK"
     | "DB_PERSISTING"
     | "DISPATCHING_OCR"
     | "DOWNLOADING_EVIDENCE"
     | "VISION_OCR_EXTRACTION"
     | "FUZZY_MATCHING"
     | "ANTI_FRAUD_PHASH"
     | "COMMITTING_TRIAGE";

   export interface ActiveRowTelemetry {
     batchId?: string;
     queueName: "import" | "ocr";
     jobId?: string;
     rowNumber?: number;
     totalRows?: number;
     reviewerName: string;
     unitInfo?: string;
     stage: ProcessingStage;
     stageDescription: string;
     elapsedMs: number;
     updatedAt: string;
   }
   ```
2. **Integrasi ke `importWorker.ts`:**
   - Saat membaca baris baru dari CSV/XLSX: publikasikan baris aktif ke Redis key `migration:active_row:${batchId}` dengan TTL 15 detik.
   - Perbarui tahap kerja: `PARSING_STREAM` -> `DEDUPLICATION_CHECK` -> `DB_PERSISTING` -> `DISPATCHING_OCR`.
   - Bersihkan key saat batch selesai atau dibatalkan.
3. **Integrasi ke `ocrWorker.ts`:**
   - Publikasikan status saat memproses `processOcrJob`:
     - Unduh Google Drive: `DOWNLOADING_EVIDENCE` ("Mengunduh & mengalirkan citra bukti Google Drive")
     - Ekstraksi OCR: `VISION_OCR_EXTRACTION` ("Mengekstraksi teks bukti via Rust Native Engine")
     - Pencocokan fuzzy: `FUZZY_MATCHING` ("Pencocokan nama ulasan Play Store")
     - Validasi pHash: `ANTI_FRAUD_PHASH` ("Pemeriksaan duplikasi visual perceptual hash 64-bit")
     - Penyimpanan hasil: `COMMITTING_TRIAGE` ("Menyimpan status validasi ke database")

---

## Phase 2: Pengendali Proses Lintas Platform & Pembersih Zombie (macOS, Windows, Linux, & Docker)

> **How this serves the primary goal:** Memastikan proses latar belakang (worker BullMQ, engine OCR, dan script runner) dapat diidentifikasi dan dihentikan secara tuntas di semua sistem operasi dan lingkungan kontainer tanpa menyisakan proses zombie atau thread yang menggantung.

### Langkah Rinci:
1. **Dukungan Windows Native di `src/lib/processManager.ts`:**
   - Jika `process.platform === "win32"`:
     - Gunakan PowerShell CIM query:
       `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*goro*' -or $_.CommandLine -like '*worker*' } | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json"`
     - Untuk terminasi di Windows:
       `taskkill /F /PID <pid> /T` (flag `/T` membunuh seluruh cabang *child process tree* sehingga tidak ada zombie tersisa).
2. **Pembersihan Proses Zombie di macOS & Linux:**
   - Deteksi proses dengan status zombie `Z` atau `defunct`, serta proses worker yang kehilangan induk (`PPID === 1`).
   - Eksekusi pembunuhan *process tree* / *process group* (`kill -TERM -<PID>` atau iterasi anak proses).
3. **Dukungan Lingkungan Docker:**
   - Deteksi apakah sistem berjalan di dalam kontainer Docker (`fs.existsSync('/.dockerenv')` atau `process.env.DOCKER_CONTAINER === 'true'`).
   - Jika di Docker:
     - Pasang token pembatalan Redis: `migration:cancel:*` dan `ocr:cancel:*`.
     - Panggil `job.moveToFailed()` pada job BullMQ yang berstatus aktif atau macet (*stalled*).
     - Singkirkan job yang menggantung dari antrean Redis secara aman.

---

## Phase 3: Penyelarasan Hak Akses (RBAC) & Router tRPC untuk Role PEGAWAI

> **How this serves the primary goal:** Membuka kewenangan operasional kepada pengguna dengan peran Pegawai agar mereka dapat menjalankan fungsi monitoring proses dan terminasi zombie tanpa terhalang galat `403 FORBIDDEN`.

### Langkah Rinci:
1. **Ubah Prosedur di `src/server/routers/systemProcesses.ts`:**
   - Ganti `adminProcedure` menjadi `operatorProcedure` untuk:
     - `getSystemOverview`: melihat status port layanan dan telemetri perangkat keras.
     - `getRunningProcesses`: melihat daftar proses background yang berjalan.
     - `terminateProcess`: menghentikan proses tertentu dengan catatan audit log.
     - `cleanOrphanProcesses`: membersihkan proses zombie/orphan dengan 1 tombol.
     - `restartWorker`: memulai ulang worker latar belakang yang mati.
     - `getServiceLogs`: melihat tail log berkas worker.
2. **Tambahkan Prosedur Telemetri Baris di `src/server/routers/migration.ts`:**
   - `getActiveRowTelemetry`: membaca daftar baris data yang sedang aktif diproses dari Redis (baik dari antrean import maupun OCR).
   - `abortActiveRow`: menghentikan pemrosesan baris tertentu secara aman.

---

## Phase 4: Pembaruan Antarmuka Pengguna (`/migration/monitor` & `/system-processes`)

> **How this serves the primary goal:** Memberikan representasi visual yang jelas, taktis, dan mudah dipahami oleh Pegawai mengenai data apa yang sedang diproses baris per baris dan tombol aksi penghentian darurat.

### Langkah Rinci:
1. **Komponen Baru `ActiveRowProcessingCard.tsx` di `/migration/monitor`:**
   - Menampilkan kartu indikator utama:
     - Jika ada data sedang diproses: menampilkan *Live Badge* hijau berkedip ("Sedang Memproses Baris"), nomor baris saat ini (`Baris X dari Y`), nama pengulas, unit kerja, serta *progress pill* tahap pengerjaan (misal: "Ekstraksi Teks OCR Rust Engine").
     - Jika tidak ada: menampilkan *Idle Badge* netral ("Tidak ada data yang sedang diproses di antrean").
   - Riwayat 5 baris terakhir yang baru saja selesai diproses dengan waktu eksekusi.
2. **Panel Pengendali Zombie Darurat di `/migration/monitor`:**
   - Tombol `[Hentikan Batch (Graceful Abort)]`: Membatalkan batch, mempertahankan baris yang sudah tersimpan, dan membersihkan antrean.
   - Tombol `[Sapu Bersih Proses Zombie (Clean Orphans)]`: Menghentikan seluruh proses zombie atau orphan di latar belakang.
3. **Buka Menu Sidebar "Layanan & Proses Sistem" (`GlobalSidebar.tsx`):**
   - Tambahkan `PEGAWAI` ke dalam `roles` untuk `/system-processes`.
   - Pastikan layout `RoleLayout` mengizinkan `PEGAWAI` membuka halaman `/system-processes`.

---

## Phase 5: Pengujian Otomatis (TDD Vitest & Cross-Platform Resilience Tests)

> **How this serves the primary goal:** Membuktikan melalui kode pengujian otomatis bahwa seluruh fungsi telemetri baris, terminasi proses di Windows/Unix/Docker, dan hak akses Pegawai berjalan 100% tanpa regresi.

### Rincian Pengujian:
1. `tests/unit/rowTelemetry.test.ts`:
   - Validasi pencatatan dan pembacaan state baris aktif di Redis.
   - Validasi pembersihan otomatis saat job selesai atau dibatalkan.
2. `tests/unit/crossPlatformProcessManager.test.ts`:
   - Validasi parsing proses di Windows (`tasklist`/PowerShell) dan POSIX (`ps`).
   - Validasi eksekusi sinyal pembunuhan *process tree* di Windows (`taskkill`) dan Unix.
   - Validasi proteksi agar web server dan proses vital OS tidak dapat dibunuh.
3. `tests/unit/operatorProcessAccess.test.ts`:
   - Validasi bahwa pengguna dengan role `PEGAWAI` berhasil memanggil seluruh prosedur manajemen proses.
   - Validasi audit log tercatat saat Pegawai melakukan kill/clean proses.

---

## Phase 6: Verifikasi Menyeluruh & Integrasi Docker

> **How this serves the primary goal:** Memastikan seluruh suite pengujian (56+ test files) lulus 100%, kompilasi TypeScript valid, dan sistem berjalan stabil di Docker maupun Native.

