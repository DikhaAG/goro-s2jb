#!/usr/bin/env bash
# ==============================================================================
# GORO S2JB - Runner Tunggal Native (macOS / Linux)
# Menjalankan Python OCR, BullMQ Worker, dan Next.js Web App secara bersamaan
# dengan penanganan cleanup proses otomatis saat tombol Ctrl+C ditekan.
# ==============================================================================

set -e

# Pewarnaan Teks
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${CYAN}==================================================================${NC}"
echo -e "${CYAN}       ⚡ GORO S2JB - COMMAND CENTER LAUNCHER (macOS)            ${NC}"
echo -e "${CYAN}==================================================================${NC}"

# 1. Pengecekan Service Prasyarat
if ! nc -z localhost 5432 2>/dev/null; then
    echo -e "${YELLOW}⚠️ PostgreSQL tidak aktif di port 5432. Menyalakan...${NC}"
    brew services start postgresql@16 || brew services start postgresql || true
    sleep 2
fi

if ! nc -z localhost 6379 2>/dev/null; then
    echo -e "${YELLOW}⚠️ Redis tidak aktif di port 6379. Menyalakan...${NC}"
    brew services start redis || true
    sleep 1
fi

# Array penampung PID child processes
CHILD_PIDS=()

# Fungsi Cleanup saat keluar (Ctrl+C)
cleanup() {
    echo -e "\n\n${YELLOW}🛑 Menghentikan seluruh subsistem GORO S2JB...${NC}"
    for pid in "${CHILD_PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    wait 2>/dev/null || true
    echo -e "${GREEN}✓ Seluruh layanan berhasil dihentikan dengan bersih.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

mkdir -p "$PROJECT_DIR/logs"

# 2. Menjalankan Python OCR Microservice (Port 8001)
echo -e "${BLUE}[1/4] Menjalankan Microservice Python OCR (Port 8001)...${NC}"
OCR_PYTHON="$PROJECT_DIR/python-services/ocr/venv/bin/python"
if [ ! -f "$OCR_PYTHON" ]; then
    OCR_PYTHON="$PROJECT_DIR/python-services/ocr/venv/bin/python3"
fi
if [ ! -f "$OCR_PYTHON" ]; then
    OCR_PYTHON="python3"
fi

(
    cd python-services/ocr
    "$OCR_PYTHON" -m uvicorn main:app --host 127.0.0.1 --port 8001 --log-level info >> "$PROJECT_DIR/logs/ocr_service.log" 2>&1
) &
OCR_PID=$!
CHILD_PIDS+=($OCR_PID)
echo -e "${GREEN}✓ Microservice OCR berjalan di latar belakang (PID: $OCR_PID, log: logs/ocr_service.log)${NC}"

# 3. Menjalankan Background Worker BullMQ OCR
echo -e "${BLUE}[2/4] Menjalankan Background Worker BullMQ OCR...${NC}"
npm run worker:ocr >> "$PROJECT_DIR/logs/worker_ocr.log" 2>&1 &
WORKER_OCR_PID=$!
CHILD_PIDS+=($WORKER_OCR_PID)
echo -e "${GREEN}✓ Background Worker OCR berjalan di latar belakang (PID: $WORKER_OCR_PID, log: logs/worker_ocr.log)${NC}"

# 4. Menjalankan Background Worker BullMQ Bulk Import
echo -e "${BLUE}[3/4] Menjalankan Background Worker BullMQ Import...${NC}"
npm run worker:import >> "$PROJECT_DIR/logs/worker_import.log" 2>&1 &
WORKER_IMPORT_PID=$!
CHILD_PIDS+=($WORKER_IMPORT_PID)
echo -e "${GREEN}✓ Background Worker Import berjalan di latar belakang (PID: $WORKER_IMPORT_PID, log: logs/worker_import.log)${NC}"

# Tunggu sejenak agar background worker dan microservice siap
sleep 2

# 4. Tampilkan Panduan Akses Cepat
echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${BOLD}${GREEN}   🚀 SISTEM AKTIF & SIAP DIGUNAKAN!                             ${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo -e "🌐 ${BOLD}URL Aplikasi:${NC}    ${CYAN}http://localhost:3000${NC}"
echo -e "🩺 ${BOLD}Health-Check:${NC}    ${CYAN}http://localhost:3000/api/health${NC}"
echo -e "👁️  ${BOLD}OCR Service:${NC}     ${CYAN}http://127.0.0.1:8001/docs${NC}"
echo -e "------------------------------------------------------------------"
echo -e "${BOLD}🔑 Akun Uji Coba Cepat (Password: password123):${NC}"
echo -e "  • Petugas Lapangan:  ${YELLOW}petugas_rivai${NC}      -> /intake"
echo -e "  • Pegawai Triase:    ${YELLOW}pegawai_operator${NC}   -> /triage"
echo -e "  • Manager UID S2JB:  ${YELLOW}manager_s2jb${NC}       -> /reports"
echo -e "  • Super Admin:       ${YELLOW}superadmin${NC}         -> /users"
echo -e "------------------------------------------------------------------"
echo -e "${YELLOW}Tekan Ctrl+C untuk menghentikan semua layanan sekaligus.${NC}\n"

# 5. Menjalankan Next.js Web App di Foreground
echo -e "${BLUE}[4/4] Memulai Next.js Web Server...${NC}"
npm run dev
