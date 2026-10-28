# Task 14: Pemantau Progres Interaktif Migrasi Data (/migration), Penguncian Sesi Keluar Akun & Pemulihan Migrasi Terhenti (Resumable Migration Engine)

> **Status:** Proposed / Ready for Execution 📋  
> **Fase:** 3 (Manajemen Migrasi Data Historis Masif, Interaksi UI/UX Real-Time, Keamanan Sesi & Pemulihan Bencana)  
> **Target Audiens:** Frontend UI/UX Engineer, Full-Stack Engineer, QA Automation Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Modul 4.1: Sistem Migrasi Historis Masif & Standar Integritas Data)
> - [`DESIGN.md`](file:///Users/a69/Desktop/goro-s2jb/DESIGN.md) (Modern Utility Minimalism & Aksesibilitas Kontras WCAG AA)
> - [`docs/tasks/task_2.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_2.md) (Bulk Data Migration Engine & BullMQ Worker)
> - [`docs/tasks/task_8.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_8.md) (Sistem Desain, GlobalSidebar & Navigasi Responsif)
> - [`docs/tasks/task_13.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_13.md) (Otorisasi Fitur Migrasi untuk Pegawai & Super Admin)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Core Anti-Slop Filter)
> - [`.agents/skills/antislop-ui/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-ui/SKILL.md) (Desain UI Utilitas & Komponen Status)
> - [`.agents/skills/antislop-layoutmobile/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-layoutmobile/SKILL.md) (Breakpoints Mobile & Tap Target >= 44px)
> - [`.agents/skills/antislop-human/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-human/SKILL.md) (Aksesibilitas ARIA Live & Kontras WCAG AA)
> - [`.agents/skills/working-with-spreadsheets/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/working-with-spreadsheets/SKILL.md) (Penanganan Berkas Spreadsheet Skala Besar & Checkpointing)
> - [`.agents/skills/tdd/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/SKILL.md) (Test-Driven Development)

---

## 1. Ringkasan & Latar Belakang Masalah

Pada alur operasional PLN UID S2JB, berkas impor historis (*Form Responses 1* dan rekap laporan bulanan) memiliki ukuran masif hingga lebih dari 143.000 baris. Proses pemrosesan melalui BullMQ worker dan parser streaming memerlukan waktu beberapa menit untuk menyelesaikan validasi relasi unit, deduplikasi, dan pencatatan entri ulasan ke basis data PostgreSQL.

Terdapat tiga celah kritis operasional yang perlu diselesaikan:
1. **Kekurangan Umpan Balik Visual Progres (UI/UX Slop):**
   * Antarmuka lama pada [`src/components/admin/BulkDropzone.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/admin/BulkDropzone.tsx) masih menggunakan palet gelap lama (`#0d1424`), gradien oranye-cyan generik, dan ikon generik yang tidak selaras dengan standar Modern Utility Minimalism.
   * Tidak tersedia bilah kemajuan (*progress bar*) visual dengan persentase capaian yang dinamis dan estimasi baris tersisa, sehingga pengguna tidak mengetahui sejauh mana berkas telah diproses.
2. **Risiko Pemutusan Sesi (Accidental Logout / Disconnection):**
   * Apabila pengguna menekan tombol "Keluar dari Sesi" pada [`GlobalSidebar.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/GlobalSidebar.tsx) saat proses migrasi masih berjalan (`status === "PROCESSING"`), sesi otentikasi terputus, memicu *orphaned job*, serta menghilangkan kendali pemantauan pengguna atas proses impor data.
3. **Ketiadaan Mekanisme Pemulihan Sesi Terhenti (Resumable Migration Checkpointing):**
   * Jika browser tertutup secara tiba-tiba (crash, listrik padam, tab tertutup tanpa sengaja) atau terjadi gangguan jaringan yang memutus sesi di tengah jalan, sistem saat ini belum memiliki checkpoint status baris terakhir yang tersimpan di disk.
   * Akibatnya, berkas yang baru selesai separuh (misal 50.000 dari 143.000 baris) tertahan tanpa kejelasan status, dan jika pengguna mengunggah ulang dari awal akan terjadi risiko duplikasi data atau pemborosan resource database yang sangat berat.

---

## 2. Tujuan Teknis Task 14

1. **Antarmuka Pemantau Progres Real-Time & Interaktif:**
   * Menampilkan bilah kemajuan (*Progress Bar*) bertaraf utilitas dengan transisi pengisian halus, persentase penyelesaian numerik yang akurat, serta atribut aksesibilitas lengkap (`role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-live="polite"`).
   * Menyajikan metrik taktis real-time:
     - **Baris Berhasil:** Jumlah akumulasi baris yang sukses disimpan ke basis data (format separator ribuan Indonesia `toLocaleString("id-ID")`).
     - **Baris Gagal:** Jumlah baris cacat yang diisolasi ke `MigrationErrorLog` tanpa menghentikan worker.
     - **Total Baris & Persentase:** Kalkulasi rasio baris selesai terhadap total baris berkas.
     - **Kecepatan Proses (Throughput):** Estimasi kecepatan pemrosesan (misal: `~1.850 baris/detik`) dan waktu berjalan (*elapsed time*).
2. **Penguncian Sesi Keluar Akun (*Session Logout Locking*):**
   * Selama status migrasi berada dalam fase `PROCESSING` atau `PENDING` (maupun saat berkas fisik sedang diunggah):
     - Tombol "Keluar dari Sesi" pada [`GlobalSidebar.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/GlobalSidebar.tsx) dan [`MobileNavDrawer.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/MobileNavDrawer.tsx) dinonaktifkan (*disabled*) secara visual dan fungsional.
     - Terdapat indikator gembok proteksi dan lencana peringatan: *"Sesi Terkunci: Migrasi Data Sedang Berjalan"*.
     - Jika pengguna mencoba memicu aksi keluar, sistem menampilkan modal konfirmasi taktis yang melarang pemutusan sesi hingga proses impor tuntas.
   * Perlindungan tingkat API: Endpoint `POST /api/auth/logout` menolak pembatalan sesi jika terdeteksi batch migrasi aktif milik pengguna yang sedang berjalan, kecuali diberikan parameter konfirmasi paksa (*force cancel*).
3. **Mekanisme Checkpointing & Pemulihan Migrasi Terhenti (*Resumable Migration Engine*):**
   * Menyimpan path berkas fisik (`filePath`), indeks baris terakhir yang sukses (`lastProcessedRow`), dan status ke tabel `MigrationBatch`.
   * Jika proses terhenti di tengah jalan karena browser tertutup, logout paksa, atau worker crash, status batch ditandai sebagai `PAUSED` atau `INTERRUPTED`.
   * Saat pengguna login kembali atau membuka halaman `/migration`:
     - Sistem secara proaktif mendeteksi keberadaan batch yang belum tuntas.
     - Ditampilkan kartu interaktif pemulihan migrasi (*Migration Recovery Card*) yang menyajikan ringkasan progres terakhir (misal: *"Ditemukan proses migrasi yang terhenti: 48.200 dari 143.000 baris telah selesai"*).
     - Pengguna diberikan dua tombol aksi taktis:
       1. **Lanjutkan Migrasi (*Resume*):** Melanjutkan impor mulai dari baris berikutnya (`startRowNumber = lastProcessedRow + 1`) tanpa memproses ulang data yang sudah masuk basis data.
       2. **Batalkan & Buang (*Cancel / Discard*):** Menandai batch sebagai batal dan memperbolehkan pengunggahan berkas baru.
4. **Perlindungan Penutupan Halaman (*Tab Unload Guard*):**
   * Menerapkan listener event `window.beforeunload` untuk mencegah penutupan tab atau reload browser yang tidak disengaja saat proses migrasi sedang aktif.
5. **Penyelarasan Desain Utilitas Modern (Anti-Slop Hardening):**
   * Mengganti seluruh palet gelap usang pada [`BulkDropzone.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/admin/BulkDropzone.tsx) menjadi kanvas bersih putih `#ffffff`, batas tepi lembut `#e2e8f0`, aksen primer Teal PLN `#006877` / `#00a2b9`, dan teks karbon kontras tinggi `#0f172a`.
   * Menghilangkan ikon sparkle/magic generik dan melarang penggunaan tanda baca em dash di seluruh antarmuka.

---

## 3. Struktur Sub-Task Hierarkis

* **Task 14.1:** Penyempurnaan Skema Prisma, Worker Streaming Checkpoint & Preservasi File Path
* **Task 14.2:** Prosedur Backend tRPC Pemulihan Migrasi (`getActiveOrInterruptedBatch`, `resumeMigration`, `cancelBatch`)
* **Task 14.3:** Global State & Hook Penguncian Sesi & Pemulihan (`MigrationGuardContext.tsx`, `useMigrationGuard.ts`)
* **Task 14.4:** Refaktorisasi Antarmuka Dasbor `/migration` ke Desain Utilitas, Bilah Kemajuan & Kartu Pemulihan
* **Task 14.5:** Penegakan Penguncian Logout Multi-Layer & Perlindungan Tab Browser (`beforeunload`)
* **Task 14.6:** Otomasi Pengujian TDD Unit & Integrasi (Checkpoint Offset, Resume Streaming, Deduplikasi, Logout Lock)

---

## 4. Instruksi Teknis Rinci

### 4.1 Task 14.1: Penyempurnaan Skema Prisma, Worker Streaming Checkpoint & Preservasi File Path
1. **Target Berkas:**
   * [`prisma/schema.prisma`](file:///Users/a69/Desktop/goro-s2jb/prisma/schema.prisma)
   * [`src/server/workers/importWorker.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/workers/importWorker.ts)
   * [`src/lib/parsers/csvStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/csvStreamParser.ts)
   * [`src/lib/parsers/xlsxStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/xlsxStreamParser.ts)
2. **Pembaruan Skema Basis Data (`prisma/schema.prisma`):**
   * Perluas model `MigrationBatch` untuk menyimpan path berkas dan indeks baris checkpoint:
     ```prisma
     model MigrationBatch {
       id               String          @id @default(cuid())
       fileName         String
       fileSize         Int
       filePath         String?         // Path absolut berkas pada uploads/migration/
       targetType       String          // "FORM_RESPONSES_RAW" | "HISTORICAL_REPORTS"
       totalRows        Int             @default(0)
       processedRows    Int             @default(0)
       failedRows       Int             @default(0)
       lastProcessedRow Int             @default(0)     // Checkpoint baris terakhir yang sukses
       status           MigrationStatus @default(PENDING) // PENDING, PROCESSING, PAUSED, COMPLETED, FAILED
       errorMessage     String?
       startedAt        DateTime?
       completedAt      DateTime?
       uploadedById     String?
       uploadedBy       User?           @relation(fields: [uploadedById], references: [id])
       errors           MigrationErrorLog[]
       createdAt        DateTime        @default(now())
       updatedAt        DateTime        @updatedAt
     
       @@index([status])
       @@index([uploadedById, status])
       @@index([createdAt])
     }
     ```
   * Perbarui enum `MigrationStatus` dengan menambahkan status `PAUSED` jika diperlukan.
3. **Streaming Parser Checkpointing (`startRowNumber` Option):**
   * Di dalam [`csvStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/csvStreamParser.ts) dan [`xlsxStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/xlsxStreamParser.ts), tambahkan opsi `startRowNumber?: number`.
   * Saat parser berjalan dalam mode resume:
     - Jika `currentRowNumber <= startRowNumber`, lewati baris tersebut (*fast skip*) tanpa alokasi memori objek dan tanpa memanggil `onBatch`.
     - Mulai mengumpulkan batch dan memasukkan ke basis data tepat pada baris `startRowNumber + 1`.
   * Pada setiap siklus chunk insert (`onBatchInsert`), perbarui database secara atomik:
     ```typescript
     await prisma.migrationBatch.update({
       where: { id: importBatchId },
       data: {
         processedRows: totalProcessedRows,
         lastProcessedRow: currentHighestRowNumber,
       },
     });
     ```

---

### 4.2 Task 14.2: Prosedur Backend tRPC Pemulihan Migrasi
1. **Target Berkas:**
   * [`src/server/routers/migration.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/routers/migration.ts)
2. **Prosedur Baru & Pemutakhiran Prosedur Eksisting:**
   * **`migration.startMigration`:**
     - Simpan `filePath` fisik berkas ke dalam record `MigrationBatch` saat pembuatan awal.
   * **`migration.getActiveOrInterruptedBatch` (Kueri):**
     - Mengambil batch migrasi milik pengguna (atau sistem) yang berstatus `PROCESSING`, `PENDING`, atau `PAUSED` yang belum terselesaikan.
     - Menyediakan informasi lengkap: `id`, `fileName`, `fileSize`, `totalRows`, `processedRows`, `failedRows`, `lastProcessedRow`, `status`, dan `startedAt`.
   * **`migration.resumeMigration` (Mutasi):**
     - Menerima input `{ batchId: z.string() }`.
     - Memverifikasi keberadaan berkas fisik pada disk (`fs.existsSync(batch.filePath)`).
     - Mengubah status batch menjadi `PROCESSING`.
     - Menjadwalkan job baru ke BullMQ `importQueue` dengan menyertakan parameter `startRowNumber: batch.lastProcessedRow`.
     - Mengembalikan pesan konfirmasi bahwa proses migrasi berhasil dilanjutkan dari baris terakhir.
   * **`migration.cancelBatch` (Mutasi):**
     - Menerima input `{ batchId: z.string() }`.
     - Menandai batch yang terhenti menjadi `FAILED` dengan keterangan *"Dibatalkan oleh pengguna"*.
     - Menghapus kunci antrean jika masih ada job aktif di BullMQ.

---

### 4.3 Task 14.3: Global State & Hook Penguncian Sesi & Pemulihan
1. **Target Berkas:**
   * `src/context/MigrationGuardContext.tsx`
   * `src/hooks/useMigrationGuard.ts`
2. **Spesifikasi Arsitektur State:**
   * Menyediakan state reaktif global yang memantau:
     - `isMigrationActive`: bernilai `true` jika status `PROCESSING` atau `PENDING` atau sedang upload.
     - `hasInterruptedBatch`: bernilai `true` jika ditemukan batch dengan status `PAUSED` atau `PROCESSING` tanpa worker aktif.
     - `activeBatch`: rincian batch aktif atau batch terhenti.
     - `progressPercentage`: kalkulasi persentase baris sukses terhadap total baris.
   * Mengintegrasikan auto-refetch interval tRPC (1.5 detik saat aktif, dimatikan saat tuntas).

---

### 4.4 Task 14.4: Refaktorisasi Antarmuka Dasbor `/migration` & Kartu Pemulihan (Resume Card)
1. **Target Berkas:**
   * [`src/app/(operator)/migration/page.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/app/(operator)/migration/page.tsx)
   * [`src/components/admin/BulkDropzone.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/admin/BulkDropzone.tsx)
   * `src/components/admin/InterruptedBatchRecoveryCard.tsx`
2. **Spesifikasi Visual & Kartu Pemulihan (*Recovery Card*):**
   * **Tampilan Kartu Pemulihan Sesi Terhenti (`InterruptedBatchRecoveryCard.tsx`):**
     - Jika pengguna membuka halaman dan sistem mendeteksi batch yang belum selesai:
       - Tampilkan kartu pastel semantik kuning-oranye (`bg-[#fffbeb] border border-[#fde68a] rounded-2xl p-5`).
       - Header memuat ikon `AlertCircle` (#b45309), judul tebal *"Proses Migrasi Belum Selesai Terdeteksi"*, dan waktu terhenti.
       - Rincian status: menampilkan nama berkas, ukuran, serta baris yang telah sukses diimpor (misal: `54.200 dari 143.000 baris telah tersimpan di basis data`).
       - Bilah progres mini menunjukkan posisi terakhir checkpoint.
       - Dua tombol aksi taktis:
         - **Tombol "Lanjutkan Migrasi" (Primer):** Latar `#00a2b9`, hover `#0097a7`, teks putih, min-h 44px. Memicu mutasi `resumeMigration` dan langsung menyambung streaming monitor.
         - **Tombol "Batalkan & Unggah Berkas Baru" (Sekunder):** Teks slate `#64748b`, hover bg `#f1f5f9`, min-h 44px. Menghapus sesi tertunda.
   * **Komponen Bilah Kemajuan (*Interactive Progress Bar*):**
     - Track latar belakang: `h-3 w-full bg-[#f1f5f9] rounded-full overflow-hidden border border-[#e2e8f0]`.
     - Fill bar: `h-full bg-gradient-to-r from-[#006877] to-[#00a2b9] transition-all duration-300 ease-out rounded-full`.
     - Atribut Aksesibilitas WCAG:
       `role="progressbar" aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100} aria-label="Kemajuan migrasi rekam data historis"`
     - Teks Progres Berdampingan:
       - Sisi Kiri: Nilai persentase besar tebal font Inter (contoh: `74% Selesai`).
       - Sisi Kanan: Rincian baris numerik monospaced (contoh: `105.820 dari 143.000 baris`).
   * **Grid Metrik Taktis (4 Kolom Utilitas):**
     1. **Baris Sukses:** Angka hijau tebal `#15803d` dengan latar pastel `#f0fdf4` dan border `#bbf7d0`.
     2. **Baris Gagal (Anomali):** Angka merah tebal `#b91c1c` dengan latar pastel `#fef2f2` dan border `#fecaca`.
     3. **Kecepatan Impor:** Indikator numerik kecepatan pemrosesan (misal: `1.920 baris/dtk`).
     4. **Status Worker:** Lencana status aktif dengan animasi denyut halus (*pulsing indicator*) warna teal saat aktif, hijau solid saat tuntas, merah solid saat gagal.
   * **Accordion Pratinjau Error Baris:**
     - Jika terdapat error, tampilkan ringkasan tabel error baris dengan nomor baris dan alasan validasi (misal: format tanggal tidak valid, unit ULP tidak dikenali).

---

### 4.5 Task 14.5: Penegakan Penguncian Logout Multi-Layer & Perlindungan Tab Browser
1. **Target Berkas:**
   * [`src/components/layout/GlobalSidebar.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/GlobalSidebar.tsx)
   * [`src/components/layout/MobileNavDrawer.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/MobileNavDrawer.tsx)
   * [`src/app/api/auth/logout/route.ts`](file:///Users/a69/Desktop/goro-s2jb/src/app/api/auth/logout/route.ts)
   * [`src/server/routers/auth.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/routers/auth.ts)
2. **Pencegahan di Tingkat Klien (UI Guard):**
   * Jika `isMigrationActive === true`:
     - Tombol keluar di footer sidebar diubah menjadi mode terkunci:
       ```tsx
       <button
         type="button"
         disabled={true}
         aria-disabled="true"
         className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] cursor-not-allowed opacity-80 min-h-[44px]"
       >
         <Lock className="w-4 h-4 text-[#d97706]" />
         <span>Sesi Terkunci (Migrasi Aktif)</span>
       </button>
       ```
     - Tambahkan pesan keterangan mini di bawah tombol: *"Keluar akun dinonaktifkan sementara untuk menjaga stabilitas impor data."*
3. **Pencegahan di Tingkat API & Graceful Pause pada Logout Paksa:**
   * Di dalam route handler `POST /api/auth/logout` dan mutasi tRPC `auth.logout`:
     - Periksa apakah pengguna yang meminta logout memiliki batch pada tabel `MigrationBatch` dengan status `PROCESSING` atau `PENDING`.
     - Jika ada dan tanpa parameter `force=true`: Tolak dengan respons `HTTP 423 Locked` (`{ error: "Sesi tidak dapat diakhiri saat proses migrasi data sedang berjalan." }`).
     - Jika request menyertakan `force=true` (misal konfirmasi paksa oleh pengguna): Sebelum cookie sesi dibersihkan, ubah status batch menjadi `PAUSED` dan catat `lastProcessedRow` terakhir ke database sehingga berkas tetap aman dan dapat dilanjutkan saat pengguna login kembali.
4. **Browser Native Unload Guard (`beforeunload`):**
   * Daftarkan event listener `beforeunload` saat migrasi aktif:
     ```typescript
     window.addEventListener("beforeunload", (event) => {
       event.preventDefault();
       event.returnValue = "Proses migrasi data sedang berlangsung. Menutup tab akan menghentikan pemantauan impor data.";
       return event.returnValue;
     });
     ```

---

### 4.6 Task 14.6: Otomasi Pengujian TDD Unit & Integrasi
1. **Target Berkas Pengujian:**
   * `tests/unit/migrationProgressBar.test.tsx`
   * `tests/unit/migrationLogoutLock.test.tsx`
   * `tests/unit/migrationResumableParser.test.ts`
   * `tests/integration/migrationWorkerProgress.test.ts`
   * `tests/integration/migrationResumeRecovery.test.ts`
   * `tests/integration/logoutProtectionSecurity.test.ts`
2. **Skenario Pengujian Wajib:**
   * **Test 1 (Checkpoint Fast Skip Seam):** Memverifikasi bahwa parser CSV/XLSX dengan `startRowNumber = 50000` melewati 50.000 baris pertama tanpa mengeksekusi insert ganda, dan memulai batch insert tepat pada baris 50.001.
   * **Test 2 (Resume Mutation Seam):** Memverifikasi pemanggilan `migration.resumeMigration` mengubah status batch dari `PAUSED` menjadi `PROCESSING` dan mendaftarkan job baru ke BullMQ dengan parameter offset yang benar.
   * **Test 3 (Progress Bar Calculation Seam):** Memverifikasi formula perhitungan persentase baris sukses terhadap total baris menghasilkan nilai bulat 0% s/d 100% tanpa NaN atau overflow.
   * **Test 4 (Accessible Attributes Seam):** Memverifikasi elemen progress bar memuat atribut `role="progressbar"`, `aria-valuenow`, dan `aria-live="polite"`.
   * **Test 5 (Logout Button Disabled Seam):** Memverifikasi tombol logout di `GlobalSidebar` berstatus `disabled` dan memiliki teks penanda kunci saat batch migrasi berstatus `PROCESSING`.
   * **Test 6 (Graceful Pause on Force Logout Seam):** Memverifikasi pemanggilan `POST /api/auth/logout?force=true` memperbarui status batch menjadi `PAUSED` dengan menyimpan `lastProcessedRow`.
   * **Test 7 (Anti-Slop Compliance Seam):** Memverifikasi tidak ada karakter em dash (Unicode \u2014) pada seluruh teks antarmuka dan rasio kontras warna kartu pemulihan memenuhi WCAG AA (>= 4.5:1).

---

## 5. Matriks Perilaku Sistem & Penanganan Status Sesi

| Status Migrasi | Status Tombol Logout | Perilaku Endpoint `/api/auth/logout` | Status Bilah Kemajuan (*Progress Bar*) | Tampilan Kartu Pemulihan (*Recovery Card*) | Listener `beforeunload` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **IDLE** (Belum Ada Berkas) | Aktif (Normal) | Diizinkan (`200 OK`) | Tersembunyi | Tersembunyi | Tidak Aktif |
| **UPLOADING** (Unggah Fisik) | **Terkunci (Disabled)** | Ditolak (`423 Locked`) | Menampilkan status unggah berkas | Tersembunyi | **Aktif** |
| **PENDING** (Antrean Worker) | **Terkunci (Disabled)** | Ditolak (`423 Locked`) | Menampilkan indikator antrean aktif | Tersembunyi | **Aktif** |
| **PROCESSING** (Sedang Streaming) | **Terkunci (Disabled)** | Ditolak (`423 Locked`) | **Aktif: persentase & baris sukses berjalan** | Tersembunyi | **Aktif** |
| **PAUSED / INTERRUPTED** (Terhenti) | Aktif Kembali | Diizinkan (`200 OK`) | Menampilkan posisi baris terakhir | **Aktif: Tombol "Lanjutkan Migrasi"** | Dilepas (Nonaktif) |
| **COMPLETED** (Tuntas Sukses) | Aktif Kembali | Diizinkan (`200 OK`) | Statis 100% (Hijau Sukses Solid) | Tersembunyi | Dilepas (Nonaktif) |
| **FAILED** (Gagal / Batal) | Aktif Kembali | Diizinkan (`200 OK`) | Statis Merah (Laporan Error Siap Unduh) | Tersembunyi (Opsi upload ulang) | Dilepas (Nonaktif) |

---

## 6. Kriteria Keberhasilan & Verifikasi Penerimaan

- [x] Path berkas fisik (`filePath`) dan baris checkpoint terakhir (`lastProcessedRow`) tercatat secara persisten pada tabel `MigrationBatch` di basis data.
- [x] Parser streaming (`csvStreamParser` dan `xlsxStreamParser`) mendukung parameter `startRowNumber` untuk melanjutkan pembacaan tanpa membaca ulang data lama.
- [x] Bilah kemajuan (*Progress Bar*) pada halaman `/migration` tampil secara interaktif saat proses impor berjalan dengan animasi pengisian mulus.
- [x] Angka akumulasi baris sukses, baris gagal, dan total baris terbarui secara dinamis tanpa jeda atau kedipan layar (*flicker*).
- [x] Tombol "Keluar dari Sesi" pada bilah navigasi desktop dan laci navigasi mobile terkunci (*disabled*) dengan label jelas saat migrasi aktif.
- [x] Endpoint `POST /api/auth/logout` menolak permintaan penghentian sesi saat proses impor data sedang berlangsung (atau melakukan graceful pause saat dipaksa).
- [x] Jika browser tertutup atau sesi terhenti, sistem menampilkan Kartu Pemulihan (*Recovery Card*) saat pengguna kembali ke `/migration`, memungkinkan kelanjutan impor dengan sekali klik.
- [x] Dialog konfirmasi browser pemicu event `beforeunload` aktif saat pengguna mencoba menutup tab di tengah proses impor.
- [x] Desain kartu dan kontrol antarmuka mematuhi standar Modern Utility Minimalism (latar putih, border lembut, palet teal/slate, target tap >= 44px).
- [x] Bebas dari karakter em dash (Unicode \u2014) di seluruh teks UI, kode, dan komentar.
- [x] Seluruh suite pengujian otomatis (`npm test`) lulus 100% tanpa regresi.
