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

# 1. Pengecekan Prasyarat Software
Write-Host "`n[1/7] Memeriksa Prasyarat Software di Windows..." -ForegroundColor Yellow

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

$MissingDeps = $false
if (-not (Test-CommandAvailable "node" "Unduh Node.js v20+ LTS dari https://nodejs.org")) { $MissingDeps = $true }
if (-not (Test-CommandAvailable "npm" "Disertakan bersama instalasi Node.js")) { $MissingDeps = $true }
if (-not (Test-CommandAvailable "python" "Unduh Python 3.10+ dari https://www.python.org/downloads/ (centang 'Add Python to PATH')")) { $MissingDeps = $true }

# Pengecekan Tesseract OCR di Windows
$TesseractFound = $false
if (Get-Command "tesseract" -ErrorAction SilentlyContinue) {
    $TesseractFound = $true
    Write-Host "✓ tesseract terdeteksi di PATH." -ForegroundColor Green
} elseif (Test-Path "C:\Program Files\Tesseract-OCR\tesseract.exe") {
    $TesseractFound = $true
    Write-Host "✓ tesseract terdeteksi di C:\Program Files\Tesseract-OCR" -ForegroundColor Green
} else {
    Write-Host "⚠️ Tesseract OCR belum terdeteksi." -ForegroundColor Yellow
    Write-Host "   Silakan unduh installer Windows dari: https://github.com/UB-Mannheim/tesseract/wiki" -ForegroundColor DarkGray
    Write-Host "   Pastikan mencentang paket bahasa 'Indonesian (ind)' saat instalasi." -ForegroundColor DarkGray
}

if ($MissingDeps) {
    Write-Host "`n❌ Harap lengkapi instalasi software yang diperlukan sebelum melanjutkan." -ForegroundColor Red
    Exit 1
}

# 2. File Konfigurasi .env
Write-Host "`n[2/7] Memeriksa File Konfigurasi .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✓ File .env berhasil dibuat dari .env.example." -ForegroundColor Green
    } else {
        @"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/goro_s2jb?schema=public"
REDIS_URL="redis://localhost:6379"
STORAGE_PATH="./uploads"
OCR_SERVICE_URL="http://127.0.0.1:8001"
NODE_ENV="development"
NEXTAUTH_SECRET="goro-s2jb-secret-key-2026-production-ready"
NEXTAUTH_URL="http://localhost:3000"
"@ | Out-File -FilePath ".env" -Encoding utf8
        Write-Host "✓ File .env default berhasil dibuat." -ForegroundColor Green
    }
} else {
    Write-Host "✓ File .env sudah ada." -ForegroundColor Green
}

# 3. Instalasi Dependensi Node.js
Write-Host "`n[3/7] Memasang Dependensi Node.js (npm install)..." -ForegroundColor Yellow
npm install

# 4. Setup Python Virtual Environment untuk OCR
Write-Host "`n[4/7] Menyiapkan Python Virtual Environment (Microservice OCR)..." -ForegroundColor Yellow
$OcrDir = Join-Path $ProjectDir "python-services\ocr"
$VenvDir = Join-Path $OcrDir "venv"
$PipExe = Join-Path $VenvDir "Scripts\pip.exe"
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"

if (-not (Test-Path $VenvDir)) {
    Write-Host "Membuat venv di $VenvDir..."
    python -m venv $VenvDir
}

Write-Host "Memasang paket Python (Pillow, RapidFuzz, Pytesseract, FastAPI, Uvicorn)..."
& $PipExe install --upgrade pip
& $PipExe install -r (Join-Path $OcrDir "requirements.txt")
Write-Host "✓ Virtual environment Python OCR siap." -ForegroundColor Green

# 5. Persiapan Direktori Penyimpanan
Write-Host "`n[5/7] Memastikan Direktori Upload & Log Tersedia..." -ForegroundColor Yellow
if (-not (Test-Path "uploads")) { New-Item -ItemType Directory -Path "uploads" | Out-Null }
if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }
Write-Host "✓ Folder uploads dan logs siap." -ForegroundColor Green

# 6. Migrasi & Seed Database
Write-Host "`n[6/7] Menjalankan Prisma Generate, Migration, dan Seed Data..." -ForegroundColor Yellow
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed

# 7. Selesai
Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "   🎉 INISIALISASI GORO S2JB DI WINDOWS SELESAI DENGAN SUKSES!   " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "Untuk menjalankan seluruh sistem secara bersamaan:" -ForegroundColor White
Write-Host "👉 Jalankan di PowerShell: .\scripts\start-windows.ps1" -ForegroundColor Yellow
Write-Host "   atau klik dua kali file: .\scripts\start-windows.bat`n" -ForegroundColor Yellow
