# Task 15: Detektor Penghentian Dini Baris Kosong & Baris Semu Beruntun (Consecutive Blank & Ghost Rows Early-Exit EOF Detector) pada Sistem Streaming Migrasi Data Historis (/migration)

> **Status:** Completed & Verified ✅  
> **Fase:** 3 (Optimasi Engine Streaming, Ketahanan Parse Spreadsheet Masif & Eliminasi Residu Formula Excel)  
> **Target Audiens:** Backend Streaming Engineer, Database Administrator, QA Automation Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Modul 4.1: Sistem Migrasi Historis Masif & Standar Integritas Data)
> - [`docs/GORO S2JB 2026 (Jawaban).xlsx`](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx) (Spreadsheet Acuan Formula Google Forms PLN)
> - [`docs/tasks/task_2.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_2.md) (Bulk Data Migration Engine & BullMQ Worker)
> - [`docs/tasks/task_13.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_13.md) (Otorisasi Fitur Migrasi untuk Role Pegawai)
> - [`docs/tasks/task_14.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_14.md) (Resumable Migration Checkpointing & Progress Bar)
> - [`.agents/skills/working-with-spreadsheets/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/working-with-spreadsheets/SKILL.md) (Standar Spreadsheet Masif & Formula)
> - [`.agents/skills/xlsx/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/xlsx/SKILL.md) (Pembersihan Data Tabular & Residu Formula)
> - [`.agents/skills/diagnosing-bugs/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/diagnosing-bugs/SKILL.md) (Metodologi Tight Feedback Loop & Root Cause Analysis)
> - [`.agents/skills/tdd/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/SKILL.md) (Pengujian TDD Parser Streaming)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Core Anti-Slop Filter & Larangan Em Dash)

---

## 1. Analisis Reverse Engineering Mendalam Pipeline Migrasi

Melalui investigasi menyeluruh (*reverse engineering*) terhadap alur eksekusi sistem dari antarmuka pengguna hingga lapisan basis data PostgreSQL, berikut adalah dekonstruksi langkah demi langkah yang terjadi pada sistem migrasi:

```
[User Role: PEGAWAI / SUPER_ADMIN]
        │
        ▼ 1. Unggah Berkas (CSV / XLSX)
[src/components/admin/BulkDropzone.tsx]
        │ POST /api/upload (Multipart Form Data)
        ▼
[uploads/migration/{timestamp}_{filename}] (Penyimpanan Fisik Berkas di Server)
        │
        ▼ 2. tRPC Mutation: migration.startMigration({ filePath, fileName, fileSize })
[src/server/routers/migration.ts]
        │ ├── Validasi Sesi: operatorProcedure (Role: PEGAWAI / SUPER_ADMIN)
        │ ├── Buat Record: prisma.migrationBatch.create({ status: "PENDING", uploadedById: user.id })
        │ └── Enqueue BullMQ: importQueue.add("process-bulk-import", { batchId, filePath, userId })
        ▼
[BullMQ Redis Queue: import-processing-queue]
        │
        ▼ 3. Konsumsi Job Latar Belakang (Concurrency: 1)
[src/server/workers/importWorker.ts]
        │ ├── Perbarui Status Batch: status = "PROCESSING", startedAt = now()
        │ ├── Verifikasi Integritas: Validasi uploadedById di tabel User (Mencegah FK Violation)
        │ ├── In-Memory Caching: Pre-fetch UP3, ULP, dan AppVersion ke JavaScript Map
        │ └── Routing Parser Berdasarkan Ekstensi (.csv -> parseCsvStream, .xlsx -> parseXlsxStream)
        ▼
[Streaming Parsers: csvStreamParser.ts / xlsxStreamParser.ts]
        │ ├── Fast-skip: startRowNumber (jika melanjutkan sesi terhenti)
        │ ├── Deteksi Baris Kosong & Baris Semu (isGhostOrBlankRow)
        │ ├── Early-Exit EOF Trigger: Hentikan stream saat consecutiveEmptyRows >= threshold
        │ ├── Chunking Buffer: Kumpulkan hingga batchSize = 2.000 baris
        │ └── Normalisasi Tanggal: Regex DD/MM/YYYY lokal Indonesia & Serial Excel
        ▼
[src/server/workers/importWorker.ts -> onBatchInsert]
        │ ├── Pemetaan Relasi: up3Map.get(), ulpMap.get(), versionMap.get()
        │ ├── Bulk Insert: prisma.ratingReview.createMany({ skipDuplicates: true })
        │ ├── Checkpointing: Perbarui lastProcessedRow & processedRows pada migrationBatch
        │ └── Job Progress: job.updateProgress() untuk pemantauan real-time
        ▼
[Penyelesaian / Finalisasi Batch]
        └── Status Akhir: status = "COMPLETED", completedAt = now(), totalRows terhitung bersih
```

---

## 2. Analisis Akar Masalah (Root Cause Analysis): Fenomena Ghost Rows

### 2.1 Mengapa Baris Kosong Beruntun Muncul pada Berkas Spreadsheet?
Dalam operasional PLN UID S2JB dan Google Sheets acuan ([`docs/GORO S2JB 2026 (Jawaban).xlsx`](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx)), pengelola data sering kali menyalin atau menarik formula (seperti formula deduplikasi `IF(COUNTIFS(...)>1, "YA", "TIDAK")` atau formula pembanding tanggal) ke bawah hingga puluhan ribu baris melebihi data fisik yang sebenarnya ada.

Ketika berkas tersebut diekspor ke format CSV atau dibaca oleh parser XLSX:
1. **Residu Formula Menghasilkan Nilai Semu (*Ghost Row*):**
   Meskipun kolom data utama (Timestamp, UP3, ULP, Nama Pengulas, Tanggal) kosong melompong, kolom formula (Kolom 11) tetap menghasilkan nilai string default seperti `"TIDAK"` atau `"FALSE"`.
   Contoh baris pada CSV hasil ekspor:
   ```csv
   ,,,,,,,,,,TIDAK,FALSE,
   ,,,,,,,,,,TIDAK,FALSE,
   ,,,,,,,,,,TIDAK,FALSE,
   ```
2. **Koma Menggantung (*Trailing Commas*):**
   Ekspor CSV sering menyertakan baris kosong dengan pemisah koma utuh (`,,,,,,,,,,,,`).

### 2.2 Dampak Kritis Sebelum Implementasi Early-Exit (Legacy Parser Flaw)
Pada implementasi parser lama:
* Kondisi validasi hanya memeriksa: `if (!row[1] || !row[2] || !row[3]) { totalErrors++; onError(...) }`.
* Parser **tidak dapat membedakan** antara:
  1. *Baris Rusak Sebenarnya*: Baris di tengah tabel yang terisi sebagian namun lupa diisi ULP/UP3 (harus dicatat ke log galat).
  2. *Baris Kosong/Semu di Akhir Data*: Residu formula di mana seluruh kolom identitas bernilai kosong.
* **Konsekuensi Bencana:**
  - Jika terdapat 30.000 baris formula kosong di bawah 3 data ulasan valid, parser membaca ke-30.000 baris tersebut satu per satu.
  - Menghasilkan 30.000 panggilan database `prisma.migrationErrorLog.create()`.
  - Menggelembungkan metrik `failedRows: 30000`, sehingga status migrasi tampak rusak parah padahal 100% data riil berhasil diimpor.
  - Membebani I/O database, membuang memori worker, dan memperpanjang waktu migrasi dari beberapa detik menjadi puluhan menit.

---

## 3. Spesifikasi Arsitektur Early-Exit EOF Detector

### 3.1 Definisi Presisi Baris Semu & Kosong (`isGhostOrBlankRow`)
Sebuah baris diklasifikasikan sebagai baris kosong atau baris semu (*ghost row*) jika seluruh kolom identitas entri bernilai kosong, null, atau hanya berisi karakter spasi/whitespace:
* **Kolom 1 (Index 0):** Timestamp Pengisian
* **Kolom 2 (Index 1):** Nama UP3
* **Kolom 3 (Index 2):** Nama ULP
* **Kolom 4 (Index 3):** Nama Akun Pengulas Playstore

Sekalipun kolom residu formula (Kolom 11 atau 12) memiliki nilai default seperti `"TIDAK"` atau `"FALSE"`, jika keempat kolom identitas di atas kosong, baris tersebut secara definitif adalah baris semu (*ghost row*).

Sebaliknya, jika terdapat baris yang memiliki Timestamp dan Nama Pengulas, namun UP3 atau ULP kosong, baris tersebut diklasifikasikan sebagai *Baris Cacat Riil* (bukan baris semu), sehingga `consecutiveEmptyRows` di-reset ke 0 dan galat dicatat ke `MigrationErrorLog`.

### 3.2 Ambang Batas Beruntun (*Consecutive Empty Rows Threshold*)
* **Nilai Ambang Batas Default:** `maxConsecutiveEmptyRows = 10`.
* **Rasional Desain:**
  Dalam lembar kerja spreadsheet yang diisi oleh manusia, sesekali dapat ditemukan 1 baris kosong yang tidak disengaja di antara data riil. Ambang batas 10 baris beruntun memberikan margin toleransi yang sangat aman agar proses tidak berhenti secara prematur karena 1 baris kosong di tengah, namun secara instan memutus aliran saat mencapai akhir data riil (*End-Of-File*).

### 3.3 Alur Kerja Pemutusan Aliran (*Stream Teardown*)
Saat kondisi `consecutiveEmptyRows >= maxConsecutiveEmptyRows` tercapai:
1. Tandai flag internal `isEarlyExit = true`.
2. Hancurkan aliran pembacaan berkas (`csvStream.destroy()` dan `stream.destroy()` pada CSV, atau `break` dari iterator `worksheetReader` pada XLSX).
3. Lakukan pengurasan (*flush*) sisa antrean batch yang masih ada di memori agar seluruh data valid sebelum baris kosong tersimpan 100% ke basis data.
4. Baris-baris kosong beruntun tersebut **tidak dipanggil ke `onError`** dan **tidak menambah `totalErrors`**.
5. Kembalikan hasil `resolve({ totalProcessed, totalErrors })` secara bersih ke worker BullMQ.

---

## 4. Rincian Sub-Task

### Task 15.1: Reverse Engineering & Spesifikasi Detektor Baris Kosong Beruntun
* Analisis alur migrasi end-to-end dari UI `/migration` hingga BullMQ worker.
* Identifikasi anomali residu formula spreadsheet pada Google Forms PLN UID S2JB.
* Penyusunan dokumen teknis komprehensif pada [`docs/tasks/task_15.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_15.md).

