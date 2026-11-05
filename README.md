# GORO S2JB - Command Center Rating & Review PLN Mobile UID S2JB

Sistem otomasi validasi bukti ulasan rating bintang 5 aplikasi PLN Mobile berbasis Optical Character Recognition (OCR), pencocokan fuzzy Levenshtein, deteksi anti-fraud perceptual hash (pHash), dan antrian asinkron BullMQ.

Sistem ini dirancang sepenuhnya mendukung lintas platform (*cross-platform*) untuk **macOS**, **Windows**, dan **Linux**, serta ditenagai mesin komputasi performa tinggi berbasis **Rust Native Engine (`goro-engine`)** dengan dukungan peluncur universal satu perintah (*single-command runner*) dan skrip diagnosa kesiapan sistem otomatis.

---

## 1. Pengecekan Kesiapan Sistem Lintas Platform (*System Readiness Check*)

Sebelum memulai instalasi atau menjalankan aplikasi, Anda dapat memverifikasi kesiapan seluruh dependensi dan subsistem (Node.js, Rust/Cargo, Tesseract OCR, PostgreSQL, Redis, Docker, dan berkas konfigurasi) hanya dengan **satu perintah**:

```bash
npm run check:system
```

Skrip ini bekerja otomatis di **macOS**, **Linux**, maupun **Windows** untuk mengaudit 10 aspek kritis:
1. **Node.js Runtime**: Memverifikasi ketersediaan Node.js v20.x atau v22.x LTS.
2. **npm Package Manager**: Memastikan versi npm telah terpasang.
3. **Rust & Cargo Compiler**: Memeriksa ketersediaan `cargo` dan `rustc` v1.80+.
4. **Biner Rilis `goro-engine`**: Memeriksa kesiapan biner hasil kompilasi native di `rust-services/goro-engine/target/release/`.
5. **Tesseract OCR & Models**: Memeriksa CLI `tesseract` dan ketersediaan paket bahasa `ind` dan `eng`.
6. **Aset Mandiri tessdata Rust**: Memvalidasi model bahasa lokal di `rust-services/goro-engine/tessdata/`.
7. **PostgreSQL Database**: Memeriksa soket TCP port 5432 aktif dan menerima koneksi.
8. **Redis Broker (BullMQ)**: Memeriksa soket TCP port 6379 aktif dan menerima koneksi.
9. **Konfigurasi Environment**: Memeriksa keberadaan berkas `.env` beserta kelengkapan variabel kritis (`DATABASE_URL`, `REDIS_URL`).
10. **Docker & Docker Compose**: Memeriksa kesiapan Docker untuk deployment berbasis kontainer.

---

## 2. Prasyarat Sistem (*Prerequisites*)

Sebelum menjalankan project untuk pertama kali, pastikan software berikut telah terpasang pada komputer Anda:

| Komponen | Versi Minimum | Keterangan |
| :--- | :--- | :--- |
| **Node.js** | v20.x atau v22.x LTS | Runtime JavaScript/TypeScript utama |
| **npm** | v10.x+ | Package manager bawaan Node.js |
| **Rust & Cargo** | v1.80+ (disarankan) | Engine native performa tinggi (`goro-engine`) via C-API In-Memory |
| **Python** | 3.10+ (disarankan 3.11) | Engine Microservice OCR FastAPI (sebagai cadangan/fallback) |
| **PostgreSQL** | v15+ atau v16+ | Basis data relasional utama (Port 5432) |
| **Redis** | v7.x+ | Message broker BullMQ queue (Port 6379) |
| **Tesseract OCR** | v5.x+ | Engine OCR dengan dukungan bahasa Indonesia (`ind`) dan Inggris (`eng`) |

---

## 3. Panduan Setup Pertama Kali (Setelah Clone dari GitHub)

### Cara Cepat 1-Perintah (Universal Auto-Dispatcher)

Project telah dilengkapi launcher setup cerdas yang otomatis mendeteksi platform sistem operasi Anda (macOS, Linux, atau Windows):

```bash
npm run setup:all
```

Perintah ini akan secara otomatis:
1. Menginstal dependensi Node.js (`npm install`).
2. Mengompilasi Rust Native Vision Engine (`npm run rust:build`).
3. Menyiapkan berkas environment `.env` dari `.env.example`.
4. Menjalankan migrasi basis data Prisma (`npx prisma migrate dev`).
5. Melakukan seeding data awal kredensial pengguna (`npm run prisma:seed`).

---

### Cara Setup Spesifik per Sistem Operasi

#### A. macOS
```bash
# 1. Pastikan dependensi sistem terpasang via Homebrew:
brew install node rust postgresql@16 redis tesseract tesseract-lang

# 2. Jalankan skrip setup:
npm run setup:mac
# atau
./scripts/setup-mac.sh
```

