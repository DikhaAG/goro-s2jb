# ==============================================================================
# GORO S2JB - Skrip Inisialisasi Pertama Kali (Windows PowerShell)
# Menyiapkan dependensi, virtual environment Python, migrasi DB, dan data seed.
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "   ⚡ GORO S2JB - INISIALISASI SISTEM NATIVE (WINDOWS POWERSHELL)  " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

# Fungsi Pengujian Ketersediaan Perintah Eksekusi
function Test-CommandAvailable {
    param ([string]$CommandName, [string]$InstallTip)
    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $cmd) {
        Write-Host "❌ $CommandName belum terpasang atau belum masuk PATH." -ForegroundColor Red
        Write-Host "   Tips: $InstallTip" -ForegroundColor DarkGray
        return $false
    } else {
        Write-Host "✓ $CommandName terdeteksi: $($cmd.Source)" -ForegroundColor Green
        return $true
    }
}

# Fungsi Pengujian Konektivitas Soket Port TCP
function Test-PortOpen {
    param (
        [string]$HostName = "127.0.0.1",
        [int]$Port = 5432,
        [int]$TimeoutMs = 1200
    )
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $tcpClient.BeginConnect($HostName, $Port, $null, $null)
        $wait = $asyncResult.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if ($wait -and $tcpClient.Connected) {
            $tcpClient.EndConnect($asyncResult)
            $tcpClient.Close()
            return $true
        }
        $tcpClient.Close()
        return $false
    } catch {
        return $false
    }
}

# 1. Pengecekan Prasyarat Software
Write-Host "`n[1/8] Memeriksa Prasyarat Software di Windows..." -ForegroundColor Yellow

$MissingDeps = $false
if (-not (Test-CommandAvailable "node" "Unduh Node.js v20+ LTS dari https://nodejs.org atau: winget install OpenJS.NodeJS.LTS")) { $MissingDeps = $true }
if (-not (Test-CommandAvailable "npm" "Disertakan bersama instalasi Node.js.")) { $MissingDeps = $true }
if (-not (Test-CommandAvailable "git" "Unduh Git dari https://git-scm.com atau: winget install Git.Git")) { $MissingDeps = $true }

# Rust Cargo adalah kompilator utama; Python adalah fallback sekunder
$CargoFound = (Get-Command "cargo" -ErrorAction SilentlyContinue) -ne $null
$PythonFound = (Get-Command "python" -ErrorAction SilentlyContinue) -ne $null

if ($CargoFound) {
    Write-Host "✓ cargo terdeteksi (Rust Native Vision Engine Siap)." -ForegroundColor Green
} elseif ($PythonFound) {
    Write-Host "✓ python terdeteksi (Fallback OCR Microservice)." -ForegroundColor Green
} else {
    Write-Host "❌ Baik cargo maupun python tidak terdeteksi." -ForegroundColor Red
    Write-Host "   Tips: Pasang Rust dari https://rustup.rs (winget install Rustlang.Rustup) atau Python 3.10+ (winget install Python.Python.3.11)" -ForegroundColor DarkGray
    $MissingDeps = $true
}

# Pengecekan Tesseract OCR di Windows & Auto-Injeksi PATH
$TessStandardPaths = @(
    "C:\Program Files\Tesseract-OCR",
    "C:\Program Files (x86)\Tesseract-OCR",
    "$env:LOCALAPPDATA\Programs\Tesseract-OCR"
)

$TessDir = $null
foreach ($p in $TessStandardPaths) {
    if (Test-Path (Join-Path $p "tesseract.exe")) {
        $TessDir = $p
        break
    }
}

if (Get-Command "tesseract" -ErrorAction SilentlyContinue) {
    Write-Host "✓ tesseract terdeteksi di PATH sistem." -ForegroundColor Green
} elseif ($TessDir) {
    Write-Host "✓ tesseract ditemukan di: $TessDir (menambahkan ke PATH sesi aktif)..." -ForegroundColor Green
    $env:PATH = "$TessDir;" + $env:PATH
    if (-not $env:TESSDATA_PREFIX -and (Test-Path (Join-Path $TessDir "tessdata"))) {
        $env:TESSDATA_PREFIX = Join-Path $TessDir "tessdata"
    }
} else {
    Write-Host "⚠️ Tesseract OCR belum terdeteksi di PATH maupun folder standar." -ForegroundColor Yellow
    Write-Host "   Silakan unduh installer Windows dari: https://github.com/UB-Mannheim/tesseract/wiki" -ForegroundColor DarkGray
    Write-Host "   Pastikan mencentang paket 'Additional language data -> Indonesian (ind)' saat instalasi." -ForegroundColor DarkGray
}

