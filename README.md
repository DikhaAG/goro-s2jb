# GORO S2JB - Command Center Rating & Review PLN Mobile UID S2JB

Sistem otomasi validasi bukti ulasan rating bintang 5 aplikasi PLN Mobile berbasis Optical Character Recognition (OCR), pencocokan fuzzy Levenshtein, deteksi anti-fraud perceptual hash (pHash 64-bit), dan antrian asinkron BullMQ.

Sistem ini mendukung penuh lintas platform (*cross-platform*) untuk **macOS**, **Windows**, dan **Linux**, serta ditenagai mesin performa tinggi berbasis **Rust Native Engine (`goro-engine`)** dengan opsi deployment **Docker Container (Zero-Host Dirt)** atau **Native Runner (1-Perintah Universal)**.

---

## Daftar Isi
1. [Perbandingan Metode Instalasi](#1-perbandingan-metode-instalasi)
2. [Metode A: Deployment Docker (Rekomendasi Utama)](#2-metode-a-deployment-docker-rekomendasi-utama)
   - [2.1 Prasyarat Host](#21-prasyarat-host)
   - [2.2 Menjalankan Sekaligus (1 Perintah)](#22-menjalankan-sekaligus-1-perintah)
   - [2.3 Konfigurasi Berkas .env untuk Docker](#23-konfigurasi-berkas-env-untuk-docker)
   - [2.4 Manajemen Kontainer](#24-manajemen-kontainer)
   - [2.5 Menghubungkan ke Domain Publik dengan Nginx Reverse Proxy & SSL](#25-menghubungkan-ke-domain-publik-dengan-nginx-reverse-proxy--ssl)
3. [Metode B: Instalasi Native Lokal (Bagi Pengembang)](#3-metode-b-instalasi-native-lokal-bagi-pengembang)
   - [3.1 Diagnostik Kesiapan Sistem](#31-diagnostik-kesiapan-sistem)
   - [3.2 Prasyarat Software Native](#32-prasyarat-software-native)
   - [3.3 Panduan Setup Fresh OS dari Titik Nol](#33-panduan-setup-fresh-os-dari-titik-nol)
     - [A. macOS (Apple Silicon & Intel)](#a-panduan-macos-fresh-install)
     - [B. Windows 10 / 11 (PowerShell & winget)](#b-panduan-windows-10--11-fresh-install)
     - [C. Linux (Ubuntu / Debian)](#c-panduan-linux-fresh-install-ubuntu--debian)
   - [3.4 Menjalankan Aplikasi Native](#34-menjalankan-aplikasi-native)
4. [Kredensial Pengguna Awal (Default Accounts)](#4-kredensial-pengguna-awal-default-accounts)
5. [Pemeriksaan Kesehatan & Pengujian](#5-pemeriksaan-kesehatan--pengujian)
6. [Struktur Branch Git & Riwayat Migrasi](#6-struktur-branch-git--riwayat-migrasi)

---

## 1. Perbandingan Metode Instalasi

Pilih metode yang paling sesuai dengan kebutuhan Anda:

| Kriteria | Metode A: Docker Compose (Rekomendasi) | Metode B: Native Lokal |
| :--- | :--- | :--- |
| **Kesesuaian** | Server Ubuntu / VPS / Komputer Baru (*Fresh OS*) | Laptop/PC untuk pengembang yang mengedit kode |
| **Prasyarat Host** | **Hanya butuh Docker & Git** | Node.js, Rust, PostgreSQL, Redis, Tesseract |
| **Kebersihan Host** | **100% Bersih (Zero-Host Dirt)** | Pustaka & compiler terpasang di host OS |
| **Setup & Build** | Otomatis via `docker compose up -d --build` | Skrip native per OS (`npm run setup:all`) |
| **Process Manager** | Otomatis oleh Docker (`restart: always`) | Skrip otomatis (`npm run start:all`) |

---

## 2. Metode A: Deployment Docker (Rekomendasi Utama)

Metode ini mengisolasi seluruh compiler, pustaka, model bahasa OCR, database, dan broker antrian di dalam 6 kontainer terpisah.

### 2.1 Prasyarat Host
Komputer host **hanya memerlukan Docker Engine & Docker Compose** (tidak perlu menginstal Node.js, Rust, Postgres, Redis, atau Tesseract):
- **Linux Ubuntu/Debian**: `sudo apt update && sudo apt install -y docker.io docker-compose-v2 git && sudo usermod -aG docker $USER`
- **Windows**: Pasang [Docker Desktop](https://www.docker.com/products/docker-desktop) atau jalankan `winget install Docker.DockerDesktop`
- **macOS**: Pasang [Docker Desktop](https://www.docker.com/products/docker-desktop) atau jalankan `brew install --cask docker`

### 2.2 Menjalankan Sekaligus (1 Perintah)
1. **Clone Repositori & Siapkan Konfigurasi:**
   ```bash
   git clone https://github.com/DikhaAG/goro-s2jb.git
   cd goro-s2jb
   cp .env.example .env
   ```
2. **Build & Nyalakan Seluruh Sistem di Latar Belakang:**
   ```bash
   docker compose up -d --build
   ```

Arsitektur 6 kontainer yang otomatis dibuat dan dihubungkan pada jaringan internal `goro_network`:
- `goro-postgres`: Basis data PostgreSQL 16 Alpine (Port 5432)
- `goro-redis`: In-memory message broker Redis 7 Alpine (Port 6379)
- `goro-ocr-engine`: Rust Native Vision Engine dengan libtesseract & model `ind`/`eng` (Port 8001)
- `goro-web-app`: Next.js 15 Web Server dengan auto-migration Prisma & auto-seed akun awal (Port 3000)
- `goro-worker-ocr`: BullMQ Background Worker untuk pemrosesan OCR citra bukti & pHash
- `goro-worker-import`: BullMQ Background Worker untuk impor massal CSV/Excel puluhan ribu baris

Akses web langsung di: `http://localhost:3000`

### 2.3 Konfigurasi Berkas `.env` untuk Docker
- **Penggunaan Lokal:** Anda **tidak perlu mengubah apa pun** di dalam `.env`. Docker Compose otomatis menghubungkan kontainer menggunakan DNS internal (`@postgres:5432`, `redis:6379`, `http://ocr-engine:8001`).
- **Kredensial Database Kustom:** Jika ingin mengubah password PostgreSQL, ubah variabel `POSTGRES_USER` dan `POSTGRES_PASSWORD` di `.env`. Docker Compose otomatis menerapkannya ke kontainer basis data maupun koneksi web app.
- **Akses dari IP / Domain Server:** Ganti variabel `NEXTAUTH_URL` dan `BETTER_AUTH_URL` sesuai domain atau IP server Anda:
  ```dotenv
  NEXTAUTH_URL="https://goro.domain-anda.com"
  BETTER_AUTH_URL="https://goro.domain-anda.com"
  ```

### 2.4 Manajemen Kontainer
```bash
# Memeriksa status kesehatan seluruh kontainer:
docker compose ps

# Memantau log realtime gabungan:
docker compose logs -f

# Memantau log kontainer tertentu:
docker compose logs -f ocr-engine
docker compose logs -f web-app

# Menghentikan seluruh kontainer:
docker compose down
```

### 2.5 Menghubungkan ke Domain Publik dengan Nginx Reverse Proxy & SSL

Jika Anda mendeploy di server Ubuntu, **PM2 tidak lagi dibutuhkan** karena Docker Compose sudah bertindak sebagai supervisor proses yang tangguh (`restart: always`).

Gunakan Nginx di server host untuk meneruskan traffic domain ke port Docker (3000):

#### Langkah 1: Pasang Nginx & Certbot di Host
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

#### Langkah 2: Buat Konfigurasi Nginx Reverse Proxy
Buat berkas `/etc/nginx/sites-available/goro.conf`:
```nginx
server {
    listen 80;
    server_name goro.domain-anda.com;

    # Batas upload file bukti ulasan (50 MB)
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan konfigurasi:
```bash
sudo ln -s /etc/nginx/sites-available/goro.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Langkah 3: Pasang SSL Gratis (HTTPS)
```bash
sudo certbot --nginx -d goro.domain-anda.com
```

#### Langkah 4: Sesuaikan `.env` dan Muat Ulang Web App
Di dalam file `.env` project, pastikan URL menggunakan `https`:
```dotenv
NEXTAUTH_URL="https://goro.domain-anda.com"
BETTER_AUTH_URL="https://goro.domain-anda.com"
```
Muat ulang kontainer web app:
```bash
docker compose up -d web-app
```

---

## 3. Metode B: Instalasi Native Lokal (Bagi Pengembang)

Gunakan metode ini jika Anda ingin menjalankan aplikasi secara langsung di sistem operasi tanpa Docker untuk keperluan pengembangan kode (*local dev*).

### 3.1 Diagnostik Kesiapan Sistem
Sebelum atau sesudah instalasi, jalankan skrip audit mandiri (zero-dependency, tidak membutuhkan `node_modules`):
```bash
npm run check:system
# atau: node scripts/check-system.js
```
Skrip akan mengaudit 11 subsistem kritis: Node.js, npm, node_modules, Rust & Cargo compiler, biner rilis `goro-engine`, Tesseract OCR + bahasa `ind`/`eng`, model mandiri lokal, soket PostgreSQL port 5432, soket Redis port 6379, berkas `.env`, dan Docker.

### 3.2 Prasyarat Software Native
| Software | Versi Minimum | Keterangan |
| :--- | :--- | :--- |
| **Node.js** | v20.x atau v22.x LTS | Runtime JavaScript/TypeScript utama |
| **npm** | v10.x+ | Package manager bawaan Node.js |
| **Rust & Cargo** | v1.80+ | Kompilasi engine native (`goro-engine`) via C-API |
| **PostgreSQL** | v15+ atau v16+ | Basis data relasional utama (Port 5432) |
| **Redis** | v7.x+ | Message broker BullMQ queue (Port 6379) |
| **Tesseract OCR** | v5.x+ | Engine OCR dengan paket bahasa Indonesia (`ind`) |

---

### 3.3 Panduan Setup Fresh OS dari Titik Nol

#### A. Panduan macOS Fresh Install
```bash
# 1. Pasang Command Line Tools:
xcode-select --install

# 2. Pasang Homebrew:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 3. Pasang seluruh dependensi sekaligus via Homebrew:
brew install git node rust postgresql@16 redis tesseract tesseract-lang

# 4. Nyalakan service basis data:
brew services start postgresql@16
brew services start redis

# 5. Clone repositori & masuk folder:
git clone https://github.com/DikhaAG/goro-s2jb.git
cd goro-s2jb

# 6. Jalankan inisialisasi otomatis (Setup):
npm run setup:all
```

#### B. Panduan Windows 10 / 11 Fresh Install
Buka **PowerShell sebagai Administrator**, lalu jalankan:
```powershell
# 1. Pasang software via winget:
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
winget install --id Rustlang.Rustup -e --source winget
winget install --id PostgreSQL.PostgreSQL -e --source winget
winget install --id Memurai.MemuraiDeveloper -e --source winget

# 2. Inisialisasi toolchain Rust (pilih opsi 1 default):
rustup-init.exe

# 3. Pasang Tesseract OCR Windows:
# Unduh installer: https://github.com/UB-Mannheim/tesseract/wiki
# Saat instalasi, centang Additional language data -> Indonesian.
# Tambahkan 'C:\Program Files\Tesseract-OCR' ke System PATH.

# 4. Buka PowerShell biasa baru, clone & jalankan setup:
git clone https://github.com/DikhaAG/goro-s2jb.git
cd goro-s2jb
npm run setup:all
# atau klik dua kali: .\scripts\setup-windows.bat
```

#### C. Panduan Linux Fresh Install (Ubuntu / Debian)
```bash
# 1. Perbarui sistem & pasang perkakas kompilasi:
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential pkg-config libssl-dev libtesseract-dev clang

# 2. Pasang Node.js v20+ LTS via NodeSource:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Pasang Rust & Cargo via rustup:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# 4. Pasang PostgreSQL, Redis, dan Tesseract OCR:
sudo apt install -y postgresql postgresql-contrib redis-server tesseract-ocr tesseract-ocr-ind
sudo systemctl enable --now postgresql redis-server

# 5. Siapkan user database:
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres createdb goro_s2jb 2>/dev/null || true

# 6. Clone & Jalankan setup:
git clone https://github.com/DikhaAG/goro-s2jb.git
cd goro-s2jb
npm run setup:all
```

---

### 3.4 Menjalankan Aplikasi Native

#### Opsi 1: Peluncur Universal 1-Perintah (Semua OS)
Dispatcher cerdas otomatis mendeteksi OS host Anda dan menjalankan runner native yang sesuai:
```bash
npm run start:all
```

#### Opsi 2: Peluncur Khusus OS
- **macOS:** `npm run start:mac` (atau `bash scripts/start-mac.sh 2>&1 | tee logs/system_runtime.log`)
- **Windows:** `npm run start:win` (atau klik dua kali `.\scripts\start-windows.bat`)
- **Linux:** `npm run start:linux` (atau `./scripts/start-linux.sh`)

#### Opsi 3: Menjalankan Manual per Tab Terminal
- **Terminal 1 (Web Server Port 3000):** `npm run dev`
- **Terminal 2 (Rust OCR Engine Port 8001):** `npm run rust:dev`
- **Terminal 3 (BullMQ Worker OCR):** `npm run worker:ocr`
- **Terminal 4 (BullMQ Worker Import):** `npm run worker:import`

---

## 4. Kredensial Pengguna Awal (Default Accounts)

Seluruh akun default menggunakan kata sandi: `password123`

| Peran (Role) | Username | Akses URL Utama | Deskripsi Tugas |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `/users`, `/system-processes` | Manajemen user, audit log, monitoring server |
| **Manager UID S2JB** | `manager_s2jb` | `/reports` | Analitik, monitoring KPI unit, ekspor laporan |
| **Pegawai Operator** | `pegawai_operator` | `/reviews`, `/triage` | Triase manual zona kuning/merah, kelola ulasan |
| **Petugas Lapangan** | `petugas_rivai` | `/intake` | Form input ulasan dan unggah bukti baru |

---

## 5. Pemeriksaan Kesehatan & Pengujian

- **Next.js Web Health Check:** `http://localhost:3000/api/health`
- **Rust OCR Engine Health Check:** `http://127.0.0.1:8001/health`
- **Diagnostik Kesiapan Sistem:**
  ```bash
  npm run check:system
  ```
- **Test Suite Rust Native Engine (22 tests):**
  ```bash
  npm run rust:test
  ```
- **Test Suite Vitest (Unit & Integration):**
  ```bash
  npm test
  ```
- **Validasi Tipe TypeScript:**
  ```bash
  npm run typecheck
  ```

---

## 6. Struktur Branch Git & Riwayat Migrasi

Repositori ini mengelola dua cabang utama:

1. **`main` (Cabang Utama / Aktif)**
   - Menggunakan **Rust Native Vision Engine (`goro-engine`)** via C-API Leptonica dan Tesseract OCR in-memory.
   - Dilengkapi pipeline zero-disk storage streaming, komputasi perceptual hash (pHash 64-bit DCT), pencocokan Levenshtein/LCS multithreading, antarmuka monitoring sistem realtime, dan peluncur lintas platform.
2. **`legacy-python-services` (Cabang Arsip)**
   - Mengarsipkan kondisi commit terakhir sebelum migrasi (`dc5010c`).
   - Menyimpan implementasi microservice Python (FastAPI, Uvicorn, Pillow, RapidFuzz, Pytesseract) untuk keperluan audit, perbandingan benchmark historis, atau verifikasi backward-compatibility.
