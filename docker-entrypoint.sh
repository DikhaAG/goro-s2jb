#!/bin/sh
set -e

# Automatically apply database migrations and seed on startup if DATABASE_URL is provided and not skipped
if [ -n "$DATABASE_URL" ] && [ "$SKIP_DB_INIT" != "true" ]; then
  echo "📦 Menjalankan migrasi basis data Prisma..."
  npx prisma migrate deploy

  echo "🌱 Menjalankan inisialisasi data master awal (auto-seed)..."
  npm run prisma:seed || echo "⚠️ Peringatan: Proses seeding gagal atau dilewati."
fi

exec "$@"

