@echo off
REM ==============================================================================
REM GORO S2JB - Windows Batch Setup (Klik 2 Kali untuk Inisialisasi Pertama Kali)
REM ==============================================================================
title GORO S2JB Setup
cd /d "%~dp0\.."

echo ==================================================================
echo    ⚡ GORO S2JB - SETUP & INISIALISASI (WINDOWS)
echo ==================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"

echo.
pause