### Task 15.2: Implementasi Early-Exit di Streaming CSV Parser (`csvStreamParser.ts`)
* Tambahkan opsi konfigurasi `maxConsecutiveEmptyRows?: number` (default: 10).
* Implementasikan fungsi helper `isGhostOrBlankRow(row: string[])`.
* Tambahkan logika pelacak `consecutiveEmptyRows`.
* Implementasikan penutupan aman stream saat ambang batas tercapai dengan pengurasan buffer batch.

### Task 15.3: Implementasi Early-Exit di Streaming XLSX Parser (`xlsxStreamParser.ts`)
* Tambahkan opsi `maxConsecutiveEmptyRows?: number` (default: 10).
* Ekstrak nilai sel dengan sanitasi formula (`values[1]` s/d `values[4]`).
* Tambahkan logika pemutus loop `worksheetReader` saat ambang batas tercapai.
* Pastikan buffer terakhir di-flush ke callback `onBatch`.

### Task 15.4: Konfigurasi Parameter & Preservasi Metrik di BullMQ Worker (`importWorker.ts`)
* Pastikan `importWorker.ts` meneruskan parameter opsi jika diperlukan.
* Pastikan kalkulasi `totalRows` pada status akhir `COMPLETED` mencerminkan jumlah baris riil yang diproses (`totalProcessedRows + totalFailedRows`), tanpa pembengkakan baris kosong.
* Pastikan verifikasi foreign key `submittedById` tetap terlindungi.

