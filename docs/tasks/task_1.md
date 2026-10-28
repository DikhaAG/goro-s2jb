# Task 1: Lapisan Teknis Global (Global Foundation)

> **Status:** Draft / Ready for Engineering Execution  
> **Fase:** 1 (Lapisan Teknis Global)  
> **Target Audiens:** Lead Architect, Full-Stack Engineer, Database Architect, AI/Vision Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 3: Arsitektur Fundamental, Bagian 5: RBAC)
> - [`docs/GORO S2JB 2026 (Jawaban).xlsx`](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx) (Skema lembar kerja acuan)
> - [`.agents/skills/improve-codebase-architecture/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/improve-codebase-architecture/)
> - [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/)
> - [`.agents/skills/frontend-design/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-design/)

---

## 1. Ringkasan & Tujuan Task

Membangun pondasi teknis menyeluruh (*Global Technical Foundation*) untuk aplikasi GORO S2JB 2026. Fondasi ini mencakup penyiapan kerangka kerja utama berbasis **Next.js 16 (App Router) + React 19**, penataan sistem desain taktis (**Tailwind CSS v4 + shadcn/ui**), perancangan skema basis data relasional (**PostgreSQL + Prisma ORM**) yang memetakan 13 kolom lembar kerja historis dan 3 peran RBAC, lapisan komunikasi *type-safe* (**tRPC v11**), antrean latar belakang (**Redis + BullMQ**), mesin penyimpanan lokal gambar eviden terstruktur (**Local File System Storage**), serta *microservice* lokal Python untuk **OCR & Perceptual Hashing (pHash)**.

---

## 2. Struktur Direktori Target Proyek

```
goro-s2jb/
├── .agents/                        # Konfigurasi skill dan aturan AI
├── docs/                           # Dokumentasi PRD, Excel acuan, dan task breakdown
│   ├── tasks/
│   │   └── task_1.md               # [File ini]
│   ├── GORO S2JB 2026 (Jawaban).xlsx
│   └── PRD.md
├── prisma/
│   ├── schema.prisma               # Definisi skema PostgreSQL & Prisma ORM
│   └── seed.ts                     # Seeding awal master data (UP3, ULP, Target, Admin)
├── python-services/
│   └── ocr/
│       ├── main.py                 # FastAPI / CLI OCR & pHash extractor
│       ├── requirements.txt        # Dependensi Python (pytesseract/paddleocr, pillow, imagehash)
│       └── tests/
│           └── test_ocr.py
├── uploads/                        # Local Storage Server (Git-ignored)
│   └── .gitkeep
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── trpc/[trpc]/route.ts# tRPC HTTP Handler
│   │   │   └── uploads/[...path]/route.ts # Secure Local File Serving
│   │   ├── layout.tsx              # Root Layout dengan tema taktis
│   │   └── page.tsx                # Halaman muka / navigasi status
│   ├── components/
│   │   └── ui/                     # Komponen shadcn/ui primitives
│   ├── lib/
│   │   ├── prisma.ts               # Prisma Client Singleton
│   │   ├── redis.ts                # Redis Client Connection Pool
│   │   └── storage.ts              # Utilitas operasi Local File System
│   ├── server/
│   │   ├── context.ts              # tRPC Request Context (Session & DB)
│   │   ├── trpc.ts                 # Inisialisasi tRPC & Prosedur RBAC
│   │   ├── routers/
│   │   │   ├── _app.ts             # Root App Router
│   │   │   ├── health.ts           # Health-check router
│   │   │   ├── auth.ts             # Autentikasi dasar & sesi peran
│   │   │   └── master.ts           # Master data UP3, ULP, Versi
│   │   └── queues/
│   │       ├── ocrQueue.ts         # BullMQ OCR Queue & Worker
│   │       └── importQueue.ts      # BullMQ CSV/XLSX Import Queue
│   └── types/
│       └── index.ts                # TypeScript Global Definitions
├── .env.example                    # Template variabel lingkungan
├── package.json                    # Konfigurasi paket Node.js
├── tailwind.config.ts              # Konfigurasi Tailwind CSS v4
└── tsconfig.json                   # Konfigurasi TypeScript ketat
```

---

## 3. Instruksi Teknis Rinci (Sub-Tasks)

### 3.1 Inisiasi Proyek & Sistem Desain (Sub-track 1.1)
1. **Inisialisasi Kerangka Kerja:**
   * Inisialisasi Next.js 16 (App Router) dengan TypeScript versi terbaru, ESLint, dan arsitektur direktori `src/`.
   * Konfigurasi `tsconfig.json` dengan `strict: true`, path alias `@/*` mengarah ke `./src/*`.
