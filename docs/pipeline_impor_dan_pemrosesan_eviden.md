# Panduan Teknis & Arsitektur Pipeline Impor Data, Ekstraksi Eviden Google Drive & Pemrosesan Citra Vision

> **Status Dokumen:** Living Architecture Specification 📘  
> **Klasifikasi:** Sistem Komando Pengelolaan & Validasi Eviden Terotomatisasi (GORO S2JB)  
> **Target Audiens:** Full-Stack Engineers, AI Vision Engineers, Data Engineers, Database Administrators  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Modul 1.1, 4.1, 4.2: Sistem Migrasi Historis & Validasi Citra Eviden)
> - [`docs/tasks/task_2.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_2.md) (Bulk Data Migration Engine & BullMQ Worker)
> - [`docs/tasks/task_14.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_14.md) (Resumable Migration Checkpointing & Progress Tracking)
> - [`docs/tasks/task_15.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_15.md) (Consecutive Blank Rows Early-Exit EOF Detector)
> - [`src/lib/parsers/csvStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/csvStreamParser.ts) (Streaming CSV Parser)
> - [`src/lib/parsers/xlsxStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/xlsxStreamParser.ts) (Streaming XLSX Parser)
> - [`src/lib/storage.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/storage.ts) (Local File Storage & Path Resolver)
> - [`src/server/workers/importWorker.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/workers/importWorker.ts) (BullMQ Bulk Import Worker)
> - [`src/server/workers/ocrWorker.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/workers/ocrWorker.ts) (BullMQ OCR Worker)
> - [`src/server/services/ocrBridge.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/services/ocrBridge.ts) (Bridge Node.js ke Python Engine)
> - [`python-services/ocr/main.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/main.py) (FastAPI Microservice & CLI Entry)
> - [`python-services/ocr/engine.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/engine.py) (Tesseract OCR Engine)
> - [`python-services/ocr/preprocessor.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/preprocessor.py) (Dark-Mode Detection & Image Enhancement)
> - [`python-services/ocr/matcher.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/matcher.py) (Fuzzy String Matcher & Triase 3 Zona)
> - [`python-services/ocr/hasher.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/hasher.py) (Perceptual Hashing & Anti-Fraud Hamming Distance)
> - [`prisma/schema.prisma`](file:///Users/a69/Desktop/goro-s2jb/prisma/schema.prisma) (Model Relasional PostgreSQL)

---

## 1. Ikhtisar Arsitektur Pipeline End-to-End

Sistem GORO S2JB dibangun untuk mentransformasikan alur kerja lama yang mengandalkan Google Form dan validasi spreadsheet manual baris per baris menjadi sistem otomatisasi terpusat.

Diagram alur berikut mendemonstrasikan perjalanan data dari berkas impor XLSX/CSV hingga penyimpanan basis data dan evaluasi kecerdasan buatan (*AI Vision*):

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           1. INGESTI BERKAS MASIF                               │
│  User mengunggah XLSX / CSV (Form Responses 1) via UI /migration (Role PEGAWAI) │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    2. PEMROSESAN STREAMING & FAST-PARSING                       │
│  - ExcelJS stream reader / fast-csv (Mencegah Out-Of-Memory pada 140.000+ baris)│
│  - Fast-skip (startRowNumber) untuk pemulihan sesi terhenti (Resumable Engine)  │
│  - Early-Exit EOF Detector: Hentikan stream jika >= 10 baris kosong beruntun   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                 3. EKSTRAKSI KOLOM & NORMALISASI RELASI UNIT                    │
│  - Ambil Col 1..13: Timestamp, UP3, ULP, Pengulas, Tanggal, Link Eviden, Status │
│  - In-memory Map Cache: Mapping nama string UP3/ULP ke UUID/CUID Database       │
│  - Normalisasi Tanggal: Serial Excel Date & Format Indonesia DD/MM/YYYY         │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│          4. PENANGANAN LINK GOOGLE DRIVE (COL 6) & PENYIMPANAN LOKAL            │
│  - Ekstraksi Google Drive fileId dari https://drive.google.com/open?id=...      │
│  - Pengunduhan stream biner via Direct Content URL / Drive API                  │
│  - Simpan biner ke disk: uploads/evidence/YYYY/MM/DD/eviden_{timestamp}_{id}.jpg│
│  - Pengamanan Path Traversal & Validasi MIME Type (JPEG/PNG/WEBP)               │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│             5. PENCATATAN MASIF KE BASIS DATA POSTGRESQL (BULK INSERT)          │
│  - Batching 2.000 baris per transaksi: prisma.ratingReview.createMany()         │
│  - skipDuplicates: true untuk mencegah integritas tabel terganggu               │
│  - Checkpoint tracking: update lastProcessedRow & processedRows di MigrationBatch│
│  - Isolasi baris cacat riil ke tabel MigrationErrorLog                          │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                 6. ANTREAN ASINKRON AI VISION (BULLMQ ocrQueue)                 │
│  - Review ID didaftarkan ke antrean ocr-processing-queue (Concurrency: 2)       │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                   7. PEMROSESAN CITRA GAMBAR (AI VISION ENGINE)                 │
│  a. Preprocessing: Grayscale, Inversi Dark-Mode, Kontras 1.8x, Edge Sharpening │
│  b. Perceptual Hashing: 64-bit DCT pHash -> Deteksi Duplikasi (Hamming Dist <= 5)│
│  c. Text Extraction: Tesseract OCR (Model ind+eng)                              │
│  d. Fuzzy Matching: RapidFuzz partial_ratio & token_set_ratio Nama vs OCR Teks │
│  e. Triase 3 Zona: Hijau (>=90% APPROVED), Kuning (70-89% REVIEW), Merah (REJECT)│
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                 8. PEMBARUAN ATOMIK HASIL VALIDASI KE DATABASE                  │
│  - Update RatingReview: confidenceScore, evidenceImageHash, validationStatus    │
│  - Operator Triase memverifikasi data Zona Kuning di Dasbor tanpa buka GDrive   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pemrosesan Data Impor XLSX dan CSV

### 2.1 Mengapa Arsitektur Streaming Wajib Digunakan?
Berkas rekap ulasan operasional PLN UID S2JB memiliki volume masif (mencapai 100.000 hingga 143.000+ baris). Membaca berkas sebesar ini sekaligus ke dalam memori (*in-memory parsing*) dengan pustaka standar (seperti `xlsx.readFile` atau memuat seluruh larik ke RAM) membutuhkan alokasi memori heap Node.js lebih dari 2 GB hingga 4 GB, yang menyebabkan *server crash* dengan pesan galat fatal:
`FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.

Untuk itu, GORO S2JB menerapkan dua parser streaming berbasis aliran data disk:
1. **Parser CSV ([`src/lib/parsers/csvStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/csvStreamParser.ts)):** Menggunakan `fast-csv` yang dipasangkan dengan Node.js `fs.createReadStream()`. Aliran data dialirkan dalam bentuk *chunks* biner kecil, diparsing per baris, dan dibuffer per 1.000 hingga 2.000 entri sebelum diserahkan ke *worker*.
2. **Parser XLSX ([`src/lib/parsers/xlsxStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/xlsxStreamParser.ts)):** Menggunakan `ExcelJS.stream.xlsx.WorkbookReader`. Iterator `for await (const row of worksheetReader)` memancarkan baris secara sekuensial langsung dari arsip terkompresi ZIP XLSX tanpa mengekstraksi seluruh lembar kerja ke RAM.

### 2.2 Penjadwalan Asinkron BullMQ (*Background Queue*)
Proses impor diinisiasi oleh pengguna melalui antarmuka web `/migration`. Agar koneksi HTTP peramban tidak mengalami *timeout* (karena impor ribuan baris memerlukan waktu beberapa menit):
1. Endpoint tRPC `migration.startMigration` membuat rekaman di tabel `MigrationBatch` dengan status `PENDING`.
2. Pekerjaan didaftarkan ke antrean Redis BullMQ:
   ```typescript
   await importQueue.add("process-bulk-import", {
     importBatchId: batch.id,
     filePath: input.filePath,
     userId: ctx.user?.id,
     startRowNumber: 0,
   });
   ```
3. Worker BullMQ ([`src/server/workers/importWorker.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/workers/importWorker.ts)) mengonsumsi pekerjaan secara terisolasi dengan konfigurasi `concurrency: 1`. Hal ini menjamin beban CPU dan I/O basis data tetap stabil.

