#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# GORO S2JB Database Automated Backup Script
# Creates a compressed PostgreSQL dump with timestamp & 30-day retention
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups/db"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="${BACKUP_DIR}/goro_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-goro_admin}"
DB_NAME="${DB_NAME:-goro_s2jb}"
export PGPASSWORD="${DB_PASSWORD:-goro_secret_2026}"

echo "📦 Memulai pencadangan basis data GORO S2JB: ${DB_NAME} (${TIMESTAMP})..."

# If running inside or outside docker, attempt pg_dump directly
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_FILE}"
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "goro-postgres"; then
  docker exec -t goro-postgres pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_FILE}"
else
  echo "❌ Error: pg_dump atau kontainer goro-postgres tidak ditemukan di sistem."
  exit 1
fi

FILE_SIZE="$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')"
echo "✅ Salinan basis data berhasil dibuat:"
echo "   File: ${BACKUP_FILE}"
echo "   Ukuran: ${FILE_SIZE}"

# Retention Policy: Hapus cadangan lokal lebih dari 30 hari
echo "🧹 Membersihkan berkas cadangan kadaluwarsa (> 30 hari)..."
find "${BACKUP_DIR}" -name "goro_backup_*.sql.gz" -type f -mtime +30 -delete

echo "🎉 Proses backup selesai dengan sukses."