2. **Sistem Desain Taktis (Tailwind CSS v4 & shadcn/ui):**
   * Pasang Tailwind CSS v4 dan integrasikan dengan sistem token variabel CSS (`globals.css`).
   * Pasang dan inisialisasi primitives `shadcn/ui` (Button, Card, Input, Label, Badge, Dialog, Toast/Sonner, Skeleton).
   * Terapkan palet warna taktis korporat PLN (dominasi deep slate/navy, cool zinc, dan aksen cyan elektrik/amber hangat) yang ramah untuk command center dan monitoring operasional.

### 3.2 Pemodelan Skema Basis Data Relasional (Sub-track 1.2)
1. **Inisialisasi Prisma ORM & PostgreSQL:**
   * Inisialisasi Prisma ORM dengan penyedia basis data PostgreSQL (`provider = "postgresql"`).
   * Konfigurasi koneksi `DATABASE_URL` pada `.env`.
2. **Pemodelan Data Master & Relasi Operasional (Mengacu ke Excel):**
   Berdasarkan lembar *Form Responses 1*, *note*, dan *Laporan Harian/Bulanan*:
   * **`enum Role`:** `PETUGAS_LAPANGAN`, `PEGAWAI`, `MANAGER`, `SUPER_ADMIN`.
   * **`enum ValidationStatus`:** `PENDING`, `APPROVED`, `REJECTED`, `NEEDS_REVIEW`.
   * **`model User`:** Akun pengguna, username/email, password hash, role, relasi ke UP3/ULP penugasan.
   * **`model UP3`:** Kode UP3, nama UP3 (misal: "UP3 PALEMBANG", "UP3 OGAN ILIR"), relasi ke banyak ULP.
   * **`model ULP`:** Kode ULP, nama ULP (misal: "ULP RIVAI", "ULP KENTEN", "ULP CURUP"), foreign key ke UP3.
   * **`model AppVersion`:** Versi PLN Mobile (misal: "V5.2.79", "V5.2.75", "V5.2.70"), status aktif.
   * **`model TargetMaster`:** Master target harian dan kumulatif per ULP per tanggal (mereplikasi sheet *note*):
     - `ulpId`, `targetDate`, `dailyTarget` (Float/Int), `cumulativeTarget` (Float/Int).
   * **`model RatingReview` (Tabel Inti 13 Kolom):**
     - `id`: CUID / UUID Primary Key
     - `timestamp`: DateTime (Kolom 1 pada form asli)
     - `up3Id`: Relation ke UP3 (Kolom 2)
     - `ulpId`: Relation ke ULP (Kolom 3)
     - `playstoreReviewerName`: String (Kolom 4: Nama Pengulas Play Store)
     - `entryDate`: DateTime (Kolom 5: Tanggal Entri)
     - `evidenceImagePath`: String (Kolom 6: Path lokal penyimpanan berkas eviden)
     - `evidenceImageHash`: String? (Perceptual Hash pHash 64-bit untuk deteksi duplikasi gambar)
     - `appVersionId`: Relation ke AppVersion (Kolom 7: Versi PLN Mobile)
     - `originalReviewerName`: String (Kolom 8: Nama Asli Pengulas dari Akun/Input)
     - `reviewerCategory`: String (Kolom 9: Kategori pengulas, default "Pelanggan")
     - `fieldNotes`: String? (Kolom 10: Catatan tambahan)
     - `isDuplicate`: Boolean (Kolom 11: Indikator duplikasi TIDAK/YA, default `false`)
     - `duplicateOfId`: String? (Self-relation ke `RatingReview` sebelumnya untuk mekanisme *soft-flagging*)
     - `validationStatus`: `ValidationStatus` (Kolom 12: Ekivalen dengan TRUE/1 atau FALSE/0, default `PENDING`)
     - `confidenceScore`: Float? (Skor kemiripan fuzzy matching 0.0 - 100.0)
     - `extractedOcrText`: Text? (Teks hasil ekstraksi OCR gambar eviden)
     - `reviewRemarks`: String? (Kolom 13: Keterangan status validasi / catatan verifikator)
     - `submittedById`: String? (Relasi ke User - Petugas Lapangan)
     - `verifiedById`: String? (Relasi ke User - Pegawai Operator)
     - `verifiedAt`: DateTime? (Waktu intervensi manual)
     - Indexing: Index pada `timestamp`, `entryDate`, `ulpId`, `evidenceImageHash`, dan `validationStatus`.
3. **Seeding Script (`prisma/seed.ts`):**
   * Buat skrip seeder otomatis untuk mempopulasikan daftar UP3 dan ULP berdasarkan sampel pada berkas `docs/GORO S2JB 2026 (Jawaban).xlsx`, serta membuat akun awal untuk 3 peran (*Petugas Lapangan*, *Pegawai*, *Manager*).

