#!/usr/bin/env bash
# ==============================================================================
# GORO S2JB - Production Automated Deployment Script (Ubuntu Server)
# Melakukan backup database, pull kode terbaru, build kontainer, dan healthcheck.
# ==============================================================================

set -euo pipefail

# Warna output terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_DIR}"

echo -e "${CYAN}==================================================================${NC}"
echo -e "${BOLD}${CYAN}   🚀 GORO S2JB - OTOMASI DEPLOYMENT PRODUKSI DOCKER             ${NC}"
echo -e "${CYAN}==================================================================${NC}"
echo -e "${BLUE}Waktu Eksekusi : $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}Direktori Proyek: ${PROJECT_DIR}${NC}\n"

# 1. Pengecekan Ketersediaan Docker & Docker Compose
if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker belum terpasang di sistem ini.${NC}"
    exit 1
fi

DOCKER_CMD="docker compose"
if ! docker compose version >/dev/null 2>&1; then
    if command -v docker-compose >/dev/null 2>&1; then
        DOCKER_CMD="docker-compose"
    else
        echo -e "${RED}❌ Error: Docker Compose plugin tidak ditemukan.${NC}"
        exit 1
    fi
fi

# 2. Pencadangan Basis Data Otomatis Sebelum Pembaruan (Pre-Deploy Backup)
if [ -f "${PROJECT_DIR}/scripts/backup-db.sh" ]; then
    echo -e "${YELLOW}[1/5] Melakukan pencadangan basis data otomatis sebelum pembaruan...${NC}"
    bash "${PROJECT_DIR}/scripts/backup-db.sh" || echo -e "${YELLOW}⚠️ Peringatan: Backup database dilewati (database baru atau belum aktif).${NC}"
fi

# 3. Menarik Kode Sumber Terbaru dari Git
echo -e "\n${YELLOW}[2/5] Menarik pembaruan kode dari branch main...${NC}"
git fetch origin main
git pull origin main

# 4. Memastikan Berkas Lingkungan (.env) Tersedia
if [ ! -f "${PROJECT_DIR}/.env" ]; then
    echo -e "${YELLOW}⚠️ Berkas .env tidak ditemukan. Menyalin dari .env.example...${NC}"
    cp "${PROJECT_DIR}/.env.example" "${PROJECT_DIR}/.env"
fi

# Membaca port aplikasi dari .env
APP_PORT=$(grep -E '^PORT=' .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "3020")
if [ -z "${APP_PORT}" ]; then
    APP_PORT="3020"
fi

# 5. Membangun dan Menjalankan Kontainer dengan Docker Compose
echo -e "\n${YELLOW}[3/5] Membangun image dan menyalakan kontainer (Zero-Downtime Rebuild)...${NC}"
sudo ${DOCKER_CMD} up -d --build

# 6. Menunggu Layanan Siap & Melakukan Health Check Otomatis
echo -e "\n${YELLOW}[4/5] Menunggu inisialisasi kontainer dan healthcheck...${NC}"
MAX_RETRIES=15
RETRY_COUNT=0
HEALTHY=false

while [ "${RETRY_COUNT}" -lt "${MAX_RETRIES}" ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${BLUE}  Pemeriksaan kesehatan [${RETRY_COUNT}/${MAX_RETRIES}] ke port ${APP_PORT}...${NC}"
    
    if curl -s -f "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    sleep 4
done

if [ "${HEALTHY}" = true ]; then
    echo -e "${GREEN}✓ Healthcheck BERHASIL! Aplikasi merespons di port ${APP_PORT}.${NC}"
else
    echo -e "${RED}⚠️ Peringatan: Endpoint healthcheck belum merespons dalam waktu tunggu.${NC}"
    echo -e "${YELLOW}Silakan periksa log aplikasi dengan: sudo ${DOCKER_CMD} logs --tail=50 web-app${NC}"
fi

# 7. Pembersihan Image Gantung (Prune Dangling Images)
echo -e "\n${YELLOW}[5/5] Membersihkan image cache yang tidak lagi digunakan...${NC}"
sudo docker image prune -f >/dev/null 2>&1 || true

# 8. Status Akhir
echo -e "\n${CYAN}==================================================================${NC}"
echo -e "${BOLD}${GREEN}   🎉 DEPLOYMENT SELESAI DENGAN SUKSES!                           ${NC}"
echo -e "${CYAN}==================================================================${NC}"
sudo ${DOCKER_CMD} ps
echo -e "\n${GREEN}🌐 Aplikasi siap digunakan di: http://127.0.0.1:${APP_PORT}${NC}\n"
