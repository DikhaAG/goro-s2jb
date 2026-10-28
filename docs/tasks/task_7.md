# Task 7: Pengujian End-to-End, Observabilitas & Orkestrasi Produksi Lokal

> **Status:** Completed / Verified ✅  
> **Fase:** 2 (Integrasi Sistem, Pengujian Mutu & Kesiapan Operasional)  
> **Target Audiens:** DevOps/Site Reliability Engineer, QA/Test Automation Engineer, Full-Stack Lead  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 3: Arsitektur Fundamental, Bagian 6: Roadmap MVP)
> - [`.agents/skills/nextjs-best-practices/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/nextjs-best-practices/)
> - [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/)
> - [`.agents/skills/diagnosing-bugs/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/diagnosing-bugs/)

---

## 1. Ringkasan & Tujuan Task

Mengintegrasikan seluruh subsistem aplikasi GORO S2JB (Modul 4.1 s/d 4.4, Fondasi Teknis, dan RBAC) ke dalam **alur kerja operasional utuh (*Critical User Journey*)**, memastikan mutu pengujian end-to-end terotomatisasi, menyiapkan observabilitas sistem, serta merancang orkestrasi infrastruktur lokal yang mandiri (*Self-Contained Local Deployment*).

Sesuai spesifikasi PRD versi 2.2 (*Local-Optimized MVP*), sistem harus dapat dijalankan secara andal di dalam jaringan internal infrastruktur *server* lokal PLN UID S2JB tanpa ketergantungan pada layanan cloud pihak ketiga yang rentan masalah otorisasi eksternal.

---

## 2. Struktur Sub-Task Hierarkis

* **Task 7.1:** Pengujian Integrasi End-to-End Terotomatisasi (Playwright E2E Suite)
* **Task 7.2:** Optimalisasi Pola App Router & UX Resiliensi (Mengacu `nextjs-best-practices`)
* **Task 7.3:** Observabilitas, Health-Check Terpadu & Structured Logging
* **Task 7.4:** Orkestrasi Lingkungan Produksi Lokal (Docker Compose & Automated Backup)

---

## 3. Instruksi Teknis Rinci

### 3.1 Task 7.1: Pengujian Integrasi End-to-End (Playwright E2E Suite)
1. **Target File:**
   * `playwright.config.ts`
   * `tests/e2e/criticalUserJourney.spec.ts`
2. **Skenario Pengujian Alur Kritis (The Full Loop):**
   * **Tahap 1 (Petugas Lapangan):** Login akun lapangan $\rightarrow$ akses `/intake` $\rightarrow$ memilih UP3 PALEMBANG & ULP RIVAI $\rightarrow$ menginput nama pengulas target $\rightarrow$ mengunggah foto bukti eviden $\rightarrow$ submit berhasil dalam <500ms $\rightarrow$ form me-reset untuk entri berikutnya.
   * **Tahap 2 (Background Processing):** BullMQ worker memproses job OCR di latar belakang $\rightarrow$ mengekstrak teks via microservice Python $\rightarrow$ menghitung kemiripan (disimulasikan pada zona marginal 78%) $\rightarrow$ record berubah status menjadi `NEEDS_REVIEW` (Zona Kuning).
   * **Tahap 3 (Pegawai Operator):** Login akun pegawai $\rightarrow$ membuka `/operator/triage` $\rightarrow$ ulasan dari Tahap 2 muncul di antrean $\rightarrow$ pegawai menekan hotkey `A` untuk *Approve* $\rightarrow$ status ulasan beralih menjadi `APPROVED` dan tercatat audit trail.
   * **Tahap 4 (Manager):** Login akun manajer $\rightarrow$ membuka `/manager/reports` $\rightarrow$ angka Realisasi Harian pada ULP RIVAI bertambah 1 dan persentase capaian terakumulasi otomatis $\rightarrow$ manajer mengunduh laporan `.xlsx`.
   * **Tahap 5 (Anti-Fraud Check):** Mengunggah kembali gambar bukti yang sama persis $\rightarrow$ sistem mendeteksi kesamaan pHash (Hamming distance 0) $\rightarrow$ sistem menandai `isDuplicate = true` dan mengaitkannya ke entri pertama tanpa menghapus data.