#### B. Windows (PowerShell)
```powershell
# 1. Pastikan Node.js, Rust (rustup), PostgreSQL, dan Redis terpasang.
# 2. Unduh installer Tesseract Windows (UB-Mannheim) dan centang 'Indonesian'.
# 3. Jalankan skrip setup di PowerShell:
npm run setup:win
# atau klik dua kali:
.\scripts\setup-windows.bat
```

#### C. Linux (Ubuntu / Debian / Fedora / Arch)
```bash
# 1. Pasang dependensi distro (contoh Ubuntu/Debian):
sudo apt update && sudo apt install -y nodejs npm cargo rustc postgresql redis-server tesseract-ocr tesseract-ocr-ind libtesseract-dev clang pkg-config

# 2. Jalankan skrip setup:
npm run setup:linux
# atau
./scripts/setup-linux.sh
```

---

### Cara Kompilasi Manual Rust Native Engine

Jika Anda ingin mengompilasi atau menguji Rust Native Engine secara terpisah:

```bash
# Kompilasi binary rilis teroptimasi:
npm run rust:build
# atau: cargo build --release --manifest-path rust-services/goro-engine/Cargo.toml

# Menjalankan unit test Rust (22/22 tests):
npm run rust:test
# atau: cargo test --manifest-path rust-services/goro-engine/Cargo.toml
```

---

### Cara Kontainerisasi Penuh: Deploy Server Ubuntu via Docker (Zero-Host Dirt)

Jika Anda ingin mendeploy di server Ubuntu (atau cloud VPS) **tanpa mengotori sistem operasi host** dengan instalasi Node.js, Python, Rust, Tesseract, PostgreSQL, atau Redis, gunakan Docker Compose. Seluruh dependensi, compiler, model OCR, dan database terisolasi penuh di dalam kontainer.

#### 1. Prasyarat Host Ubuntu
Hanya membutuhkan Docker Engine dan Docker Compose:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
```

#### 2. Jalankan Seluruh Sistem Sekaligus (1 Perintah)
```bash
# Salin konfigurasi environment default (opsional jika ingin kustomisasi password)
cp .env.example .env

# Build dan nyalakan seluruh 6 kontainer di latar belakang:
docker compose up -d --build
```

Arsitektur kontainer yang otomatis dibuat dan dihubungkan dalam jaringan internal (`goro_network`):
- `goro-postgres` : Basis data PostgreSQL 16 Alpine (Port host 5432)
- `goro-redis` : Message broker Redis 7 Alpine (Port host 6379)
- `goro-ocr-engine` : Rust Native Vision Engine dengan libtesseract & model ind/eng (Port host 8001)
- `goro-web-app` : Next.js 15 Web Server dengan auto-migration Prisma & auto-seed akun awal (Port host 3000)
- `goro-worker-ocr` : Background worker BullMQ OCR processing
- `goro-worker-import` : Background worker BullMQ Bulk CSV/Excel import

#### 3. Perintah Manajemen Kontainer
```bash
# Memeriksa status kesehatan seluruh kontainer:
docker compose ps

# Memantau log gabungan secara realtime:
docker compose logs -f

# Memantau log spesifik (misal Rust OCR Engine atau Web App):
docker compose logs -f ocr-engine
docker compose logs -f web-app

# Menghentikan seluruh sistem kontainer:
docker compose down
```

---

### Cara Manual (Langkah demi Langkah)

Jika Anda ingin melakukan inisialisasi secara manual:

1. **Clone & Masuk ke Folder Project:**
   ```bash
   git clone https://github.com/DikhaAG/goro-s2jb.git
   cd goro-s2jb
   ```

2. **Siapkan File Konfigurasi Environment:**
   ```bash
   cp .env.example .env
   ```
   Sesuaikan `DATABASE_URL` jika user/password PostgreSQL lokal Anda berbeda (misal `postgres:postgres` pada Windows/Linux).

3. **Instal Dependensi Node.js:**
   ```bash
   npm install
   ```

4. **Kompilasi Rust Native Engine (Prioritas Utama):**
   ```bash
   npm run rust:build
   ```

5. **Siapkan Python Virtual Environment (Fallback):**
   - **macOS / Linux:**
     ```bash
     python3 -m venv python-services/ocr/venv
     source python-services/ocr/venv/bin/activate
     pip install --upgrade pip
     pip install -r python-services/ocr/requirements.txt
     deactivate
     ```
   - **Windows (PowerShell):**
     ```powershell
     python -m venv python-services\ocr\venv
     .\python-services\ocr\venv\Scripts\Activate.ps1
     pip install --upgrade pip
     pip install -r python-services\ocr\requirements.txt
     deactivate
     ```

6. **Inisialisasi Database (Prisma):**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```

---

## 4. Menjalankan Aplikasi (*Run Application*)

