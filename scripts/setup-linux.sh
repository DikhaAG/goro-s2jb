#!/usr/bin/env bash
# ==============================================================================
# GORO S2JB - Skrip Inisialisasi Pertama Kali (Linux: Ubuntu / Debian / Fedora / Arch)
# Menyiapkan dependensi, virtual environment Python, migrasi DB, dan data seed.
# ==============================================================================

set -e

# Pewarnaan Teks
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==================================================================${NC}"
echo -e "${CYAN}   ⚡ GORO S2JB - PENGISIAN & INISIALISASI SISTEM NATIVE (Linux)   ${NC}"
echo -e "${CYAN}==================================================================${NC}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# 1. Pengecekan Prasyarat Software
echo -e "\n${BLUE}[1/7] Memeriksa Prasyarat Software di Linux...${NC}"

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ $1 belum terpasang.${NC} $2"
        return 1
    else
        echo -e "${GREEN}✓ $1 terdeteksi:${NC} $(command -v "$1")"
        return 0
    fi
}

MISSING_DEPS=0
check_command "node" "Node.js v20+ LTS diperlukan." || MISSING_DEPS=1
check_command "npm" "Disertakan bersama instalasi Node.js." || MISSING_DEPS=1
check_command "python3" "Python 3.10+ diperlukan." || MISSING_DEPS=1
check_command "psql" "PostgreSQL client diperlukan." || MISSING_DEPS=1
check_command "redis-cli" "Redis in-memory store client diperlukan." || MISSING_DEPS=1
check_command "tesseract" "Tesseract OCR engine diperlukan." || MISSING_DEPS=1

if [ $MISSING_DEPS -ne 0 ]; then
    echo -e "\n${RED}⚠️ Ada dependensi sistem yang belum terpasang.${NC}"
    echo -e "Silakan pasang paket yang dibutuhkan sesuai distribusi Linux Anda:"
    echo -e "${YELLOW}Ubuntu/Debian:${NC} sudo apt update && sudo apt install -y nodejs npm postgresql redis-server tesseract-ocr tesseract-ocr-ind python3 python3-venv python3-pip"
    echo -e "${YELLOW}Fedora/RHEL:${NC}   sudo dnf install -y nodejs npm postgresql-server redis tesseract tesseract-langpack-ind python3 python3-pip"
    echo -e "${YELLOW}Arch Linux:${NC}    sudo pacman -S --needed nodejs npm postgresql redis tesseract tesseract-data-ind python python-pip"
    exit 1
fi

# 2. Pengecekan Layanan Basis Data & Redis
echo -e "\n${BLUE}[2/7] Memeriksa Layanan Basis Data & Redis...${NC}"
if ! nc -z localhost 5432 2>/dev/null; then
    echo -e "${YELLOW}⚠️ PostgreSQL port 5432 tidak aktif. Mencoba mengaktifkan via systemctl/service...${NC}"
    sudo systemctl start postgresql 2>/dev/null || sudo service postgresql start 2>/dev/null || true
    sleep 2
fi

if ! nc -z localhost 6379 2>/dev/null; then
    echo -e "${YELLOW}⚠️ Redis port 6379 tidak aktif. Mencoba mengaktifkan via systemctl/service...${NC}"
    sudo systemctl start redis 2>/dev/null || sudo systemctl start redis-server 2>/dev/null || sudo service redis-server start 2>/dev/null || true
    sleep 1
fi

# 3. Setup File Konfigurasi .env
echo -e "\n${BLUE}[3/7] Memeriksa File Konfigurasi .env...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ File .env berhasil disalin dari .env.example.${NC}"
    else
        echo -e "${YELLOW}⚠️ .env.example tidak ditemukan. Membuat .env default...${NC}"
        cat << 'EOF' > .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/goro_s2jb?schema=public"
REDIS_URL="redis://localhost:6379"
STORAGE_PATH="./uploads"
OCR_SERVICE_URL="http://127.0.0.1:8001"
NODE_ENV="development"
NEXTAUTH_SECRET="goro-s2jb-secret-key-2026-production-ready"
NEXTAUTH_URL="http://localhost:3000"
BETTER_AUTH_SECRET="goro-s2jb-command-center-secret-key-pln-2026-production-secured-32chars"
BETTER_AUTH_URL="http://localhost:3000"
EOF
    fi
else
    echo -e "${GREEN}✓ File .env sudah tersedia.${NC}"
fi

# 4. Instalasi Dependensi Node.js
echo -e "\n${BLUE}[4/7] Memasang Dependensi Node.js (npm install)...${NC}"
npm install

# 5. Setup Python Virtual Environment untuk OCR
echo -e "\n${BLUE}[5/7] Menyiapkan Python Virtual Environment (Microservice OCR)...${NC}"
OCR_DIR="python-services/ocr"
if [ ! -d "$OCR_DIR/venv" ]; then
    echo "Membuat virtual environment di $OCR_DIR/venv..."
    python3 -m venv "$OCR_DIR/venv"
fi

echo "Memasang dependensi Python (Pillow, RapidFuzz, Pytesseract, FastAPI, Uvicorn)..."
"$OCR_DIR/venv/bin/pip" install --upgrade pip
"$OCR_DIR/venv/bin/pip" install -r "$OCR_DIR/requirements.txt"
echo -e "${GREEN}✓ Virtual environment Python OCR siap digunakan.${NC}"

# 6. Inisialisasi Database (Prisma Generate, Migrate, Seed)
echo -e "\n${BLUE}[6/7] Menyiapkan Skema Database & Data Seed...${NC}"
mkdir -p uploads logs

npx prisma generate
npx prisma migrate dev --name init || npx prisma migrate deploy
npm run prisma:seed

# 7. Selesai
echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${GREEN}   🎉 INISIALISASI SISTEM GORO S2JB DI LINUX SELESAI!            ${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo -e "Untuk langsung menjalankan sistem secara lengkap di Linux:"
echo -e "👉 ${YELLOW}./scripts/start-linux.sh${NC}"
echo -e "   atau"
echo -e "👉 ${YELLOW}npm run dev${NC} (terminal 1) & ${YELLOW}npm run worker:ocr${NC} (terminal 2)\n"