### 2.3 Pemulihan Sesi Terhenti (*Resumable Checkpointing*)
Sesuai rancangan pada [`docs/tasks/task_14.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_14.md):
* Jika koneksi internet terputus, peramban tertutup, atau terjadi kegagalan sistem di baris ke-45.000 dari 140.000 baris, status batch ditandai sebagai `PAUSED`.
* Ketika pengguna menekan tombol **Lanjutkan Migrasi (*Resume*)**, pekerjaan BullMQ dipanggil kembali dengan parameter `startRowNumber = batch.lastProcessedRow`.
* Parser secara efisien melakukan *fast-skip* pada baris-baris awal:
  ```typescript
  if (options.startRowNumber && currentRowNumber <= options.startRowNumber) {
    return; // Lewati tanpa alokasi memori objek
  }
  ```

### 2.4 Detektor Penghentian Dini Baris Kosong & Baris Semu (*Early-Exit EOF Detector*)
Sesuai rancangan pada [`docs/tasks/task_15.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_15.md):
* Pada spreadsheet yang disalin formulanya hingga puluhan ribu baris ke bawah, baris-baris semu (*ghost rows*) menghasilkan teks default pada kolom formula (misal: `,,,,,,,,,,TIDAK,FALSE,`), sementara kolom identitas utama (Timestamp, UP3, ULP, Pengulas) kosong melompong.
* Fungsi `isGhostOrBlankRow(row)` mengevaluasi apakah keempat kolom identitas utama kosong:
  ```typescript
  export function isGhostOrBlankRow(row: (string | undefined | null)[]): boolean {
    if (!row || row.length === 0) return true;
    const allEmpty = row.every((c) => !c || String(c).trim() === "");
    if (allEmpty) return true;

    const c0 = (row[0] || "").trim(); // Timestamp
    const c1 = (row[1] || "").trim(); // UP3
    const c2 = (row[2] || "").trim(); // ULP
    const c3 = (row[3] || "").trim(); // Reviewer Name

    return !c0 && !c1 && !c2 && !c3;
  }
  ```