Sistem GORO S2JB terdiri dari 4 subsistem proses utama:
1. **Web Server** (Next.js - Port 3000)
2. **Vision & Anti-Fraud OCR Engine** (Port 8001: Rust Native Engine dengan C-API In-Memory)
3. **Background Worker BullMQ OCR** (Pemrosesan pengenalan citra & pHash)
4. **Background Worker BullMQ Bulk Import** (Parsing CSV / Excel puluhan ribu baris)

### Menjalankan Sekaligus (*All-in-One Launcher*)

#### Opsi 1: Perintah Universal (Semua OS)
Cukup jalankan satu perintah berikut di terminal mana pun:

```bash
npm run start:all
```
Dispatcher otomatis mendeteksi platform Anda (macOS, Linux, atau Windows) dan menjalankan runner native yang dioptimalkan untuk sistem operasi tersebut.

#### Opsi 2: Perintah Khusus OS
- **macOS:**
  ```bash
  npm run start:mac
  # atau: bash scripts/start-mac.sh 2>&1 | tee logs/system_runtime.log
  ```
- **Windows (PowerShell):**
  ```powershell
  npm run start:win
  # atau klik dua kali: .\scripts\start-windows.bat
  ```
- **Linux:**
  ```bash
  npm run start:linux
  # atau: ./scripts/start-linux.sh
  ```

> **Catatan Smart Priority & Fallback:**
> Skrip launcher akan otomatis memeriksa ketersediaan biner rilis `rust-services/goro-engine/target/release/goro-engine`. Jika biner rilis Rust terdeteksi, launcher akan langsung menyalakan **Rust Native Engine** (5x - 10x lebih cepat, model Tesseract warm di RAM, in-memory zero-disk streaming). Jika biner Rust belum dikompilasi dan folder `python-services` masih ada, launcher dapat beralih menggunakan Python sebagai fallback.

### Menjalankan Secara Terpisah (Manual Terminal)

Buka 4 tab terminal terpisah jika ingin memantau log masing-masing komponen:
- **Terminal 1 (Web Server):** `npm run dev`
- **Terminal 2 (OCR Engine Port 8001):**
  - **Opsi Utama (Rust Native Engine):**
    ```bash
    npm run rust:dev
    # atau: ./rust-services/goro-engine/target/release/goro-engine --host 127.0.0.1 --port 8001
    ```
- **Terminal 3 (Worker OCR):** `npm run worker:ocr`
- **Terminal 4 (Worker Import):** `npm run worker:import`

---

## 5. Kredensial Pengguna Awal (*Default Seed Accounts*)

Semua akun default menggunakan kata sandi: `password123`

| Peran (Role) | Username | Akses URL Utama | Deskripsi Tugas |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `/users`, `/system-processes` | Manajemen user, audit log, monitoring server |
| **Manager UID S2JB** | `manager_s2jb` | `/reports` | Analitik, monitoring KPI unit, ekspor laporan |
| **Pegawai Operator** | `pegawai_operator` | `/reviews`, `/triage` | Triase manual zona kuning/merah, kelola ulasan |
| **Petugas Lapangan** | `petugas_rivai` | `/intake` | Form input ulasan dan unggah bukti baru |

---

## 6. Pemeriksaan Kesehatan & Pengujian

- **Next.js Web Health Check:** `http://localhost:3000/api/health`
- **OCR Engine Health Check:** `http://127.0.0.1:8001/health`
- **Diagnostik Kesiapan Sistem Lintas Platform:**
  ```bash
  npm run check:system
  ```
- **Jalankan Seluruh Test Suite Rust:**
  ```bash
  npm run rust:test
  ```
- **Jalankan Seluruh Test Suite Vitest:**
  ```bash
  npm test
  ```
- **Pemeriksaan Tipe TypeScript:**
  ```bash
  npm run typecheck
  ```

---

## 7. Struktur Branch Git & Riwayat Migrasi

Repositori ini mengelola dua cabang utama untuk memastikan stabilitas dan arsip implementasi:

1. **`main` (Cabang Utama / Aktif)**
   - Berisi arsitektur terbaru berbasis **Rust Native Vision Engine (`goro-engine`)**.
   - Dilengkapi pipeline zero-disk storage, komputasi perceptual hash (pHash 64-bit DCT), pencocokan Levenshtein/LCS multithreading, antarmuka monitoring sistem realtime, dan peluncur lintas platform.
2. **`legacy-python-services` (Cabang Arsip)**
   - Mengarsipkan kondisi commit terakhir sebelum migrasi (`dc5010c`).
   - Menyimpan implementasi microservice Python (FastAPI, Uvicorn, Pillow, RapidFuzz, Pytesseract) untuk keperluan audit, perbandingan benchmark historis, atau verifikasi backward-compatibility.