---

### 3.2 Task 7.2: Optimalisasi Pola App Router & Resiliensi (Next.js Best Practices)
1. **Target File:**
   * `src/app/(field)/loading.tsx` & `src/app/(field)/error.tsx`
   * `src/app/(operator)/loading.tsx` & `src/app/(operator)/error.tsx`
   * `src/app/(manager)/loading.tsx` & `src/app/(manager)/error.tsx`
   * `src/app/not-found.tsx`
2. **Kepatuhan Panduan `.agents/skills/nextjs-best-practices/SKILL.md`:**
   * **Server vs Client Components:**
     - Pisahkan komponen secara disiplin: layout dan halaman dasar bertindak sebagai Server Components untuk *data fetching* awal, sedangkan komponen interaktif (form input, tabel virtualisasi, chart) menggunakan direktif `'use client'`.
   * **Loading Skeletons (`loading.tsx`):**
     - Sediakan tampilan skeleton loading bernuansa taktis di setiap grup rute sehingga transisi halaman terasa mulus dan tidak memicu layout shift (*CLS = 0*).
   * **Error Boundaries (`error.tsx`):**
     - Tangani kegagalan jaringan atau server secara anggun tanpa menyebabkan layar putih (*white screen of death*), dilengkapi tombol *Coba Lagi* (*Try Again*).

---

### 3.3 Task 7.3: Observabilitas, Health-Check Terpadu & Structured Logging
1. **Target File:**
   * `src/app/api/health/route.ts`
   * `src/lib/logger.ts`
2. **Endpoint Health-Check Terpadu (`GET /api/health`):**
   * Mengembalikan status konektivitas infrastruktur secara berkala:
     ```json
     {
       "status": "healthy",
       "timestamp": "2026-10-28T09:55:00.000Z",
       "services": {
         "database": { "status": "up", "latency_ms": 12 },
         "redis": { "status": "up", "latency_ms": 4 },
         "bullmq": { "status": "up", "waiting_jobs": 0, "active_jobs": 1 },
         "python_ocr": { "status": "up", "latency_ms": 45 },
         "storage": { "status": "up", "disk_free_gb": 184 }
       }
     }
     ```
3. **Structured Logging (Pino):**
   * Standardisasi format log JSON dengan atribut: level (`info`, `warn`, `error`), timestamp ISO, `traceId`, modul asal, dan durasi eksekusi.
   * Rotasi log harian disimpan di folder `./logs/` dengan retensi 30 hari.

---

### 3.4 Task 7.4: Orkestrasi Lingkungan Produksi Lokal & Backup Terjadwal
1. **Target File:**
   * `docker-compose.yml`
   * `docker-compose.prod.yml`
   * `Dockerfile` (Next.js multi-stage build)
   * `python-services/ocr/Dockerfile`
   * `scripts/backup-db.sh`
   * `scripts/restore-db.sh`
2. **Orkestrasi Docker Compose Mandiri:**
   * Konfigurasi layanan terisolasi dalam satu jaringan internal (`goro-network`):
     - `postgres`: PostgreSQL 16 dengan volume data persisten (`pg_data`).
     - `redis`: Redis alpine dengan konfigurasi persistensi append-only (`redis_data`).
     - `ocr-service`: Kontainer microservice Python OCR FastAPI.
     - `web-app`: Next.js web application server.
     - `worker-ocr` & `worker-import`: Kontainer latar belakang pemroses antrean BullMQ.
3. **Skrip Backup Otomatis (`scripts/backup-db.sh`):**
   * Eksekusi `pg_dump` otomatis yang dikompresi ke `./backups/db/goro_backup_[TIMESTAMP].sql.gz`.
   * Skrip retensi: menghapus file backup lokal yang berumur lebih dari 30 hari untuk menjaga ketersediaan ruang penyimpanan.

---

## 4. Kriteria Penerimaan (Acceptance Criteria)