if ($MissingDeps) {
    Write-Host "`n❌ Harap lengkapi instalasi software prasyarat di atas sebelum melanjutkan." -ForegroundColor Red
    Exit 1
}

# 2. Pengecekan Layanan Basis Data & Broker Redis
Write-Host "`n[2/8] Memeriksa Layanan Basis Data PostgreSQL & Broker Redis..." -ForegroundColor Yellow

# Pengecekan PostgreSQL Port 5432
if (Test-PortOpen -Port 5432) {
    Write-Host "✓ PostgreSQL aktif di port 5432." -ForegroundColor Green
} else {
    Write-Host "⚠️ PostgreSQL port 5432 belum merespons. Mencari Windows Service terkait..." -ForegroundColor Yellow
    $pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pgSvc -and $pgSvc.Status -ne "Running") {
        Write-Host "   Mencoba mengaktifkan service Windows: $($pgSvc.Name)..." -ForegroundColor Yellow
        try {
            Start-Service -Name $pgSvc.Name -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        } catch {
            # Abaikan jika membutuhkan izin Administrator
        }
    }

    if (Test-PortOpen -Port 5432) {
        Write-Host "✓ PostgreSQL port 5432 berhasil diaktifkan." -ForegroundColor Green
    } else {
        Write-Host "⚠️ Port 5432 masih belum aktif." -ForegroundColor Yellow
        Write-Host "   Tips: Jalankan service PostgreSQL via Services.msc atau gunakan kontainer Docker:" -ForegroundColor DarkGray
        Write-Host "         docker run -d --name goro-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=goro_s2jb postgres:16-alpine" -ForegroundColor DarkGray
    }
}

# Pengecekan Redis Port 6379
if (Test-PortOpen -Port 6379) {
    Write-Host "✓ Redis broker aktif di port 6379." -ForegroundColor Green
} else {
    Write-Host "⚠️ Redis port 6379 belum merespons. Mencari Windows Service terkait..." -ForegroundColor Yellow
    $redisSvc = Get-Service -Name "redis*", "memurai*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($redisSvc -and $redisSvc.Status -ne "Running") {
        Write-Host "   Mencoba mengaktifkan service Windows: $($redisSvc.Name)..." -ForegroundColor Yellow
        try {
            Start-Service -Name $redisSvc.Name -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        } catch {
            # Abaikan jika membutuhkan izin Administrator
        }
    }

    if (Test-PortOpen -Port 6379) {
        Write-Host "✓ Redis port 6379 berhasil diaktifkan." -ForegroundColor Green
    } else {
        Write-Host "⚠️ Port 6379 masih belum aktif." -ForegroundColor Yellow
        Write-Host "   Tips: Jalankan Memurai / Redis service atau gunakan kontainer Docker:" -ForegroundColor DarkGray
        Write-Host "         docker run -d --name goro-redis -p 6379:6379 redis:7-alpine" -ForegroundColor DarkGray
    }
}

# 3. File Konfigurasi .env
Write-Host "`n[3/8] Memeriksa Berkas Konfigurasi Lingkungan (.env)..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✓ Berkas .env berhasil disalin dari .env.example." -ForegroundColor Green
    } else {
        @"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/goro_s2jb?schema=public"
REDIS_URL="redis://localhost:6379"
STORAGE_PATH="./uploads"
OCR_SERVICE_URL="http://127.0.0.1:8001"
NODE_ENV="development"
BETTER_AUTH_SECRET="goro-s2jb-better-auth-secret-key-2026-production-ready"
BETTER_AUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="goro-s2jb-secret-key-2026-production-ready"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="goro-s2jb-jwt-secret-key-2026-production-ready"
PORT="3000"
SKIP_DB_INIT="false"
"@ | Out-File -FilePath ".env" -Encoding utf8
        Write-Host "✓ Berkas .env default berhasil dibuat." -ForegroundColor Green
    }
} else {
    Write-Host "✓ Berkas .env sudah tersedia." -ForegroundColor Green
}

# 4. Instalasi Dependensi Node.js
Write-Host "`n[4/8] Memasang Dependensi Node.js (npm install)..." -ForegroundColor Yellow
npm install

