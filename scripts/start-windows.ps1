# ==============================================================================
# GORO S2JB - Launcher Tunggal Native (Windows PowerShell)
# Membuka terminal untuk Python OCR, BullMQ Worker, dan Next.js Web App.
# ==============================================================================

$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "       ⚡ GORO S2JB - COMMAND CENTER LAUNCHER (WINDOWS)          " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Menjalankan Microservice OCR (Port 8001) - Prioritas: Rust Native Engine
Write-Host "`n[1/4] Menjalankan Microservice OCR (Port 8001)..." -ForegroundColor Yellow
$RustExe = Join-Path $ProjectDir "rust-services\goro-engine\target\release\goro-engine.exe"
$OcrDir = Join-Path $ProjectDir "python-services\ocr"
$PythonExe = Join-Path $OcrDir "venv\Scripts\python.exe"

if (Test-Path $RustExe) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - Rust Native OCR Engine (Port 8001)'; Set-Location '$ProjectDir'; & '$RustExe' --host 127.0.0.1 --port 8001"
    Write-Host "✓ Jendela Rust Native OCR Engine berhasil dibuka." -ForegroundColor Green
} elseif (Test-Path $OcrDir) {
    if (-not (Test-Path $PythonExe)) {
        $PythonExe = "python"
    }
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - Python OCR Microservice (Port 8001)'; Set-Location '$OcrDir'; & '$PythonExe' -m uvicorn main:app --host 127.0.0.1 --port 8001"
    Write-Host "✓ Jendela Python OCR Microservice (Fallback) berhasil dibuka." -ForegroundColor Green
} else {
    Write-Host "⚠️ Binary Rust belum dikompilasi dan python-services tidak ditemukan. Jalankan: npm run rust:build" -ForegroundColor Red
}

# 2. Menjalankan BullMQ OCR Queue Worker
Write-Host "`n[2/4] Menjalankan Background Worker BullMQ OCR..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - BullMQ OCR Worker'; Set-Location '$ProjectDir'; npm run worker:ocr"
Write-Host "✓ Jendela BullMQ OCR Worker berhasil dibuka." -ForegroundColor Green

# 3. Menjalankan BullMQ Bulk Import Queue Worker
Write-Host "`n[3/4] Menjalankan Background Worker BullMQ Bulk Import..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - BullMQ Import Worker'; Set-Location '$ProjectDir'; npm run worker:import"
Write-Host "✓ Jendela BullMQ Import Worker berhasil dibuka." -ForegroundColor Green

# 4. Menjalankan Next.js Web Server
Write-Host "`n[4/4] Menjalankan Next.js Web App (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - Next.js Web Application (Port 3000)'; Set-Location '$ProjectDir'; npm run dev"
Write-Host "✓ Jendela Next.js Web App berhasil dibuka." -ForegroundColor Green

# Tampilkan Informasi Akses
Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "   🚀 SELURUH LAYANAN GORO S2JB BERHASIL DIJALANKAN!            " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "🌐 URL Aplikasi:    http://localhost:3000" -ForegroundColor White
Write-Host "🩺 Health Check:    http://localhost:3000/api/health" -ForegroundColor White
Write-Host "👁️  OCR Service:     http://127.0.0.1:8001/docs" -ForegroundColor White
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "🔑 Kredensial Uji Coba Cepat (Password: password123):" -ForegroundColor White
Write-Host "  • Petugas Lapangan:  petugas_rivai      -> http://localhost:3000/intake" -ForegroundColor Yellow
Write-Host "  • Pegawai Triase:    pegawai_operator   -> http://localhost:3000/triage" -ForegroundColor Yellow
Write-Host "  • Manager UID S2JB:  manager_s2jb       -> http://localhost:3000/reports" -ForegroundColor Yellow
Write-Host "  • Super Admin:       superadmin         -> http://localhost:3000/users" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Tips: Tutup masing-masing jendela PowerShell saat selesai menggunakan sistem.`n" -ForegroundColor DarkGray