### Task 15.5: Pengujian TDD Unit & Integrasi (*Tight Feedback Loop* Vitest)
* Perluas suite pengujian pada [`tests/unit/migrationResumableParser.test.ts`](file:///Users/a69/Desktop/goro-s2jb/tests/unit/migrationResumableParser.test.ts):
  - Uji berkas dengan 3 baris valid diikuti 50 baris kosong/semu (ekspektasi: 3 diproses, 0 error, early-exit triggered).
  - Uji berkas dengan 1 baris kosong terisolasi di antara data valid (ekspektasi: baris valid sesudahnya tetap terbaca).
  - Uji berkas dengan baris cacat di tengah data (ekspektasi: galat dicatat dan counter kosong di-reset).
* Jalankan `npm test` dan pastikan 100% dari 37 file tes lulus tanpa regresi.

### Task 15.6: Pengujian End-to-End Menggunakan Berkas Riil `docs/testing/1.csv` dengan Pengguna `PEGAWAI`
* Lakukan simulasi migrasi berkas nyata [`docs/testing/1.csv`](file:///Users/a69/Desktop/goro-s2jb/docs/testing/1.csv) menggunakan akun ber-role `PEGAWAI` (`pegawai_operator` - ID: `cmvrnuw0p001j8l8zqrhuz5kf`).
* Verifikasi:
  - 3 baris ulasan (Rudi Tabuci, Miki, Eta) terpetakan dengan benar ke UP3/ULP dan tersimpan di tabel `RatingReview`.
  - Batch migrasi mencapai status `COMPLETED` dengan `processedRows: 3` dan `failedRows: 0`.
  - Nol entri galat tercatat pada tabel `MigrationErrorLog`.

---

## 5. Matriks Kriteria Penerimaan (Acceptance Criteria)

| ID Kriteria | Deskripsi Kriteria Penerimaan | Metode Validasi | Status |
| :--- | :--- | :--- | :---: |
| **AC-1** | Detektor early-exit secara otomatis menghentikan stream pembacaan berkas ketika terdeteksi >= 10 baris kosong atau semu beruntun. | Vitest Unit Test (`migrationResumableParser.test.ts`) | Passed ✅ |
| **AC-2** | Baris kosong atau baris semu formula tidak dicatat ke `MigrationErrorLog` dan tidak meningkatkan counter `failedRows`. | Vitest Unit Test & Database Assertion | Passed ✅ |
| **AC-3** | Seluruh data ulasan valid sebelum baris kosong beruntun tersimpan 100% ke basis data tanpa kehilangan (*batch flush*). | Verifikasi Baris Basis Data (`RatingReview`) | Passed ✅ |
| **AC-4** | Baris rusak terisolasi di tengah berkas tetap dicatat sebagai galat validasi asli dan me-reset counter baris kosong. | Vitest Unit Test Corrupted Row | Passed ✅ |
| **AC-5** | Uji coba migrasi berkas [`docs/testing/1.csv`](file:///Users/a69/Desktop/goro-s2jb/docs/testing/1.csv) menggunakan user role `PEGAWAI` berhasil 100% (3 diproses, 0 galat, status `COMPLETED`). | E2E Execution Script pada Database Aktif | Passed ✅ |
| **AC-6** | Seluruh rangkaian pengujian sistem (`npm test`) lulus 100% (37 test files, 230+ tests) tanpa menimbulkan regresi. | Eksekusi `npm test` | Passed ✅ |