### 3.3 Lapisan Komunikasi Type-Safe (tRPC v11) (Sub-track 1.3)
1. **Inisialisasi tRPC:**
   * Pasang `@trpc/server@next`, `@trpc/client@next`, `@trpc/react-query@next`, `@tanstack/react-query`.
   * Bangun context request pada `src/server/context.ts` (menyertakan Prisma client dan identitas pengguna).
   * Konfigurasi middleware keamanan berbasis peran (`protectedProcedure`, `fieldProcedure`, `operatorProcedure`, `executiveProcedure`).
2. **Definisi Routers Inti:**
   * `health`: Query ping dan status koneksi database/Redis.
   * `master`: Query daftar UP3, ULP aktif, dan versi aplikasi untuk kebutuhan form input dan filter laporan.
   * `auth`: Prosedur login, logout, dan query sesi aktif.

### 3.4 Antrean Latar Belakang (Redis & BullMQ) (Sub-track 1.4)
1. **Koneksi Redis (`src/lib/redis.ts`):**
   * Buat client koneksi Redis menggunakan `ioredis` dengan konfigurasi retry backoff dan error handling.
2. **Setup BullMQ Queues (`src/server/queues/`):**
   * **`ocrQueue`:** Antrean untuk pemrosesan OCR asinkron dari eviden gambar baru.
   * **`importQueue`:** Antrean untuk pemrosesan *batch import* file CSV/XLSX historis bervolume besar (>100.000 baris) agar tidak membebani memori proses utama Node.js.
3. **Scaffolding Worker:**
   * Kerangka worker yang dapat dijalankan secara terpisah via proses background (`npm run worker:ocr`).

### 3.5 Sistem Penyimpanan Berkas Lokal (Local Storage Engine) (Sub-track 1.5)
1. **Struktur Direktori Penyimpanan:**
   * Folder root: `./uploads/evidence/{YYYY}/{MM}/{DD}/`.
   * Skrip inisialisasi folder otomatis jika direktori belum tersedia (`src/lib/storage.ts`).
2. **Rute Penyajian Berkas Statis Terproteksi:**
   * Buat route handler pada `src/app/api/uploads/[...path]/route.ts`.
   * Pasang mekanisme pengamanan:
     - Validasi *path traversal* (mencegah akses direktori di luar `uploads/` via `path.normalize`).
     - Validasi MIME type (hanya menerima dan menyajikan gambar: `.jpg`, `.jpeg`, `.png`, `.webp`).
     - Otorisasi sesi pengguna untuk melihat file bukti eviden.

### 3.6 Microservice Python OCR & Perceptual Hashing (Sub-track 1.6)
1. **Struktur Microservice (`python-services/ocr/`):**
   * Buat lingkungan Python lokal menggunakan FastAPI atau script CLI mandiri.
   * Dependensi pada `requirements.txt`:
     - `pytesseract` atau `paddleocr`
     - `Pillow`
     - `imagehash` (untuk kalkulasi pHash 64-bit)
     - `rapidfuzz` (untuk perbandingan fuzzy matching nama pengulas)
2. **Spesifikasi Kontrak I/O Service:**
   * **Input:** Path absolut gambar eviden lokal dan teks target nama pengulas (*Column 4*).
   * **Output (JSON):**
     ```json
     {
       "success": true,
       "extracted_text": "...",
       "phash": "a7b3c2d4e5f60812",
       "similarity_score": 94.5,
       "zone": "GREEN",
       "recommended_status": "APPROVED"
     }
     ```
3. **Konektor Node.js / TypeScript Bridge:**
   * Buat modul adapter di TypeScript (`src/server/services/ocrService.ts`) yang memanggil Python microservice melalui HTTP lokal atau *spawn child process* terisolasi.

---

## 4. Kriteria Penerimaan (Acceptance Criteria)

