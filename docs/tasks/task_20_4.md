# Task 20.4: Peningkatan Antarmuka Dasbor Super Admin: Pipeline Flow & Network Visualizer

> **Status:** Completed ✅  
> **Inisiatif:** Arsitektur Monitoring Proses Latar Belakang & Jaringan (Fase 3)  
> **Fokus Utama:** Frontend UI Engineering, Real-Time Telemetry Cards, Pipeline Flow Visualization, & Live Log Console  
> **Target Berkas yang Dimodifikasi/Dibuat:**
> - [`src/app/(admin)/system-processes/page.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/app/(admin)/system-processes/page.tsx)
> - `src/components/admin/system/PipelineFlowVisualizer.tsx` (Baru - Dasbor Super Admin)
> - `src/components/admin/system/NetworkCdnMetricsCard.tsx` (Baru - Dasbor Super Admin)
> - [`src/components/admin/system/LiveLogViewer.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/admin/system/LiveLogViewer.tsx)
> - [`src/components/admin/system/ServiceStatusGrid.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/admin/system/ServiceStatusGrid.tsx)
> - `src/components/operator/reviews/OperatorPipelineStatusBar.tsx` (Baru - Indikator Ringkas Khusus Pegawai)
> **Aturan Khusus:** Bebas dari karakter Em Dash, standar tipografi minimum font size >= 12px (`text-xs`), dan Apple Design guidelines.

---

## 1. Konteks Masalah & Kebutuhan Teknis

Halaman Super Admin pada [src/app/(admin)/system-processes/page.tsx](file:///Users/a69/Desktop/goro-s2jb/src/app/(admin)/system-processes/page.tsx) saat ini telah memiliki:
- `ServiceStatusGrid`: Menampilkan status 4 port utama (5432, 6379, 8001, 3000).
- `RunningProcessTable`: Menampilkan tabel proses OS hasil filter aplikasi.
- `LiveLogViewer`: Membaca potongan baris log aktif.
- `SystemResourceGauge`: Menampilkan penggunaan memori dan CPU server.

Namun, antarmuka saat ini belum menyajikan **gambaran menyeluruh aliran data (Pipeline Flow)** dan **visibilitas jaringan pengunduhan CDN/Google Drive**:
1. Administrator tidak dapat melihat hubungan visual antara `File Ingestion` -> `importQueue` -> `Batch DB` -> `ocrQueue` -> `CDN/Drive Fetch` -> `Python OCR` -> `Anti-Fraud` -> `Database`.
2. Tidak ada kartu metrik jaringan khusus untuk memantau performa pengunduhan Google Drive (rata-rata latensi ms, total byte yang dialirkan, dan error 403 throttling).
3. Live Log Viewer belum memiliki tombol cepat untuk beralih antar 3 berkas log (`worker_import.log`, `worker_ocr.log`, `ocr_service.log`) dan belum memiliki fitur pencarian kata kunci (*log search filter*).

---

## 2. Rincian Pekerjaan & Spesifikasi Komponen

### Langkah 1: Membangun Komponen `PipelineFlowVisualizer.tsx`
Buat berkas `src/components/admin/system/PipelineFlowVisualizer.tsx`:
- Menampilkan rantai node interaktif:
  1. `Ingesti Berkas`: Status streaming CSV/XLSX.
  2. `importQueue`: Jumlah job aktif dan waiting.
  3. `ocrQueue`: Jumlah job antrean pemrosesan ulasan.
  4. `CDN / Drive Fetch`: Kecepatan unduh citra dan indikator latensi.
  5. `Python OCR Vision`: Status microservice Tesseract.
  6. `Anti-Fraud pHash`: Detektor duplikasi visual.
  7. `PostgreSQL Store`: Laju penyimpanan ulasan terverifikasi.
- Setiap simpul memiliki badge status (HIJAU jika normal, KUNING jika antrean menumpuk, MERAH jika layanan mati) dan indikator denyut (*heartbeat pulse*).
- Menampilkan throughput aktual (jobs/menit) di antara transisi antar-simpul.

### Langkah 2: Membangun Komponen `NetworkCdnMetricsCard.tsx`
Buat berkas `src/components/admin/system/NetworkCdnMetricsCard.tsx`:
- Mengonsumsi data telemetri dari `getEvidenceDownloaderMetrics()` via tRPC atau health query.
- Menyajikan 4 metrik utama:
  1. **Rata-rata Latensi Unduh:** Nilai dalam ms dengan indikator warna (Hijau < 400ms, Kuning 400-1000ms, Merah > 1000ms).
  2. **Total Streaming Memori (Zero-Storage):** Menampilkan akumulasi MB data yang dialirkan langsung tanpa menulis ke disk.
  3. **Efektivitas Endpoint Kandidat:** Visualisasi persentase keberhasilan 3 endpoint (UC vs UserContent vs LH3 CDN).
  4. **Status Throttling / Rate-Limit:** Menampilkan status aman atau peringatan jika terdeteksi respon HTTP 403/429.

### Langkah 3: Penyempurnaan `LiveLogViewer.tsx`
Perbarui [src/components/admin/system/LiveLogViewer.tsx](file:///Users/a69/Desktop/goro-s2jb/src/components/admin/system/LiveLogViewer.tsx):
- Tambahkan segmented control atau pill tab untuk memilih berkas aktif:
  - `Worker Impor (worker_import.log)`
  - `Worker OCR (worker_ocr.log)`
  - `Microservice Python (ocr_service.log)`
- Tambahkan kotak input pencarian teks secara instan pada baris-baris log yang tampil.
- Tambahkan toggle `Auto-scroll` dan tombol `Unduh Log Mentah`.

### Langkah 4: Integrasi Halaman `/system-processes`
Perbarui [src/app/(admin)/system-processes/page.tsx](file:///Users/a69/Desktop/goro-s2jb/src/app/(admin)/system-processes/page.tsx):
- Pasang `PipelineFlowVisualizer` di bagian atas halaman sebagai ringkasan arsitektur visual.
- Pasang `NetworkCdnMetricsCard` bersebelahan dengan `SystemResourceGauge`.
- Tambahkan tombol aksi cepat di header:
  - Tombol bahaya aman: "Bersihkan Proses Menggantung" (memanggil mutasi `cleanOrphanProcesses`).
  - Tombol kontrol: "Kelola Antrean" (shortcut ke modal kontrol antrean BullMQ).

---

## 3. Matriks Otorisasi & Hak Akses (RBAC: SUPER_ADMIN vs PEGAWAI)

| Aspek Antarmuka | SUPER_ADMIN | PEGAWAI (Operator / Verifikator) |
| :--- | :--- | :--- |
| **Akses Rute Halaman** | Akses eksklusif ke rute administrasi sistem [`/admin/system-processes`](file:///Users/a69/Desktop/goro-s2jb/src/app/(admin)/system-processes/page.tsx). | Akses ke rute admin diblokir (otomatis dialihkan ke `/reviews` atau `/triage`). |
| **Pipeline Flow Visualizer** | Menampilkan visualisasi rantai 7 node lengkap (`Ingesti` -> `importQueue` -> `ocrQueue` -> `CDN Fetch` -> `Python OCR` -> `Anti-Fraud` -> `Database`) beserta status denyut per detik. | Menampilkan widget mini `OperatorPipelineStatusBar.tsx` di header dasbor triase ulasan: hanya menampilkan status antrean ulasan aktif dan kesiapan mesin AI. |
| **Kartu Metrik Jaringan & CDN** | Melihat detail latensi CDN, efektivitas failover 3 endpoint URL, dan total volume biner streaming. | Tidak melihat kartu metrik jaringan mentah. |
| **Konsol Terminal Live Log** | Mengakses live viewer 3 log (`worker_import.log`, `worker_ocr.log`, `ocr_service.log`) lengkap dengan filter pencarian dan tombol download log. | Tidak memiliki akses ke log server internal demi mencegah kebocoran informasi sistem. |

---

## 4. Kriteria Keberhasilan & Verifikasi UI

1. **Standar Desain & Tipografi:**
   - Seluruh teks memiliki ukuran minimal $\ge 12\text{px}$ (`text-xs`).
   - Kontras warna teks memenuhi rasio WCAG AA (teks gelap `#0f172a` pada latar belakang terang `#f8fafc`).
   - Tepi kartu melengkung halus (`rounded-2xl`) dengan bayangan halus khas Apple Design (`shadow-sm`, border tipis `#e2e8f0`).
2. **Kinerja & Responsivitas:**
   - Polling interval 5 detik berjalan mulus tanpa menyebabkan layout shift atau flicker.
   - Pergantian tab log tidak memicu re-render berat pada tabel proses OS.
3. **Pemeriksaan Bebas Error:**
   - `npx tsc --noEmit` lulus dengan 0 error.

---

## 5. Panduan Eksekusi Mandiri untuk Agent

```bash
# 1. Buat src/components/admin/system/PipelineFlowVisualizer.tsx
# 2. Buat src/components/admin/system/NetworkCdnMetricsCard.tsx
# 3. Perbarui LiveLogViewer.tsx dan src/app/(admin)/system-processes/page.tsx
# 4. Verifikasi kompilasi TypeScript
npx tsc --noEmit

# 5. Jalankan verifikasi linting jika diperlukan
npm run lint
```

