# ==============================================================================
# GORO S2JB - Launcher Tunggal Native (Windows PowerShell)
# Membuka terminal untuk OCR Engine, BullMQ Worker, dan Next.js Web App.
# ==============================================================================

$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "       ⚡ GORO S2JB - COMMAND CENTER LAUNCHER (WINDOWS)          " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

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

# Fungsi Memeriksa Versi Semantik Redis Server
function Get-RedisVersion {
    param (
        [string]$HostName = "127.0.0.1",
        [int]$Port = 6379,
        [int]$TimeoutMs = 1200
    )
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $asyncResult = $tcpClient.BeginConnect($HostName, $Port, $null, $null)
        $wait = $asyncResult.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if (-not ($wait -and $tcpClient.Connected)) {
            $tcpClient.Close()
            return $null
        }
        $stream = $tcpClient.GetStream()
        $stream.ReadTimeout = $TimeoutMs
        $stream.WriteTimeout = $TimeoutMs
        $cmdBytes = [System.Text.Encoding]::ASCII.GetBytes("INFO server`r`n")
        $stream.Write($cmdBytes, 0, $cmdBytes.Length)
        $buffer = New-Object byte[] 4096
        $bytesRead = $stream.Read($buffer, 0, $buffer.Length)
        $response = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $bytesRead)
        $stream.Close()
        $tcpClient.Close()
        if ($response -match "redis_version:([0-9.]+)") {
            return $matches[1]
        }
        return $null
    } catch {
        return $null
    }
}

# Verifikasi Pra-Syarat Port Database & Cache Sebelum Meluncurkan Worker
Write-Host "`n[Pra-Syarat] Memverifikasi Kesiapan Layanan PostgreSQL & Redis..." -ForegroundColor Yellow

$PgReady = Test-PortOpen -Port 5432
if (-not $PgReady) {
    Write-Host "⚠️ PostgreSQL (Port 5432) belum merespons. Mencari Windows Service..." -ForegroundColor Yellow
    $pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pgSvc -and $pgSvc.Status -ne "Running") {
        try {
            Start-Service -Name $pgSvc.Name -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            $PgReady = Test-PortOpen -Port 5432
        } catch { }
    }
}

if ($PgReady) {
    Write-Host "✓ PostgreSQL aktif di port 5432." -ForegroundColor Green
} else {
    Write-Host "⚠️ PERINGATAN: PostgreSQL port 5432 belum aktif! Worker & Web App mungkin mengalami error koneksi." -ForegroundColor Red
    Write-Host "   Jalankan PostgreSQL via Services.msc atau Docker: docker compose up -d postgres" -ForegroundColor DarkGray
}

$RedisReady = Test-PortOpen -Port 6379
if (-not $RedisReady) {
    Write-Host "⚠️ Redis (Port 6379) belum merespons. Mencari Windows Service..." -ForegroundColor Yellow
    $redisSvc = Get-Service -Name "redis*", "memurai*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($redisSvc -and $redisSvc.Status -ne "Running") {
        try {
            Start-Service -Name $redisSvc.Name -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            $RedisReady = Test-PortOpen -Port 6379
        } catch { }
    }
}

if ($RedisReady) {
    $redisVer = Get-RedisVersion -Port 6379
    if ($redisVer) {
        $verParts = $redisVer.Split(".")
        $major = [int]$verParts[0]
        $minor = [int]$verParts[1]
        if ($major -lt 6 -or ($major -eq 6 -and $minor -lt 2)) {
            Write-Host "⚠️ PERINGATAN KRITIS: Terdeteksi Redis v$redisVer (di bawah versi minimum 6.2.0)!" -ForegroundColor Red
            Write-Host "   BullMQ v5 membutuhkan Redis >= 6.2.0. Redis 5.0.x (tporadowski) akan memicu error saat submit di /intake!" -ForegroundColor Yellow
            Write-Host "   Solusi Native Windows (Zero-WSL, Zero-Docker):" -ForegroundColor White
            Write-Host "   👉 Pasang Memurai: winget install --id Memurai.MemuraiDeveloper -e --source winget" -ForegroundColor Yellow
            Write-Host "   👉 Atau unduh port native Redis 7: https://github.com/redis-windows/redis-windows" -ForegroundColor Yellow
        } else {
            Write-Host "✓ Redis broker aktif di port 6379 (Redis v$redisVer, kompatibel dengan BullMQ v5)." -ForegroundColor Green
        }
    } else {
        Write-Host "✓ Redis broker aktif di port 6379." -ForegroundColor Green
    }
} else {
    Write-Host "⚠️ PERINGATAN: Redis broker port 6379 belum aktif! Antrian BullMQ tidak dapat memproses job." -ForegroundColor Red
    Write-Host "   Jalankan Memurai/Redis atau Docker: docker compose up -d redis" -ForegroundColor DarkGray
}