# 5. Kompilasi Engine Rust Native (Prioritas Utama)
if (Get-Command cargo -ErrorAction SilentlyContinue) {
    Write-Host "`n[5/8] Mengompilasi Rust Native Vision Engine (goro-engine)..." -ForegroundColor Yellow
    try {
        npm run rust:build
        Write-Host "✓ Engine Rust Native berhasil dikompilasi." -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Peringatan: Kompilasi Rust mengalami kendala. Sistem akan menggunakan fallback Python OCR jika tersedia." -ForegroundColor Yellow
    }
} else {
    Write-Host "`n[5/8] Cargo tidak ditemukan. Melewati kompilasi Rust Native Engine." -ForegroundColor DarkGray
}

# 6. Setup Python Virtual Environment (Fallback Microservice OCR)
$OcrDir = Join-Path $ProjectDir "python-services\ocr"
if (Test-Path $OcrDir) {
    Write-Host "`n[6/8] Menyiapkan Python Virtual Environment (Fallback Microservice OCR)..." -ForegroundColor Yellow
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $VenvDir = Join-Path $OcrDir "venv"
        $PipExe = Join-Path $VenvDir "Scripts\pip.exe"

        if (-not (Test-Path $VenvDir)) {
            Write-Host "Membuat virtual environment di $VenvDir..."
            python -m venv $VenvDir
        }

        if (Test-Path $PipExe) {
            Write-Host "Memasang dependensi Python (Pillow, RapidFuzz, Pytesseract, FastAPI, Uvicorn)..."
            & $PipExe install --upgrade pip --quiet
            & $PipExe install -r (Join-Path $OcrDir "requirements.txt") --quiet
            Write-Host "✓ Virtual environment Python OCR siap digunakan." -ForegroundColor Green
        }
    } else {
        Write-Host "⚠️ Python tidak terdeteksi. Melewati setup Python OCR venv." -ForegroundColor Yellow
    }
}

# 7. Persiapan Direktori Penyimpanan & Log
Write-Host "`n[7/8] Memastikan Direktori Upload, Cache & Log Tersedia..." -ForegroundColor Yellow
$DirsToCreate = @("uploads", "logs", "backups")
foreach ($dir in $DirsToCreate) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
}
Write-Host "✓ Direktori uploads, logs, dan backups siap." -ForegroundColor Green

# 8. Migrasi Skema Basis Data & Seed Data Awal
Write-Host "`n[8/8] Menjalankan Prisma Generate, Skema Database, dan Data Seed..." -ForegroundColor Yellow
npx prisma generate

try {
    Write-Host "Menerapkan migrasi skema basis data (prisma migrate deploy)..." -ForegroundColor Yellow
    npx prisma migrate deploy
    Write-Host "✓ Migrasi skema basis data berhasil diterapkan." -ForegroundColor Green
} catch {
    Write-Host "⚠️ Migrate deploy menemui kendala, mencoba prisma migrate dev..." -ForegroundColor Yellow
    try {
        npx prisma migrate dev --name init
        Write-Host "✓ Skema database dev berhasil disinkronkan." -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Peringatan: Tidak dapat menerapkan migrasi database secara otomatis." -ForegroundColor Yellow
        Write-Host "   Pastikan PostgreSQL port 5432 aktif dan kredensial di .env sesuai." -ForegroundColor DarkGray
    }
}

try {
    Write-Host "Menjalankan seeder data master dan akun default..." -ForegroundColor Yellow
    npm run prisma:seed
    Write-Host "✓ Seeding data awal GORO S2JB berhasil." -ForegroundColor Green
} catch {
    Write-Host "⚠️ Peringatan: Seeding basis data belum berhasil dieksekusi." -ForegroundColor Yellow
    Write-Host "   Anda dapat menjalankannya manual nanti via: npm run prisma:seed" -ForegroundColor DarkGray
}

# Selesai
Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "   🎉 INISIALISASI GORO S2JB DI WINDOWS SELESAI DENGAN SUKSES!   " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "Untuk menjalankan seluruh subsistem secara bersamaan:" -ForegroundColor White
Write-Host "👉 Jalankan di PowerShell : .\scripts\start-windows.ps1" -ForegroundColor Yellow
Write-Host "   atau klik dua kali file: .\scripts\start-windows.bat" -ForegroundColor Yellow
Write-Host "   atau universal command : npm run start:all`n" -ForegroundColor Yellow
