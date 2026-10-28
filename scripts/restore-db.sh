#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# GORO S2JB Database Restore Script
# Restores a compressed PostgreSQL dump file to the database
# ==============================================================================

if [ "$#" -lt 1 ]; then
  echo "Penggunaan: $0 <path_to_backup_file.sql.gz>"
  echo "Contoh:     $0 ./backups/db/goro_backup_20261028_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Error: Berkas backup tidak ditemukan di '${BACKUP_FILE}'"
  exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-goro_admin}"
DB_NAME="${DB_NAME:-goro_s2jb}"
export PGPASSWORD="${DB_PASSWORD:-goro_secret_2026}"

echo "⚠️  PERINGATAN: Memulihkan database ${DB_NAME} dari ${BACKUP_FILE}..."

if command -v psql >/dev/null 2>&1; then
  gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}"
elif command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "goro-postgres"; then
  gunzip -c "${BACKUP_FILE}" | docker exec -i goro-postgres psql -U "${DB_USER}" -d "${DB_NAME}"
else
  echo "❌ Error: psql atau kontainer goro-postgres tidak ditemukan di sistem."
  exit 1
fi

echo "✅ Pemulihan database selesai dengan sukses."