* Jika terdeteksi `consecutiveEmptyRows >= 10` baris beruntun:
  - Aliran berkas segera dihentikan (`csvStream.destroy()` dan `stream.destroy()` pada CSV, atau `break` pada XLSX).
  - Sisa data pada buffer batch segera di-*flush* ke basis data.
  - Baris-baris kosong beruntun tersebut tidak dicatat sebagai galat di `MigrationErrorLog`, mengeliminasi ribuan panggilan basis data palsu.

---

## 3. Ekstraksi Kolom yang Dibutuhkan & Normalisasi Data

### 3.1 Struktur Kolom Spreadsheet PLN UID S2JB (*Form Responses 1*)
Setiap baris data mentah memiliki struktur 13 kolom baku sebagai berikut:

| No. Kolom | Indeks CSV (0-based) | Indeks XLSX (1-based) | Nama Kolom Asli | Pemetaan Atribut Model `RatingReview` | Keterangan & Perlakuan |
| :---: | :---: | :---: | :--- | :--- | :--- |
| **Col 1** | `row[0]` | `values[1]` | `Timestamp` | `timestamp: DateTime` | Tanggal dan waktu pengisian formulir lapangan |
| **Col 2** | `row[1]` | `values[2]` | `UP3` | `up3Id: String` (FK) | Unit Pelaksana Pelayanan Pelanggan (misal: `UP3 PALEMBANG`) |
| **Col 3** | `row[2]` | `values[3]` | `ulpId: String` (FK) | `ULP` | Unit Layanan Pelanggan (misal: `ULP RIVAI`, `ULP TUGU MULYO`) |
| **Col 4** | `row[3]` | `values[4]` | `Nama Pengulas Playstore` | `playstoreReviewerName: String` | Nama akun pelanggan yang menulis ulasan di Play Store |
| **Col 5** | `row[4]` | `values[5]` | `Tanggal` | `entryDate: DateTime` | Tanggal ulasan diberikan oleh pelanggan |
| **Col 6** | `row[5]` | `values[6]` | `Foto Eviden` | `evidenceImagePath: String` | URL Google Drive tangkapan layar ulasan ulasan |
| **Col 7** | `row[6]` | `values[7]` | `Versi PLN Mobile` | `appVersionId: String` (FK) | Versi aplikasi saat ulasan dibuat (misal: `V5.2.79`) |
| **Col 8** | `row[7]` | `values[8]` | `Nama Pengulas Sebenarnya` | `originalReviewerName: String?` | Nama asli pelanggan jika akun Play Store menggunakan nama samaran |
| **Col 9** | `row[8]` | `values[9]` | `Kategori Pengulas` | `reviewerCategory: String` | Kategori (misal: `Pelanggan`, `Pegawai PLN`, dll.) |
| **Col 10** | `row[9]` | `values[10]` | `Keterangan Lapangan` | `fieldNotes: String?` | Catatan tambahan dari surveyor lapangan |
| **Col 11** | `row[10]` | `values[11]` | `Duplikasi` | `isDuplicate: Boolean` | Formula lama: `YA`/`1`/`TRUE` jika terindikasi duplikasi teks |
| **Col 12** | `row[11]` | `values[12]` | `Status Validasi` | `validationStatus: Enum` | Tanda centang manual lama: `1`/`TRUE` = `APPROVED`, `0`/`FALSE` = `REJECTED` |
| **Col 13** | `row[12]` | `values[13]` | `Catatan Koreksi` | `reviewRemarks: String?` | Catatan tinjauan manual oleh pegawai |

