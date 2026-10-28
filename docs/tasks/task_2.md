# Task 2: Modul Ingesti & Akuisisi Data (Garis Depan)

> **Status:** Completed / Verified ✅  
> **Fase:** 2 (Modul Fitur Utama - Modul 4.1 PRD)  
> **Target Audiens:** Frontend Engineer, Backend Engineer, Database Architect  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 1.1: Alur Kerja Lama, Bagian 4.1: Modul Ingesti & Akuisisi Data, Bagian 6: Roadmap MVP)
> - [`docs/GORO S2JB 2026 (Jawaban).xlsx`](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx) (Skema 13 Kolom *Form Responses 1*)
> - [`.agents/skills/working-with-spreadsheets/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/working-with-spreadsheets/)
> - [`.agents/skills/xlsx/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/xlsx/)
> - [`.agents/skills/frontend-design/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-design/)
> - [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/)

---

## 1. Ringkasan & Tujuan Task

Membangun gerbang masuk pasokan data (*Web Intake Engine*) dan sistem migrasi data historis masif (*Bulk Data Migration Engine*) untuk menggantikan peran Google Form dan Google Drive eksternal. 

Sesuai arahan pada **Roadmap MVP (PRD Bagian 6)**, modul ini merupakan prioritas nomor satu karena sistem tidak dapat memproses verifikasi AI (Modul 4.2), dasbor operator (Modul 4.3), maupun laporan eksekutif (Modul 4.4) sebelum jalur data masuk dan data historis terintegrasi secara andal ke dalam basis data PostgreSQL dan penyimpanan lokal (*Local Storage*).

---

## 2. Struktur Sub-Task Hierarkis

Modul ini dipecah menjadi 4 sub-track pengerjaan:
* **Task 2.1:** Antarmuka & Validasi Formulir Petugas Lapangan (`/intake`)
* **Task 2.2:** Rute Mutasi API tRPC & Logika Penyimpanan Berkas Eviden Lokal
* **Task 2.3:** Antarmuka Dasbor Impor Berkas Historis CSV / XLSX (`/admin/migration`)
* **Task 2.4:** Queue Worker BullMQ & Streaming Parser Memory-Safe (>140.000 Baris)

---

## 3. Instruksi Teknis Rinci

### 3.1 Task 2.1: Antarmuka Formulir Petugas Lapangan (`/intake`)
1. **Target Rute:** `src/app/(field)/intake/page.tsx`
2. **Karakteristik Desain & UX (Mengacu ke `.agents/skills/frontend-design/`):**
   * Antarmuka mobile-first yang sangat responsif, ringkas, dan bebas distraksi untuk kenyamanan petugas di lapangan saat memasukkan data rating pelanggan PLN Mobile.
   * Menggunakan komponen taktis dari shadcn/ui: `Card`, `Select`, `Input`, `Button`, `Calendar/Popover`, `Sonner/Toast`.
3. **Komponen Form & Pemetaan Atribut Kolom Lama:**
   * **UP3 (`up3Id`) & ULP (`ulpId`):** Dropdown *cascading* reaktif. Memilih UP3 (misal: "UP3 PALEMBANG") akan otomatis memfilter opsi ULP di bawahnya (misal: "ULP RIVAI", "ULP KENTEN"). Data ditarik dari query `trpc.master.getUnits`.
   * **Nama Pengulas Playstore (`playstoreReviewerName` - Kolom 4):** Input teks wajib (*required*), teks di-trim otomatis.
   * **Tanggal Entri (`entryDate` - Kolom 5):** Datepicker dengan nilai *default* tanggal hari ini (`today`).
   * **Versi PLN Mobile (`appVersionId` - Kolom 7):** Dropdown pilihan versi aktif (misal: `V5.2.79`), default pada versi terbaru.
   * **Nama Asli Pengulas (`originalReviewerName` - Kolom 8):** Input teks opsional (nama pelanggan menurut KTP/identitas jika berbeda dengan display name Play Store).
   * **Keterangan Pengulas (`reviewerCategory` - Kolom 9):** Pilihan radio atau select (default: `"Pelanggan"`).
   * **Catatan Lapangan (`fieldNotes` - Kolom 10):** Input textarea singkat untuk catatan tambahan petugas.
   * **Unggah Foto Eviden (`evidenceFile` - Kolom 6):** Dropzone file dengan opsi *take photo* pada peramban mobile:
     - Tipe berkas yang diizinkan: `image/jpeg`, `image/png`, `image/webp`.
     - Ukuran maksimal: 5 MB.
     - Pratinjau (*preview*) gambar instan sebelum dikirim.
4. **Validasi Skema (Zod):**
   * Buat skema validasi `intakeReviewSchema` pada `src/lib/validators/intake.ts` untuk memastikan tidak ada kolom wajib yang kosong sebelum submit.

---

### 3.2 Task 2.2: Rute API Mutasi & Logika Penyimpanan Lokal
1. **Target File:**
   * `src/server/routers/intake.ts`
   * `src/lib/storage.ts`
2. **Alur Eksekusi Server:**
   * **Langkah 1 (Simpan Berkas Fisik):** Handler menerima unggahan berkas gambar, memverifikasi *magic bytes* MIME, menghasilkan nama unik berbasis timestamp & UUID (`[timestamp]_[uuid].[ext]`), lalu menyimpannya ke struktur folder fisik `./uploads/evidence/{YYYY}/{MM}/{DD}/`.
   * **Langkah 2 (Simpan ke Basis Data):** Masukkan entri baru ke tabel `RatingReview` dengan status awal `PENDING`:
     - `timestamp`: waktu server saat data diterima (Kolom 1).
     - `evidenceImagePath`: path relatif berkas pada penyimpanan lokal (Kolom 6).
     - `validationStatus`: `PENDING` (Kolom 12).
     - `submittedById`: ID akun petugas lapangan yang sedang login.
   * **Langkah 3 (Dispatch Antrean OCR):** Tambahkan job ke `ocrQueue` BullMQ:
     ```typescript
     await ocrQueue.add("process-ocr", {
       reviewId: review.id,
       imagePath: savedFilePath,
       reviewerName: input.playstoreReviewerName,
     });
     ```
   * **Langkah 4 (Respon Cepat):** Kembalikan status sukses ke klien dalam <500ms agar petugas lapangan dapat langsung menginput data pelanggan berikutnya tanpa menunggu komputasi OCR selesai.

---

### 3.3 Task 2.3: Dasbor Migrasi Berkas Historis CSV / XLSX (`/admin/migration`)
1. **Target Rute:** `src/app/(admin)/migration/page.tsx`
2. **Karakteristik Antarmuka:**
   * Didedikasikan untuk operator atau super-admin untuk mengimpor berkas lama (*Form Responses 1*, *LAPORAN HARIAN H-1*, *LAPORAN HARIAN*, dan *LAPORAN BULANAN*).
   * Komponen Dropzone interaktif dengan indikasi *drag-and-drop*.
   * Dropdown pemilihan target skema:
     - `FORM_RESPONSES_RAW`: Mengimpor data ulasan mentah 13 kolom (*Form Responses 1*).
     - `HISTORICAL_REPORTS`: Mengimpor riwayat data laporan operasional (*Laporan Harian / Bulanan*).
   * Panel pemantau status progres impor aktif (BullMQ job progress via SSE / polling query `trpc.migration.getStatus`).

---

### 3.4 Task 2.4: Queue Worker BullMQ & Streaming Parser Memory-Safe
1. **Target File:**
   * `src/server/queues/importQueue.ts`
   * `src/server/workers/importWorker.ts`
   * `src/lib/parsers/csvStreamParser.ts`
   * `src/lib/parsers/xlsxStreamParser.ts`
2. **Strategi Pemrosesan Memory-Safe (>140.000 Baris):**
   * **Larangan Keras:** DILARANG memuat seluruh baris file masif sekaligus ke dalam memori JavaScript (`readAll` / array raksasa) karena akan memicu *JavaScript heap out of memory*.
   * **Implementasi Streaming Parser CSV:**
     - Gunakan stream parser berbasis event (seperti `fast-csv` atau modul streaming Node.js `readline`).
     - Terapkan mekanisme *chunking/batching*: Kumpulkan baris per batch (misal 1.000 baris per batch), lalu eksekusi operasi batch insert ke PostgreSQL menggunakan `prisma.ratingReview.createMany({ data: chunk, skipDuplicates: true })`.
   * **Implementasi Parser Lembar Laporan XLSX:**
     - Mengikuti panduan `.agents/skills/xlsx/SKILL.md` dan `.agents/skills/working-with-spreadsheets/`: gunakan openpyxl mode `read_only=True` via script Python helper atau `exceljs` streaming reader untuk mengekstrak data ulasan dan riwayat laporan secara efisien.
   * **Isolasi Error & Logging:**
     - Jika terdapat baris data yang cacat atau kolom hilang, catat baris tersebut ke tabel `MigrationErrorLog` dan lanjutkan pemrosesan batch baris lainnya tanpa menghentikan worker.
   * **Pelaporan Progres:**
     - Update progress job BullMQ setiap kelipatan 5.000 baris agar antarmuka web dapat menampilkan persentase progres terkini kepada operator.

---

## 4. Kriteria Penerimaan (Acceptance Criteria)

- [x] **AC-1 (Intake Form Validation):** Form di `/intake` menolak pengiriman jika kolom wajib (UP3, ULP, Nama Pengulas, Foto Bukti) kosong, serta memberikan pesan error validasi yang jelas pada tiap field.
- [x] **AC-2 (Cascading Unit Selection):** Mengubah pilihan UP3 pada dropdown secara instan memperbarui daftar pilihan ULP yang relevan tanpa lag.
- [x] **AC-3 (Secure File Ingestion):** Berkas gambar yang diunggah dari form berhasil disimpan ke direktori `./uploads/evidence/YYYY/MM/DD/` dengan nama berkas unik yang disanitasi.
- [x] **AC-4 (Database Record & Pending State):** Data formulir berhasil masuk ke tabel `RatingReview` dengan `validationStatus = "PENDING"`, timestamp tercatat akurat, dan relasi foreign key tersambung dengan benar.
- [x] **AC-5 (Asynchronous Job Dispatch):** Pengiriman form berhasil menambahkan job baru ke antrean BullMQ `ocrQueue` beserta payload ID review dan path gambar lokal.
- [x] **AC-6 (Bulk Import Streaming & No OOM):** Pengujian impor file CSV/XLSX berukuran >140.000 baris melalui `/admin/migration` berhasil diselesaikan oleh worker BullMQ dalam beberapa menit dengan penggunaan memori proses Node.js tetap stabil (< 512 MB).
- [x] **AC-7 (Historical Data Import):** Data ulasan dan riwayat laporan pada berkas `GORO S2JB 2026 (Jawaban).xlsx` berhasil dipetakan ke dalam basis data dengan benar.
- [x] **AC-8 (Error Tolerant Migration):** Baris data impor yang tidak valid tidak mematikan seluruh proses, melainkan dicatat ke tabel log error untuk ditinjau.

---

## 5. Matriks Berkas yang Dibuat / Diubah

| Jalur Berkas | Aksi | Deskripsi Perubahan |
| :--- | :--- | :--- |
| `src/app/(field)/intake/page.tsx` | Dibuat | Halaman antarmuka input formulir ulasan untuk Petugas Lapangan |
| `src/components/forms/IntakeForm.tsx` | Dibuat | Komponen formulir utama dengan validasi Zod dan integrasi upload gambar |
| `src/components/forms/CascadingUnitSelect.tsx` | Dibuat | Komponen select dropdown bertingkat UP3 dan ULP |
| `src/lib/validators/intake.ts` | Dibuat | Skema validasi Zod untuk input form lapangan |
| `src/server/routers/intake.ts` | Dibuat | Prosedur tRPC untuk mutasi input data dan registrasi bukti eviden |
| `src/app/(admin)/migration/page.tsx` | Dibuat | Halaman UI dropzone untuk upload dan monitoring impor data historis |
| `src/components/admin/BulkDropzone.tsx` | Dibuat | Komponen upload berkas drag-and-drop dengan progress bar |
| `src/server/routers/migration.ts` | Dibuat | Prosedur tRPC untuk upload file CSV/XLSX dan pengecekan status antrean |
| `src/server/queues/importQueue.ts` | Dibuat | Antrean BullMQ khusus untuk tugas pemrosesan impor massal |
| `src/server/workers/importWorker.ts` | Dibuat | Worker BullMQ untuk mengeksekusi streaming parser dan batch insert DB |
| `src/lib/parsers/csvStreamParser.ts` | Dibuat | Engine streaming CSV dengan batch chunking (1.000-2.500 baris/batch) |
| `src/lib/parsers/xlsxStreamParser.ts` | Dibuat | Parser memori-ringan untuk mengekstrak sheet Form Responses dan sheet laporan |
| `src/server/routers/_app.ts` | Diubah | Mendaftarkan sub-router `intake` dan `migration` ke root router |
| `prisma/schema.prisma` | Diubah | Menambahkan model `MigrationLog` dan `MigrationErrorLog` jika belum ada |

---

## 6. Titik Uji & Pengujian (TDD Seams)

1. **Form Schema Test (`tests/unit/intakeSchema.test.ts`):** Menguji validasi payload Zod terhadap berbagai variasi input (input sah, nama kosong, file melebihi 5MB, format gambar salah).
2. **Intake Mutation Seam (`tests/integration/intakeProcedure.test.ts`):** Menguji prosedur `trpc.intake.submitReview` menggunakan in-memory database atau mock, memverifikasi bahwa record tersimpan dan job BullMQ terkirim.
3. **Storage Security Seam (`tests/unit/storageUpload.test.ts`):** Menguji bahwa file disimpan di folder berformat tahun/bulan/hari, dan percobaan mengunggah ekstensi berbahaya (`.exe`, `.sh`, `.php`) ditolak keras.
4. **CSV Streaming Parser Seam (`tests/integration/csvStreamParser.test.ts`):** Menguji parser streaming dengan sampel file CSV 10.000 baris, memastikan batch diproses secara berurutan dan penggunaan memori tetap konstan.