# Deteksi Path Tesseract untuk Diwariskan ke Subproses
$TessStandardPaths = @(
    "C:\Program Files\Tesseract-OCR",
    "C:\Program Files (x86)\Tesseract-OCR",
    "$env:LOCALAPPDATA\Programs\Tesseract-OCR"
)

$TessPrefixScript = ""
foreach ($p in $TessStandardPaths) {
    if (Test-Path (Join-Path $p "tesseract.exe")) {
        $TessPrefixScript = "`$env:PATH = '$p;' + `$env:PATH; "
        $env:PATH = "$p;" + $env:PATH
        break
    }
}

# 1. Menjalankan Microservice OCR (Port 8001) - Prioritas: Rust Native Engine
Write-Host "`n[1/4] Menjalankan Microservice Vision & OCR (Port 8001)..." -ForegroundColor Yellow
$RustExe = Join-Path $ProjectDir "rust-services\goro-engine\target\release\goro-engine.exe"
$OcrDir = Join-Path $ProjectDir "python-services\ocr"
$PythonExe = Join-Path $OcrDir "venv\Scripts\python.exe"

if (Test-Path $RustExe) {
    $RustCmd = "$TessPrefixScript`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - Rust Native OCR Engine (Port 8001)'; Set-Location '$ProjectDir'; & '$RustExe' --host 127.0.0.1 --port 8001"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $RustCmd
    Write-Host "✓ Jendela Rust Native OCR Engine berhasil dibuka." -ForegroundColor Green
} elseif (Test-Path $OcrDir) {
    if (-not (Test-Path $PythonExe)) {
        $PythonExe = "python"
    }
    $PyCmd = "$TessPrefixScript`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - Python OCR Microservice (Port 8001)'; Set-Location '$OcrDir'; & '$PythonExe' -m uvicorn main:app --host 127.0.0.1 --port 8001"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $PyCmd
    Write-Host "✓ Jendela Python OCR Microservice (Fallback) berhasil dibuka." -ForegroundColor Green
} else {
    Write-Host "⚠️ Binary Rust belum dikompilasi. Jalankan: npm run rust:build atau npm run setup:all" -ForegroundColor Red
}

# 2. Menjalankan BullMQ OCR Queue Worker
Write-Host "`n[2/4] Menjalankan Background Worker BullMQ OCR..." -ForegroundColor Yellow
$OcrWorkerCmd = "$TessPrefixScript`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - BullMQ OCR Worker'; Set-Location '$ProjectDir'; npm run worker:ocr"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $OcrWorkerCmd
Write-Host "✓ Jendela BullMQ OCR Worker berhasil dibuka." -ForegroundColor Green

# 3. Menjalankan BullMQ Bulk Import Queue Worker
Write-Host "`n[3/4] Menjalankan Background Worker BullMQ Bulk Import..." -ForegroundColor Yellow
$ImportWorkerCmd = "$TessPrefixScript`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - BullMQ Import Worker'; Set-Location '$ProjectDir'; npm run worker:import"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $ImportWorkerCmd
Write-Host "✓ Jendela BullMQ Import Worker berhasil dibuka." -ForegroundColor Green

# 4. Menjalankan Next.js Web Server
Write-Host "`n[4/4] Menjalankan Next.js Web App (Port 3000)..." -ForegroundColor Yellow
$WebCmd = "`$Host.UI.RawUI.WindowTitle = 'GORO S2JB - Next.js Web Application (Port 3000)'; Set-Location '$ProjectDir'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $WebCmd
Write-Host "✓ Jendela Next.js Web App berhasil dibuka." -ForegroundColor Green

# Tampilkan Informasi Akses
Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "   🚀 SELURUH LAYANAN GORO S2JB BERHASIL DIJALANKAN!            " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "🌐 URL Aplikasi    : http://localhost:3000" -ForegroundColor White
Write-Host "🩺 Health Check    : http://localhost:3000/api/health" -ForegroundColor White
Write-Host "👁️  OCR Service Docs: http://127.0.0.1:8001/docs" -ForegroundColor White
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "🔑 Kredensial Uji Coba Cepat (Password: password123):" -ForegroundColor White
Write-Host "  • Petugas Lapangan: petugas_rivai      -> http://localhost:3000/intake" -ForegroundColor Yellow
Write-Host "  • Pegawai Triase  : pegawai_operator   -> http://localhost:3000/triage" -ForegroundColor Yellow
Write-Host "  • Manager UID S2JB: manager_s2jb       -> http://localhost:3000/reports" -ForegroundColor Yellow
Write-Host "  • Super Admin     : superadmin         -> http://localhost:3000/users" -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Tips: Tutup masing-masing jendela PowerShell saat selesai menggunakan sistem.`n" -ForegroundColor DarkGray