### 3.2 In-Memory Caching Relasi Unit (Mencegah N+1 Database Roundtrips)
Sebelum memulai perulangan pembacaan baris, `importWorker.ts` memuat seluruh data master unit ke dalam memori JavaScript `Map`:
```typescript
const allUp3s = await prisma.uP3.findMany({ select: { id: true, name: true, code: true } });
const allUlps = await prisma.uLP.findMany({ select: { id: true, name: true, code: true, up3Id: true } });
const allVersions = await prisma.appVersion.findMany({ select: { id: true, version: true } });

const up3Map = new Map<string, string>();
allUp3s.forEach((u) => {
  up3Map.set(u.name.toUpperCase(), u.id);
  up3Map.set(u.code.toUpperCase(), u.id);
});

const ulpMap = new Map<string, { id: string; up3Id: string }>();
allUlps.forEach((ulp) => {
  ulpMap.set(ulp.name.toUpperCase(), { id: ulp.id, up3Id: ulp.up3Id });
  ulpMap.set(ulp.code.toUpperCase(), { id: ulp.id, up3Id: ulp.up3Id });
});
```
Dengan struktur ini, pencarian ID unit untuk 140.000 baris dieksekusi dengan kompleksitas $O(1)$ di memori tanpa membebani server basis data dengan ratusan ribu kueri `SELECT`.

### 3.3 Normalisasi Tanggal Adaptif
Pustaka JavaScript V8 secara default menginterpretasikan format `02/07/2026` sebagai format Amerika Serikat (`MM/DD/YYYY`, 7 Februari 2026). Hal ini dapat merusak data ulasan di Indonesia yang menggunakan format hari-bulan-tahun (2 Juli 2026).