- [ ] **AC-1 (Project Setup):** Proyek Next.js 16 berhasil dikompilasi tanpa error (`npm run build`), TypeScript type-check lulus tanpa kompromi (`npm run typecheck`), dan antarmuka dasar dapat diakses di `http://localhost:3000`.
- [ ] **AC-2 (Database Connectivity & Migration):** Prisma berhasil melakukan migrasi (`npx prisma migrate dev`) ke PostgreSQL lokal. Seluruh model (`User`, `UP3`, `ULP`, `AppVersion`, `TargetMaster`, `RatingReview`) terbentuk sempurna dengan constraint dan relasi foreign key yang benar.
- [ ] **AC-3 (Data Seeding):** Perintah `npm run prisma:seed` berhasil mengeksekusi pengisian master data UP3 dan ULP yang cocok dengan struktur unit di `docs/GORO S2JB 2026 (Jawaban).xlsx`, serta membuat 3 akun pengguna contoh (Petugas Lapangan, Pegawai, Manager).
- [ ] **AC-4 (tRPC Connection):** Klien React dapat memanggil prosedur `trpc.health.ping` dan `trpc.master.getUnits` dengan *type-safety* 100% tanpa manual casting.
- [ ] **AC-5 (Redis & Queue Heartbeat):** Redis terhubung dengan baik. BullMQ dapat menerima *dummy job* pada `ocrQueue` dan memprosesnya melalui worker tanpa kegagalan koneksi.
- [ ] **AC-6 (Local Storage Engine):** Pengujian penyimpanan file ke direktori `./uploads/` berhasil, dan berkas gambar yang tersimpan dapat disajikan kembali melalui endpoint aman `GET /api/uploads/...` dengan header `Content-Type` yang sesuai. Upaya *path traversal* (seperti `../`) ditolak dengan kode status HTTP 403/400.
- [ ] **AC-7 (Python OCR & pHash Standalone Check):** Skrip Python OCR lokal dapat menerima satu sampel gambar eviden, mengembalikan teks ekstraksi, menghasilkan hash `pHash` heksadesimal, serta menghitung skor kemiripan fuzzy matching terhadap nama pengulas contoh.

---

## 5. Matriks Berkas yang Dibuat / Diubah

| Jalur Berkas | Aksi | Deskripsi Perubahan |
| :--- | :--- | :--- |
| `package.json` | Dibuat | Dependensi Next.js, React, Tailwind, Prisma, tRPC, BullMQ, ioredis |
| `tsconfig.json` | Dibuat | Konfigurasi TypeScript strict mode dan path aliases |
| `tailwind.config.ts` & `src/app/globals.css` | Dibuat | Token warna taktis, tema korporat PLN, dan styling shadcn/ui |
| `prisma/schema.prisma` | Dibuat | Skema basis data PostgreSQL, tabel 13 kolom, relasi, dan enum RBAC |
| `prisma/seed.ts` | Dibuat | Skrip seeding master UP3, ULP, versi aplikasi, dan akun pengujian |
| `src/lib/prisma.ts` | Dibuat | Instansiasi singleton PrismaClient |
| `src/lib/redis.ts` | Dibuat | Client koneksi Redis dengan konfigurasi connection pool |
| `src/lib/storage.ts` | Dibuat | Utilitas validasi, penyimpanan, dan sanitasi berkas lokal |
| `src/server/context.ts` | Dibuat | Konteks tRPC (database, user session) |
| `src/server/trpc.ts` | Dibuat | Inisialisasi tRPC dan middleware penjaga otorisasi peran |
| `src/server/routers/_app.ts` | Dibuat | Router tRPC utama (menggabungkan sub-routers) |
| `src/server/routers/health.ts` | Dibuat | Prosedur kesehatan infrastruktur (DB & Redis status) |
| `src/server/routers/master.ts` | Dibuat | Prosedur query data master UP3, ULP, dan Versi |
| `src/server/queues/ocrQueue.ts` | Dibuat | Konfigurasi BullMQ queue untuk pemrosesan OCR asinkron |
| `src/app/api/trpc/[trpc]/route.ts` | Dibuat | Route handler Next.js App Router untuk request tRPC |
| `src/app/api/uploads/[...path]/route.ts` | Dibuat | Route handler penyajian berkas eviden dari local disk |
| `python-services/ocr/main.py` | Dibuat | Layanan lokal Python untuk OCR Tesseract/PaddleOCR dan pHash |
| `python-services/ocr/requirements.txt` | Dibuat | Dependensi Python OCR, image processing, dan fuzzy matching |
| `.env.example` | Dibuat | Template konfigurasi environment (DATABASE_URL, REDIS_URL, STORAGE_PATH) |

---

## 6. Titik Uji & Pengujian (TDD Seams)

Mengikuti panduan `.agents/skills/tdd/SKILL.md`:
1. **Database Seam:** Tes unit/integrasi pada fungsi query data master untuk memastikan relasi `UP3 -> ULP` dan format skema tabel `RatingReview` konsisten.
2. **Storage Seam:** Tes pada utilitas `storage.ts` untuk memastikan fungsi penyimpanan otomatis membuat direktori berbasis tanggal, memvalidasi ekstensi gambar, dan memblokir upaya *directory traversal*.
3. **Queue Seam:** Tes integrasi BullMQ untuk memastikan job berhasil masuk antrean (`addJob`) dan ditangkap oleh handler worker.
4. **OCR Service Seam:** Tes pemanggilan subprocess/HTTP ke microservice Python dengan dummy image untuk memastikan respons JSON memiliki struktur atribut yang valid.
