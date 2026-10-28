@echo off
REM ==============================================================================
REM GORO S2JB - Windows Batch Launcher (Klik 2 Kali untuk Menjalankan)
REM ==============================================================================
title GORO S2JB Launcher
cd /d "%~dp0\.."

echo ==================================================================
echo    ⚡ GORO S2JB - COMMAND CENTER LAUNCHER (WINDOWS)
echo ==================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-windows.ps1"

pause
