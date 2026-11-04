# Runbook Pemulihan Operasional Layanan Latar Belakang & Jaringan

> **Dokumen Panduan Operasional:** Pemulihan Insiden & Disaster Recovery  
> **Target Aplikasi:** GORO S2JB 2026 (PLN UID S2JB)  
> **Klasifikasi:** Super Admin & Tim IT Operasi  
> **Tingkat Kritis:** High Availability

---

## 1. Ikhtisar Arsitektur Latar Belakang

Sistem GORO S2JB 2026 bergantung pada koordinasi empat subsistem utama:
1. **PostgreSQL (Port 5432):** Penyimpanan relasional ulasan, metadata batch migrasi, dan audit log.
2. **Redis Server (Port 6379):** Broker antrean BullMQ untuk `importQueue` dan `ocrQueue`.
3. **Python OCR Microservice (Port 8001):** Layanan ekstraksi teks citra berbasis FastAPI, Tesseract OCR, dan pHash Anti-Fraud.
4. **Next.js Web Server (Port 3000):** Frontend aplikasi dan backend tRPC API server.

---

## 2. Matriks Tanggap Darurat & Hak Akses (RBAC)

| Peran Pengguna | Kewenangan Tindakan Pemulihan | Tindakan yang Dibolehkan |
| :--- | :--- | :--- |
| **SUPER_ADMIN** | Akses Penuh Sistem & Host | Menghentikan proses (kill PID), membersihkan zombie/orphan, me-restart worker, menjeda/melanjutkan antrean BullMQ, dan menjalankan perintah terminal darurat. |
| **PEGAWAI** (Verifikator) | Pengamat Operasional Terbatas | Memantau indikator status pada dasbor ulasan, menyegarkan data antrean, melaporkan anomali ke Super Admin. Dilarang mengakses terminal dan rute administrasi sistem. |

---

## 3. Prosedur Penanganan Insiden Spesifik

### Kasus A: Port Terkunci atau Tabrakan Proses (Contoh Port 8001 / 6379)

**Gejala:** Port status menampilkan status DOWN atau DEGRADED, service gagal start dengan error `EADDRINUSE`.

**Langkah Pemulihan:**
1. Periksa PID proses yang menahan port terkait:
   ```bash
   lsof -i :8001
   # atau untuk Redis:
   lsof -i :6379
   ```
2. Hentikan proses yang menahan port melalui dasbor `/admin/system-processes` atau via terminal:
   ```bash
   kill -15 $(lsof -t -i:8001)
   # Jika tidak merespons dalam 5 detik, gunakan penghentian paksa:
   kill -9 $(lsof -t -i:8001)
   ```
3. Mulai ulang microservice Python OCR:
   ```bash
   cd python-services/ocr
   source venv/bin/activate
   python main.py --port 8001
   ```
4. Pastikan status port kembali hijau (UP) pada dasbor `/admin/system-processes`.

---

### Kasus B: Antrean BullMQ Terhenti (Queue Stalled > 180 Detik)

**Gejala:** Alert `QUEUE_STALLED` muncul di dasbor Super Admin, throughput turun ke 0 job/menit, job berstatus active tidak berkurang.

**Langkah Pemulihan:**
1. Buka dasbor `/admin/system-processes`.
2. Klik tombol **Bersihkan Zombie** untuk menghentikan proses worker yatim piatu.
3. Di bagian kontrol antrean, lakukan jeda antrean (`pauseQueue`) selama 5 detik, lalu klik lanjutkan antrean (`resumeQueue`).
4. Jika terdapat job yang gagal berturut-turut, klik tombol **Coba Ulang Seluruh Job Gagal** (`retryAllFailedJobs`).
5. Jika worker tidak merespons, lakukan restart worker latar belakang:
   ```bash
   npm run worker:ocr
   npm run worker:import
   ```

---

### Kasus C: Pembatasan Laju / Throttling Google Drive (HTTP 429 / 403)

**Gejala:** Alert `GDRIVE_RATE_LIMITED` aktif, kartu telemetri CDN menampilkan rasio kegagalan > 20%, log mencatat penolakan HTML challenge.

**Mekanisme Pemulihan Otomatis:**
- Sistem downloader memori (`evidenceDownloader.ts`) secara otonom melakukan rotasi otomatis ke 3 kandidat endpoint:
  - Kandidat 1: `drive.google.com/uc?id={fileId}&export=download`
  - Kandidat 2: `drive.usercontent.google.com/download?id={fileId}`
  - Kandidat 3: `lh3.googleusercontent.com/d/{fileId}`
- Respons berformat HTML (peringatan kuota/login Google) ditolak oleh filter Magic Bytes, sehingga sistem tidak mengonsumsi file rusak.

**Langkah Manual jika Throttling Masif Berlanjut:**
1. Jeda sementara antrean `ocrQueue` selama 2 sampai 5 menit agar kuota IP Google Drive pulih.
2. Pastikan file Google Drive berstatus *Public (Anyone with link can view)*.
3. Lanjutkan kembali antrean `ocrQueue`. Seluruh job yang sempat gagal dapat dijadwalkan ulang secara otomatis.

---

### Kasus D: Kebocoran Memori Worker (RSS > 500 MB)

**Gejala:** Alert `WORKER_MEMORY_HIGH` menyala, penggunaan memori RAM server melonjak tinggi (> 90%).

**Langkah Pemulihan:**
1. Identifikasi PID worker dengan konsumsi memori terbesar di tabel proses `/admin/system-processes`.
2. Klik tombol **Hentikan Proses** (Sinyal SIGTERM). Worker Node.js akan melakukan graceful shutdown.
3. Node supervisor atau skrip startup akan otomatis melahirkan proses worker baru dengan alokasi memori bersih.
4. Lakukan pembersihan buffer log dengan memicu garbage collector jika diperlukan.

---

## 4. Perintah Cepat Diagnostik (CLI Cheat-Sheet)

```bash
# 1. Cek kesehatan seluruh port sistem
npm run test tests/integration/backgroundResilience.test.ts

# 2. Cek log real-time worker OCR
tail -f logs/worker_ocr.log

# 3. Cek log real-time worker Impor
tail -f logs/worker_import.log

# 4. Cek log runtime Python OCR Service
tail -f logs/ocr_service.log

# 5. Cek koneksi socket Redis
redis-cli ping
# Respon yang diharapkan: PONG
```

---

## 5. Kepatuhan Audit Trail

Seluruh tindakan intervensi darurat yang dilakukan oleh Super Admin (seperti penghentian paksa proses, pembersihan zombie, penjedaan antrean, atau penghapusan job) wajib menyertakan alasan minimal 5 karakter dan secara otomatis dicatat ke tabel `AuditLog`. Rekam jejak audit bersifat permanen dan tidak dapat dihapus oleh operator biasa.

