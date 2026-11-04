# GORO S2JB - Command Center Rating & Review PLN Mobile UID S2JB

Sistem otomasi validasi bukti ulasan rating bintang 5 aplikasi PLN Mobile berbasis Optical Character Recognition (OCR), pencocokan fuzzy Levenshtein, deteksi anti-fraud perceptual hash (pHash), dan antrian asinkron BullMQ.

Sistem ini dirancang sepenuhnya mendukung lintas platform (*cross-platform*) untuk **macOS**, **Windows**, dan **Linux**.

---

## 1. Prasyarat Sistem (*Prerequisites*)

Sebelum menjalankan project untuk pertama kali, pastikan software berikut telah terpasang pada komputer Anda:

| Komponen | Versi Minimum | Keterangan |
| :--- | :--- | :--- |
| **Node.js** | v20.x atau v22.x LTS | Runtime JavaScript/TypeScript utama |
| **npm** | v10.x+ | Package manager bawaan Node.js |
| **Python** | 3.10+ (disarankan 3.11) | Engine Microservice OCR FastAPI |
| **PostgreSQL** | v15+ atau v16+ | Basis data relasional utama (Port 5432) |
| **Redis** | v7.x+ | Message broker BullMQ queue (Port 6379) |
| **Tesseract OCR** | v5.x+ | Engine OCR dengan dukungan bahasa Indonesia (`ind`) |

---

## 2. Panduan Setup Pertama Kali (Setelah Clone dari GitHub)

### Cara Cepat (Menggunakan Skrip Otomatis)

Project telah dilengkapi skrip otomasi end-to-end yang menginstal dependensi Node.js, membuat virtual environment Python, mengonfigurasi `.env`, menjalankan migrasi Prisma, dan melakukan *seed* data awal pengguna.

#### A. macOS
```bash
# 1. Pastikan dependensi sistem terpasang via Homebrew:
brew install node postgresql@16 redis tesseract tesseract-lang

# 2. Jalankan skrip setup:
npm run setup:mac
# atau
./scripts/setup-mac.sh
```

#### B. Windows (PowerShell)
```powershell
# 1. Pastikan Node.js, Python (centang 'Add to PATH'), PostgreSQL, dan Redis terpasang.
# 2. Unduh installer Tesseract Windows (UB-Mannheim) dan centang 'Indonesian'.
# 3. Jalankan skrip setup di PowerShell:
npm run setup:win
# atau
powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
```

#### C. Linux (Ubuntu / Debian / Fedora / Arch)
```bash
# 1. Pasang dependensi distro (contoh Ubuntu/Debian):
sudo apt update && sudo apt install -y nodejs npm postgresql redis-server tesseract-ocr tesseract-ocr-ind python3 python3-venv python3-pip

# 2. Jalankan skrip setup:
npm run setup:linux
# atau
./scripts/setup-linux.sh
```

---

### Cara Alternatif: Setup Menggunakan Docker Compose

Jika Anda tidak ingin menginstal PostgreSQL, Redis, dan Tesseract secara lokal di OS host:

```bash
# 1. Salin konfigurasi environment
cp .env.example .env

# 2. Nyalakan seluruh container (Postgres, Redis, Python OCR, Web App, BullMQ Workers)
docker-compose up -d

# 3. Akses aplikasi di http://localhost:3000
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

4. **Siapkan Python Virtual Environment untuk Microservice OCR:**
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

5. **Inisialisasi Database (Prisma):**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```

---

## 3. Menjalankan Aplikasi (*Run Application*)

Sistem GORO S2JB terdiri dari 4 proses utama:
1. Web Server (Next.js - Port 3000)
2. Microservice Python OCR (FastAPI - Port 8001)
3. Background Worker OCR (BullMQ)
4. Background Worker Bulk Import (BullMQ)

### Menjalankan Sekaligus (*All-in-One Launcher*)

- **macOS:**
  ```bash
  npm run start:mac
  # atau: ./scripts/start-mac.sh
  ```
- **Windows:**
  ```powershell
  npm run start:win
  # atau klik dua kali: .\scripts\start-windows.bat
  ```
- **Linux:**
  ```bash
  npm run start:linux
  # atau: ./scripts/start-linux.sh
  ```

### Menjalankan Secara Terpisah (Manual Terminal)

Buka 4 tab terminal:
- **Terminal 1 (Web Server):** `npm run dev`
- **Terminal 2 (Python OCR):**
  - macOS/Linux: `cd python-services/ocr && ./venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8001`
  - Windows: `cd python-services\ocr && .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8001`
- **Terminal 3 (Worker OCR):** `npm run worker:ocr`
- **Terminal 4 (Worker Import):** `npm run worker:import`

---

## 4. Kredensial Pengguna Awal (*Default Seed Accounts*)

Semua akun default menggunakan kata sandi: `password123`

| Peran (Role) | Username | Akses URL Utama | Deskripsi Tugas |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `/users`, `/system-processes` | Manajemen user, audit log, monitoring server |
| **Manager UID S2JB** | `manager_s2jb` | `/reports` | Analitik, monitoring KPI unit, ekspor laporan |
| **Pegawai Operator** | `pegawai_operator` | `/reviews`, `/triage` | Triase manual zona kuning/merah, kelola ulasan |
| **Petugas Lapangan** | `petugas_rivai` | `/intake` | Form input ulasan dan unggah bukti baru |

---

## 5. Pemeriksaan Kesehatan & Pengujian

- **Health Check Endpoint:** `http://localhost:3000/api/health`
- **Python OCR Docs:** `http://127.0.0.1:8001/docs`
- **Jalankan Seluruh Test Suite:**
  ```bash
  npm test
  ```
- **Pemeriksaan Tipe TypeScript:**
  ```bash
  npm run typecheck
  ```
