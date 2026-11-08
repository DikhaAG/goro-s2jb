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
   - [2.6 Otomasi Deployment Produksi (Single Command Update)](#26-otomasi-deployment-produksi-single-command-update)
   - [2.7 Pencadangan & Pemulihan Basis Data (Backup & Restore)](#27-pencadangan--pemulihan-basis-data-backup--restore)
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
7. [Pipeline CI/CD (GitHub Actions)](#7-pipeline-cicd-github-actions)

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
- `goro-postgres`: Basis data PostgreSQL 16 Alpine (Port internal 5432, Host Port default `${POSTGRES_PORT:-5432}`, disarankan `5433` jika di server port 5432 sudah terpakai)
- `goro-redis`: In-memory message broker Redis 7 Alpine (Port internal 6379, Host Port `${REDIS_PORT:-6379}`)
- `goro-ocr-engine`: Rust Native Vision Engine dengan libtesseract & model `ind`/`eng` (Port internal 8001, Host Port `${OCR_PORT:-8001}`)
- `goro-web-app`: Next.js 15 Web Server dengan inisialisasi basis data otomatis (Port internal 3000, Host Port `${PORT:-3000}`, disarankan `3020` jika di server port 3000/3010 sudah terpakai)
- `goro-worker-ocr`: BullMQ Background Worker untuk pemrosesan OCR citra bukti & pHash (`SKIP_DB_INIT=true`)
- `goro-worker-import`: BullMQ Background Worker untuk impor massal CSV/Excel puluhan ribu baris (`SKIP_DB_INIT=true`)

**Inisialisasi Otomatis (Zero-Touch Initialization):**
Saat kontainer `goro-web-app` pertama kali menyala, kontainer secara otomatis:
1. Menjalankan migrasi skema basis data (`npx prisma migrate deploy`), termasuk pembaruan skema Better Auth dan kolom `displayUsername`.
2. Menjalankan seed data master dan akun pengguna awal (`npm run prisma:seed`), jika tabel pengguna masih kosong.
Seluruh sistem siap digunakan tanpa memerlukan perintah CLI manual sekunder di dalam kontainer.

Akses web langsung di: `http://localhost:3000` (atau sesuaikan port host di `.env`, misalnya `http://localhost:3020`).

### 2.3 Konfigurasi Berkas `.env` untuk Docker
- **Penggunaan Lokal:** Anda **tidak perlu mengubah apa pun** di dalam `.env`. Docker Compose otomatis menghubungkan kontainer menggunakan DNS internal (`@postgres:5432`, `redis:6379`, `http://ocr-engine:8001`).
- **Penyesuaian Port Host (Mencegah Tabrakan Port di Server):** Jika di server Ubuntu port 3000 atau 5432 sudah digunakan oleh aplikasi lain (misal port 3010 untuk aplikasi absensi dan 5432 untuk Postgres server):
  ```dotenv
  PORT="3020"
  POSTGRES_PORT="5433"
  ```
- **Kredensial Database Kustom:** Jika ingin mengubah password PostgreSQL, ubah variabel `POSTGRES_USER` dan `POSTGRES_PASSWORD` di `.env`. Docker Compose otomatis menerapkannya ke kontainer basis data maupun koneksi web app.
- **Akses dari IP / Domain Server:** Ganti variabel `NEXTAUTH_URL` dan `BETTER_AUTH_URL` sesuai domain atau subdomain server Anda:
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

Gunakan Nginx di server host untuk meneruskan traffic domain publik (port 80/443) ke port host Docker (misalnya `3020`):

#### Langkah 1: Pasang Nginx & Certbot di Host
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

#### Langkah 2: Buat Konfigurasi Nginx Reverse Proxy
Buat berkas konfigurasi di `/etc/nginx/sites-available/goro.conf` (sesuaikan `server_name` dan port `proxy_pass`):
```nginx
server {
    server_name goro.domain-anda.com;

    # Batas upload file bukti ulasan dan berkas impor (50 MB)
    client_max_body_size 50M;

    location / {
        # Arahkan ke port host Docker yang dikonfigurasi di .env (misalnya 3020)
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Konfigurasi SSL Let's Encrypt (dihasilkan otomatis oleh Certbot)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/goro.domain-anda.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/goro.domain-anda.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = goro.domain-anda.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name goro.domain-anda.com;
    return 404;
}
```

Aktifkan konfigurasi:
```bash
sudo ln -sf /etc/nginx/sites-available/goro.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Langkah 3: Pasang Sertifikat SSL Gratis (Certbot)
```bash
sudo certbot --nginx -d goro.domain-anda.com
```

#### Langkah 4: Panduan Domain & Proteksi IP Publik
- **Menggunakan Subdomain dari Domain yang Sudah Ada:** Jika Anda belum mendaftarkan nama domain baru, Anda dapat memanfaatkan domain utama yang sudah Anda miliki (misalnya `tarunagroup.co.id`). Buat sebuah DNS Record tipe **A** dengan nama host `goro` yang diarahkan ke IP publik server Anda (`goro.tarunagroup.co.id`). Setelah propagasi DNS selesai, Certbot dapat langsung menerbitkan SSL tanpa kendala NXDOMAIN.
- **Mencegah Akses Langsung via IP Publik:** Agar pengguna hanya dapat mengakses aplikasi melalui domain resmi dan koneksi terenkripsi HTTPS (bukan langsung via `http://IP_PUBLIK:3020`), pastikan firewall server hanya mengizinkan port `80` dan `443` ke publik. Port `3020` dan `5433` cukup dapat diakses oleh localhost (`127.0.0.1`).

### 2.6 Otomasi Deployment Produksi (Single Command Update)

Untuk memperbarui sistem di server produksi ke versi terbaru, repositori ini menyediakan skrip deployment terintegrasi:

```bash
cd /var/www/goro-s2jb
bash scripts/deploy.sh
# atau via npm shortcut:
npm run deploy
```

Skrip [`scripts/deploy.sh`](scripts/deploy.sh) secara otomatis mengeksekusi 5 tahapan berurutan:
1. **Pre-Deploy Database Backup:** Menjalankan [`scripts/backup-db.sh`](scripts/backup-db.sh) untuk mengamankan data PostgreSQL sebelum kode diperbarui.
2. **Git Pull:** Menarik kode sumber terbaru dari cabang `main`.
3. **Zero-Downtime Rebuild:** Menjalankan `docker compose up -d --build` untuk memperbarui image dan menerapkan migrasi basis data.
4. **Automated Healthcheck Polling:** Menguji endpoint `http://127.0.0.1:${PORT}/api/health` secara berulang hingga aplikasi terverifikasi siap melayani trafik.
5. **Dangling Image Cleanup:** Membersihkan sisa-sisa image Docker lama yang tidak lagi digunakan (`docker image prune -f`).

### 2.7 Pencadangan & Pemulihan Basis Data (Backup & Restore)

- **Mencadangkan Basis Data (Backup):**
  ```bash
  bash scripts/backup-db.sh
  ```
  Salinan basis data akan disimpan dalam format terkompresi di folder `backups/` dengan penamaan timestamp (contoh: `backups/backup_goro_s2jb_20261106_120000.sql.gz`).

- **Memulihkan Basis Data (Restore):**
  ```bash
  bash scripts/restore-db.sh backups/backup_goro_s2jb_20261106_120000.sql.gz
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

# Catatan Penting Redis Native di Windows (Zero-WSL, Zero-Docker):
# BullMQ v5 membutuhkan Redis >= 6.2.0. Jangan gunakan port lawas tporadowski/redis (v5.0.14)
# karena akan memicu error antrian pada halaman /intake. Gunakan Memurai (winget di atas)
# atau unduh port native Redis 7 untuk Windows: https://github.com/redis-windows/redis-windows

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

---

## 7. Pipeline CI/CD (GitHub Actions)

Repositori ini telah dikonfigurasi dengan pipeline CI/CD otomatis untuk menjamin integritas kode sebelum rilis dan memfasilitasi deployment otomatis:

### 7.1 Continuous Integration (`.github/workflows/ci.yml`)
Workflow CI berjalan otomatis pada setiap `push` dan `pull request` ke cabang `main`, mencakup 3 pengujian paralel:
1. **Next.js Quality Gate:**
   - Instalasi dependensi dengan `npm ci --legacy-peer-deps`.
   - Diagnostik sistem *zero-dependency* (`scripts/check-system.js`).
   - Validasi skema Prisma (`npx prisma validate`) & `npx prisma generate`.
   - Typechecking TypeScript (`npm run typecheck`).
   - Linting ESLint (`npm run lint`).
   - Pengujian unit Vitest (`npm test`).
   - Verifikasi RBAC Access Matrix (`scripts/verify-rbac-matrix.sh`).
   - Verifikasi kompilasi produksi Next.js (`npm run build`).
2. **Rust Native Engine Verification:**
   - Instalasi C-FFI Leptonica dan Tesseract OCR di runner Linux.
   - Pengecekan formatting (`cargo fmt --check`).
   - Kompilasi dengan dependency lock (`cargo check --locked`).
   - Pengujian unit & integrasi native engine (22/22 unit tests) via `cargo test --locked`.
   - Analisis statis linter `cargo clippy --locked`.
3. **Docker Multi-Stage Buildx:**
   - Verifikasi kompilasi Dockerfile `goro-ocr-engine` (Rust native).
   - Verifikasi kompilasi Dockerfile `goro-web-app` (Next.js multi-stage).

### 7.2 Continuous Deployment (`.github/workflows/cd.yml`)
Workflow CD otomatis melakukan deployment via SSH ke server Ubuntu produksi ketika terjadi `push` ke cabang `main`.
- **GitHub Secrets yang Diperlukan:**
  - `SERVER_HOST`: Alamat IP atau hostname server produksi.
  - `SERVER_USER`: Pengguna SSH server (contoh: `tam`).
  - `SSH_PRIVATE_KEY`: Kunci privat SSH untuk autentikasi tanpa kata sandi.
  - `SERVER_SSH_PORT`: Port SSH server (default: `22`).