Fungsi `parseExcelOrStandardDate` pada [`src/lib/parsers/csvStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/csvStreamParser.ts) menangani tiga variasi format secara deterministik:
1. **Nomor Serial Tanggal Excel (Excel Serial Date):** Angka serial dihitung dari *epoch* 1 Januari 1900:
   ```typescript
   const num = Number(val);
   if (!isNaN(num) && num > 20000 && num < 80000) {
     const ms = (num - 25569) * 86400 * 1000;
     return new Date(ms);
   }
   ```
2. **Format Tanggal Indonesia (`DD/MM/YYYY`):** Regex mencocokkan `^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$` dan memetakan bagian pertama sebagai hari (*day*) dan bagian kedua sebagai bulan (*month*).
3. **Format Timestamp Google Sheets (`M/D/YYYY H:mm:ss`):** Regex mencocokkan pola tanggal disertai jam, menit, dan detik.

---

## 4. Penanganan Tautan Google Drive pada Column 6 & Penyimpanan Gambar Lokal

### 4.1 Struktur Tautan Google Drive pada Berkas Mentah
Pada Column 6, surveyor lapangan yang mengisi Google Form menghasilkan tautan URL publik atau semi-publik dengan pola:
* Pola ID Parameter: `https://drive.google.com/open?id=1xkoBV7PnSZ8bqFe89qrpQk6GswW5iVqp`
* Pola Path Direktori: `https://drive.google.com/file/d/157qyJ-yAvYTTnPZcgM1qZ0cXpdfLrQqb/view?usp=drivesdk`
* Pola Tautan Unduh: `https://drive.google.com/uc?id=1--6-2bJppAlOrXKfNgkP9IzUmagITwk8&export=download`

### 4.2 Algoritma Ekstraksi `fileId` Google Drive
Untuk mengambil citra eviden secara terotomatisasi, sistem mengekstraksi nilai alfanumerik `fileId` menggunakan ekspresi reguler:
```typescript
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  
  // 1. Cocokkan pola parameter ?id=...
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  // 2. Cocokkan pola direktori /file/d/.../
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  return null;
}
```

### 4.3 Pengunduhan Biner & Penyimpanan Lokal
Setelah `fileId` diperoleh, sistem mengalirkan biner citra langsung ke disk lokal server untuk memutus ketergantungan pada Google Drive:
1. **Endpoint Pengunduhan Langsung (*Direct Download URL*):**
   `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`
2. **Direktori Penyimpanan Lokal Terstruktur ([`src/lib/storage.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/storage.ts)):**
   Berkas disimpan pada direktori terpisah berdasarkan tanggal entri (`uploads/evidence/YYYY/MM/DD/`) guna menghindari batasan jumlah berkas per folder pada sistem berkas (*file system inodes*):
   ```typescript
   const dateSubdir = getDateBasedSubdir(entryDate); // misal: "evidence/2026/07/02"
   const targetDir = path.join(BASE_UPLOAD_DIR, dateSubdir);
   await fs.promises.mkdir(targetDir, { recursive: true });

   const uniqueSuffix = crypto.randomBytes(8).toString("hex");
   const filename = `eviden_${Date.now()}_${uniqueSuffix}.jpg`;
   const absolutePath = path.join(targetDir, filename);
   ```
3. **Penyimpanan Jalur Relatif di Basis Data:**
   Nilai yang disimpan pada kolom `evidenceImagePath` di tabel `RatingReview` adalah jalur relatif terhadap direktori unggahan (contoh: `evidence/2026/07/02/eviden_1783281920_ab12cd34.jpg`). Hal ini memastikan portabilitas data jika direktori aplikasi dipindahkan ke server lain.

### 4.4 Pengamanan Akses Berkas & Anti-Path Traversal
Untuk mencegah serangan manipulasi jalur berkas (*Directory Traversal Attack* seperti `../../etc/passwd`), modul [`src/lib/storage.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/storage.ts) menerapkan validasi ketat:
* Memeriksa apakah jalur absolut berkas selalu diawali dengan `BASE_UPLOAD_DIR + path.sep`.
* Membatasi ekstensi berkas hanya pada format citra yang diperbolehkan (`.jpg`, `.jpeg`, `.png`, `.webp`).
* Penyajian berkas statis ke antarmuka pengguna dilakukan melalui API aman (`GET /api/uploads/[...path]`) yang memeriksa hak akses otentikasi.

### 4.5 Penanganan Kasus Izin Terkunci (*403 Access Denied*)
Jika tautan Google Drive tidak dapat diunduh (misalnya berkas telah dihapus dari Google Drive pemilik formulir atau izin akses privat):
* Jalur citra ditandai dengan tautan cadangan atau penanda `legacy/gdrive_import`.
* Status ulasan ditetapkan ke `NEEDS_REVIEW` dengan catatan: `Tautan eviden Google Drive eksternal tidak dapat diakses secara otomatis`.
* Petugas atau operator dapat memperbarui berkas eviden secara manual melalui formulir koreksi.

---

## 5. Pencatatan Setiap Rekord ke Basis Data PostgreSQL

### 5.1 Skema Relasional Tabel `RatingReview` ([`prisma/schema.prisma`](file:///Users/a69/Desktop/goro-s2jb/prisma/schema.prisma))
Setiap baris ulasan dipetakan ke dalam model basis data relasional PostgreSQL:

```prisma
model RatingReview {
  id                    String            @id @default(cuid())
  timestamp             DateTime
  up3Id                 String
  ulpId                 String
  playstoreReviewerName String
  entryDate             DateTime
  evidenceImagePath     String            // Path lokal berkas gambar eviden
  evidenceImageHash     String?           // 64-bit Perceptual Hash (Hex)
  confidenceScore       Float?            // Skor kesesuaian OCR vs Nama (0.0 - 100.0)
  extractedOcrText      String?           @db.Text
  appVersionId          String
  originalReviewerName  String?
  reviewerCategory      String            @default("Pelanggan")
  fieldNotes            String?
  isDuplicate           Boolean           @default(false)
  duplicateOfId         String?
  validationStatus      ValidationStatus  @default(PENDING) // PENDING, APPROVED, REJECTED, NEEDS_REVIEW
  reviewRemarks         String?
  submittedById         String?
  verifiedById          String?
  verifiedAt            DateTime?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  up3                   UP3               @relation(fields: [up3Id], references: [id])
  ulp                   ULP               @relation(fields: [ulpId], references: [id])
  appVersion            AppVersion        @relation(fields: [appVersionId], references: [id])
  submittedBy           User?             @relation("SubmittedReviews", fields: [submittedById], references: [id])
  verifiedBy            User?             @relation("VerifiedReviews", fields: [verifiedById], references: [id])
  duplicateOf           RatingReview?     @relation("DuplicateReviews", fields: [duplicateOfId], references: [id])
  duplicates            RatingReview[]    @relation("DuplicateReviews")

  @@index([up3Id, ulpId])
  @@index([validationStatus])
  @@index([entryDate])
  @@index([evidenceImageHash])
  @@index([submittedById])
}
```

### 5.2 Operasi Penyisipan Massal (*Bulk Insertion*)
Alih-alih melakukan pemanggilan `prisma.ratingReview.create()` sebanyak 140.000 kali secara berulang (yang memakan waktu berjam-jam), sistem mengelompokkan data ke dalam *chunk* berukuran 2.000 baris dan mengeksekusi metode massal:
```typescript
await prisma.ratingReview.createMany({
  data: ratingData,
  skipDuplicates: true,
});
```
* **Kinerja:** Memproses 2.000 entri hanya membutuhkan waktu sekitar 150-250 milidetik.
* **Keamanan:** Parameter `skipDuplicates: true` menjamin transaksi tidak dibatalkan jika terdapat konflik kunci unik.

### 5.3 Verifikasi Kunci Asing (*Foreign Key Integrity*)
Sebelum menugaskan `submittedById`, worker memverifikasi keberadaan ID pengguna di tabel `User`. Jika berkas diimpor oleh sistem latar belakang atau akun placeholder, nilainya secara aman disetel ke `null` atau ID pengguna valid yang terverifikasi guna mencegah galat integritas relasional PostgreSQL (`Foreign key constraint violation`).

### 5.4 Pencatatan Log Galat Terisolasi (`MigrationErrorLog`)
Jika baris data di tengah berkas mengalami kerusakan data riil (misalnya kolom UP3 atau ULP kosong pada data yang memiliki nama pengulas):
* Baris cacat tersebut diisolasi ke tabel `MigrationErrorLog`.
* Data mentah baris disimpan dalam format JSON string agar dapat ditinjau ulang oleh tim data engineering.
* Proses impor baris-baris berikutnya **tidak terhenti**.

---

## 6. Pemrosesan Citra Gambar & Mesin AI Vision

Setelah berkas citra tersimpan di disk lokal, ulasan diproses melalui antrean AI Vision (`ocrWorker.ts`) yang terhubung dengan modul Python OCR ([`python-services/ocr/`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/)).

### 6.1 Arsitektur Bridge Hibrida (FastAPI Microservice + Subprocess Fallback)
Modul [`src/server/services/ocrBridge.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/services/ocrBridge.ts) menerapkan strategi eksekusi ganda:
1. **Jalur Utama (High-Performance HTTP):** Mengirimkan permintaan POST ke microservice FastAPI lokal (`http://127.0.0.1:8001/api/v1/process`). Waktu respons berkisar antara 80 hingga 150 ms per gambar.
2. **Jalur Cadangan Otomatis (*Seamless Subprocess Fallback*):** Jika layanan HTTP tidak aktif atau mengalami *timeout* (lebih dari 4 detik), Node.js secara otomatis meluncurkan proses anak (*isolated child process*) menggunakan virtual environment Python (`python-services/ocr/venv/bin/python3 main.py`). Hal ini menjamin sistem tetap berfungsi 100% sekalipun microservice belum dinyalakan.

### 6.2 Tahapan Pra-Pemrosesan Citra (*Image Preprocessing*)
Tangkapan layar ulasan dari smartphone pengguna sering kali bervariasi: resolusi rendah, artefak kompresi, serta tema gelap (*Dark Mode*). Modul [`preprocessor.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/preprocessor.py) melakukan normalisasi sebelum OCR:

1. **Konversi Skala Abu-Abu (*Grayscale Conversion*):**
   Gambar diubah ke mode intensitas cahaya tunggal (`L`).
2. **Deteksi Otomatis & Inversi Tema Gelap (*Dark Mode Inversion*):**
   Tesseract OCR dilatih paling optimal pada teks hitam di atas latar belakang putih. Sistem menghitung rata-rata luminans gambar:
   ```python
   def detect_dark_mode(img: Image.Image) -> bool:
       gray = img.convert("L")
       avg_luminance = np.mean(np.array(gray))
       return avg_luminance < 110.0 # Rata-rata < 110 menunjukkan tema gelap
   ```
   Jika terdeteksi tema gelap, gambar diinversi (`ImageOps.invert`) sehingga teks putih di atas latar hitam berubah menjadi teks hitam di atas latar putih.
3. **Peningkatan Kontras 1.8x (*Contrast Enhancement*):**
   Menggunakan `ImageEnhance.Contrast(gray).enhance(1.8)` untuk mempertegas batas glif huruf terhadap latar belakang.
4. **Penajaman Tepi (*Edge Sharpening Filter*):**
   Menerapkan filter `ImageFilter.SHARPEN` untuk memulihkan ketajaman teks ulasan yang buram akibat kompresi JPEG.

### 6.3 Ekstraksi Teks dengan Tesseract OCR Bilingual
Modul [`engine.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/engine.py) mengekstraksi seluruh teks pada gambar tangkapan layar ulasan:
```python
text = pytesseract.image_to_string(processed, lang="ind+eng").strip()
```
* **Bahasa Bilingual (`ind+eng`):** Mengombinasikan korpus bahasa Indonesia (untuk nama khas Indonesia dan kata pengantar antarmuka PLN Mobile) dan bahasa Inggris (untuk istilah Play Store seperti *Reviews*, *Rated*, *Helpful*).

### 6.4 Sidik Jari Kriptografis Gambar (*Perceptual Hashing*) & Anti-Fraud
Untuk menghentikan kecurangan petugas lapangan yang mengunggah gambar bukti yang sama berulang kali di hari berbeda atau untuk pelanggan yang berbeda:
1. **Perceptual Hash (pHash) 64-bit:**  
   Modul [`hasher.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/hasher.py) menghitung koefisien frekuensi *Discrete Cosine Transform (DCT)* dari citra dan menghasilkan kode hex 16 karakter (contoh: `d4e2a89c3b10f54a`).
2. **Perhitungan Jarak Hamming (*Hamming Distance*):**  
   Jarak Hamming mengukur jumlah perbedaan bit antar dua hash (rentang 0 hingga 64 bit):
   ```python
   def hamming_distance(hash1: str, hash2: str) -> int:
       xor_val = int(hash1, 16) ^ int(hash2, 16)
       return bin(xor_val).count("1")
   ```
3. **Kriteria Deteksi Manipulasi Visual:**
   * **Jarak = 0:** Gambar identik persis 100%.
   * **1 <= Jarak <= 5:** Gambar yang sama yang dipotong sedikit (*cropped*), dikompresi ulang, atau diedit kecerahannya.
   * **Jarak > 5:** Dua gambar yang berbeda secara visual.
4. **Tindakan Otomatis Anti-Fraud:**  
   Jika ditemukan review lain dengan jarak Hamming <= 5, ulasan langsung ditandai dengan status `REJECTED`, flag `isDuplicate = true`, dan ditautkan ke ulasan asli melalui `duplicateOfId` (*soft-flagging*).

### 6.5 Pencocokan Toleran Teks (*Fuzzy String Matching*)
Untuk memvalidasi kesesuaian antara nama pengulas yang diinput pada formulir (*Column 4*) dengan teks tangkapan layar Play Store, modul [`matcher.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/matcher.py) menggunakan pustaka `RapidFuzz`:
1. **Normalisasi String:** Teks diubah ke huruf kecil, karakter khusus/emoji dihilangkan, dan spasi ganda diringkas.
2. **Kalkulasi Skor Ganda:**
   * `score_partial`: Menguji kecocokan substring terbaik (efektif jika tangkapan layar memuat banyak teks ulasan lain di sekitar nama pengulas).
   * `score_token_set`: Mengabaikan urutan kata (misal: "Budi Santoso" cocok dengan "Santoso, Budi").
   * Skor akhir adalah nilai tertinggi: `final_score = max(score_partial, score_token_set)`.

### 6.6 Sistem Triase Tiga Zona (*Tri-Zone Confidence Score*)
Berdasarkan nilai skor kemiripan, sistem secara otonom menentukan status validasi (menggantikan pemberian tanda centang manual pada Column 12 lama):

```
       0%                          70%                     90%             100%
       ├─── ZONA MERAH (REJECTED) ──┼─── ZONA KUNING (REVIEW) ──┼─── ZONA HIJAU (APPROVED) ──┤
```

1. **Zona Hijau (Skor >= 90.0%):**
   * **Status:** `APPROVED` (Disetujui Otomatis).
   * **Keterangan:** Nama pengulas pada tangkapan layar cocok sempurna dengan data entri. Ulasan langsung dihitung ke dalam capaian realisasi harian ULP/UP3 tanpa intervensi manusia.
2. **Zona Kuning (70.0% <= Skor < 90.0%):**
   * **Status:** `NEEDS_REVIEW` (Perlu Peninjauan Operator).
   * **Keterangan:** Terdapat salah eja kecil (*typo*), huruf terpotong oleh resolusi rendah, atau nama akun Play Store memiliki imbuhan karakter unik. Ulasan ditahan di Dasbor Triase Pegawai untuk diverifikasi secara cepat melalui satu klik tanpa membuka Google Drive.
3. **Zona Merah (Skor < 70.0%):**
   * **Status:** `REJECTED` (Ditolak Otomatis).
   * **Keterangan:** Tangkapan layar salah, bukti ulasan tidak memuat nama pelanggan yang bersangkutan, atau indikasi manipulasi data.

---

## 7. Rangkuman Metrik & Keunggulan Sistem Baru

| Aspek Operasional | Alur Kerja Sistem Lama (Google Form & Spreadsheet) | Alur Kerja Sistem Baru (GORO S2JB Pipeline) |
| :--- | :--- | :--- |
| **Kapasitas Volume Baris** | Terbatas (sering *freeze* dan pecah menjadi CSV statis di atas 100.000 baris) | Tidak terbatas (arsitektur PostgreSQL relasional dengan streaming chunking) |
| **Kecepatan Impor Data** | Lambat dan sering memicu *Out of Memory* pada server | Rata-rata 2.000 baris per 200 ms via BullMQ worker terisolasi |
| **Validasi Bukti Eviden** | Manual: Pegawai membuka link Google Drive satu per satu | Otomatis: Pipeline AI Vision Tesseract OCR + RapidFuzz |
| **Akses Berkas Gambar** | Rentan gagal karena kendala izin akses publik (*403 Access Denied*) | Terpusat di Local Storage server dengan pengamanan anti-traversal |
| **Deteksi Kecurangan** | Mengandalkan kolom Timestamp dan teks nama (banyak *false positive*) | Perceptual Hash (pHash) 64-bit dengan deteksi jarak Hamming <= 5 |
| **Penanganan Baris Kosong** | Baris formula dihitung sebagai galat dan membengkakkan log | *Early-Exit EOF Detector* menghentikan pembacaan secara instan |
| **Pemulihan Sesi** | Jika tab tertutup, proses harus diulang dari awal baris pertama | *Resumable Checkpointing*: Melanjutkan dari baris terakhir (`lastProcessedRow`) |