- [x] **AC-1 (E2E Suite Green):** Pengujian Playwright & Vitest Full-Loop berhasil mengeksekusi alur penuh (Input Lapangan $\rightarrow$ OCR Background $\rightarrow$ Triase Pegawai $\rightarrow$ Laporan Manajer $\rightarrow$ Ekspor Excel) dengan tingkat kelulusan 100%.
- [x] **AC-2 (Zero Cloud Dependency):** Seluruh stack aplikasi dapat berjalan secara luring (*offline/local network*) tanpa bergantung pada koneksi internet publik atau layanan cloud eksternal.
- [x] **AC-3 (Single-Command Spin Up):** Perintah `docker compose up -d` berhasil mengangkat seluruh layanan (PostgreSQL, Redis, Python OCR, Web App, dan Workers) dalam kondisi siap pakai dalam waktu < 2 menit.
- [x] **AC-4 (Resilient UX & Error Handling):** Halaman `loading.tsx` dan `error.tsx` aktif secara benar saat data dimuat atau terjadi gangguan simulasi koneksi.
- [x] **AC-5 (Health-Check Integrity):** Endpoint `GET /api/health` merespon dengan status HTTP 200 dan detail metrik konektivitas seluruh subsistem yang akurat.
- [x] **AC-6 (Backup & Restore Verification):** Skrip `backup-db.sh` berhasil membuat salinan basis data PostgreSQL, dan skrip `restore-db.sh` mampu memulihkan data tersebut secara utuh pada instance basis data bersih.

---

## 5. Matriks Berkas yang Dibuat / Diubah

| Jalur Berkas | Aksi | Deskripsi Perubahan |
| :--- | :--- | :--- |
| `playwright.config.ts` | Dibuat | Konfigurasi framework pengujian end-to-end Playwright |
| `tests/e2e/criticalUserJourney.spec.ts` | Dibuat | Skenario uji alur kerja multi-peran dari input hingga pelaporan |
| `src/app/(field)/loading.tsx` & `error.tsx` | Dibuat | Skeleton loading dan error boundary untuk area petugas lapangan |
| `src/app/(operator)/loading.tsx` & `error.tsx`| Dibuat | Skeleton loading dan error boundary untuk antarmuka triase |
| `src/app/(manager)/loading.tsx` & `error.tsx` | Dibuat | Skeleton loading dan error boundary untuk dasbor eksekutif |
| `src/app/not-found.tsx` | Dibuat | Halaman 404 taktis ramah pengguna jika rute tidak ditemukan |
| `src/app/api/health/route.ts` | Dibuat | Endpoint pemantau kesehatan menyeluruh (DB, Redis, OCR, Storage) |
| `src/lib/logger.ts` | Dibuat | Konfigurasi structured logging (Pino) dengan rotasi harian |
| `docker-compose.yml` | Dibuat | Definisi orkestrasi multi-kontainer untuk lingkungan lokal/produksi |
| `Dockerfile` | Dibuat | Multi-stage build Docker image Next.js yang dioptimalkan |
| `python-services/ocr/Dockerfile` | Dibuat | Docker image mandiri untuk microservice Python OCR & pHash |
| `scripts/backup-db.sh` | Dibuat | Skrip backup terjadwal PostgreSQL dump terkompresi |
| `scripts/restore-db.sh` | Dibuat | Skrip pemulihan database dari berkas dump cadangan |

---

## 6. Titik Uji & Pengujian (TDD Seams)

1. **System Health Seam:** Uji endpoint `/api/health` saat Redis atau Python OCR sengaja dimatikan: respon harus mengembalikan status `"degraded"` dengan kode status yang tepat tanpa crash server.
2. **E2E Critical Journey Seam:** Jalankan Playwright headless test untuk memvalidasi alur integrasi antar-peran.
3. **Database Backup Integrity Seam:** Uji skrip backup terhadap database pengujian, verifikasi berkas `.sql.gz` terbentuk, lalu jalankan `restore-db.sh` ke database alternatif dan bandingkan kesamaan jumlah baris data di tabel `RatingReview`.
