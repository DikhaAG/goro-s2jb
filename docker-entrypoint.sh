#!/bin/sh
set -e

# Automatically apply database migrations on startup if DATABASE_URL is provided
if [ -n "$DATABASE_URL" ]; then
  echo "📦 Menjalankan migrasi basis data Prisma..."
  npx prisma migrate deploy

  # Auto-seed initial master accounts only if database has no existing users
  EXIT_CODE=0
  node -e '
    const { PrismaClient } = require("@prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    async function check() {
      try {
        const count = await prisma.user.count();
        if (count === 0) {
          process.exit(10);
        }
        process.exit(0);
      } catch (e) {
        process.exit(0);
      } finally {
        await prisma.$disconnect();
        await pool.end();
      }
    }
    check();
  ' || EXIT_CODE=$?

  if [ "$EXIT_CODE" -eq 10 ]; then
    echo "🌱 Basis data belum memiliki pengguna, melakukan seed akun awal..."
    npm run prisma:seed || echo "Peringatan: Gagal melakukan seed data awal."
  fi
fi

exec "$@"

