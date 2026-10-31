# Task 19: Sistem Training Engine OCR & Continuous Active Learning (Human-in-the-Loop)

> **Status:** Selesai / Completed (Subtask 19.1 - 19.6 Lolos 100%) ✅  
> **Fase:** 4 (Kecerdasan Buatan Tingkat Lanjut, Adaptasi Model Vision Kontinu, & Model Registry)  
> **Target Audiens:** AI/ML Engineer, Fullstack Next.js Engineer, System Architect, UI/UX Designer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Modul 4.2: Pemrosesan Citra & OCR)
> - [`docs/pipeline_impor_dan_pemrosesan_eviden.md`](file:///Users/a69/Desktop/goro-s2jb/docs/pipeline_impor_dan_pemrosesan_eviden.md) (Alur Pipeline Eviden & OCR Worker)
> - [`docs/ui_ux_guidelines.md`](file:///Users/a69/Desktop/goro-s2jb/docs/ui_ux_guidelines.md) (Design Source of Truth PLN UID S2JB)
> - [`src/server/services/ocrService.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/services/ocrService.ts) (Adapter OCR Service Node.js)
> - [`python-services/ocr/engine.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/engine.py) (Dual-Pass Tesseract OCR Engine)
> - [`python-services/ocr/matcher.py`](file:///Users/a69/Desktop/goro-s2jb/python-services/ocr/matcher.py) (Fuzzy String Matcher 3 Zona)
> - [`.agents/skills/tdd/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/SKILL.md) (Test-Driven Development & Pengujian Menyeluruh)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Core Anti-Slop Filter & Larangan Karakter Em Dash)

---

## 1. Latar Belakang Masalah & Urgensi Bisnis

### 1.1 Keterbatasan Model OCR Statis di Lapangan
Sistem validasi ulasan PLN Mobile saat ini mengandalkan OCR berbasis Tesseract statis dengan kamus bawaan (`ind+eng`). Dalam operasional nyata, variasi tangkapan layar ulasan Google Play Store sangat beragam:
1. **Ragam Resolusi & Font Rendering:** Berbagai perangkat Android pengguna memiliki densitas layar berbeda (hdpi, xhdpi, xxhdpi), tema Dark Mode vs Light Mode, serta jenis font kustom sistem operasi vendor (One UI, MIUI, ColorOS).
2. **Karakter Nama Pengulas Spesifik:** Nama pengulas Indonesia kerap memuat singkatan gelar, simbol unik, angka di belakang nama, atau ejaan kedaerahan yang sering salah dibaca oleh model OCR generik (misal: huruf `O` terbaca `0`, `I` terbaca `1`, atau `rn` terbaca `m`).
3. **Potensi Data Terverifikasi yang Terabaikan:** Puluhan ribu baris data historis yang diimpor dari Google Form / Spreadsheet ([`docs/testing/dataformasli.csv`](file:///Users/a69/Desktop/goro-s2jb/docs/testing/dataformasli.csv)) telah diverifikasi secara manual oleh pegawai pada sistem lama. Selain itu, setiap hari pegawai melakukan triase dan validasi ulasan di `/triage` dan `/reviews`. Seluruh aksi validasi manusia ini adalah aset *Ground Truth* bernilai tinggi yang belum dimanfaatkan untuk melatih ulang kecerdasan model.

### 1.2 Urgensi Sistem Training & Continuous Active Learning
Dibutuhkan sebuah sistem komprehensif yang:
1. Mampu mengumpulkan data latih secara otomatis saat pegawai melakukan validasi (*Human-in-the-Loop Active Learning*).
2. Mengakomodasi *cold-start* dari data historis spreadsheet yang kolomnya sudah dicentang/diverifikasi oleh pegawai sebelumnya.
3. Mendukung eksekusi training baik secara **manual on-demand** oleh operator maupun **otomatis berkala** (berdasarkan akumulasi threshold dan jadwal malam hari).
4. Mengadopsi arsitektur *Deep Learning Modern* (CRNN / TrOCR ringan) yang dipadukan dengan *Hybrid Domain Lexicon* (Kamus Istilah PLN Mobile & Pola Nama Pengulas).
5. Berjalan efisien dan stabil secara lintas platform (*cross-platform* di macOS Apple Silicon / Intel maupun Windows dengan auto-fallback CPU, MPS, atau CUDA).
6. Menyediakan *Model Registry* dengan persetujuan manual (Staging vs Active), metrik evaluasi komparatif (CER/WER), dan proteksi *instant rollback*.

---

## 2. Arsitektur Solusi & Alur Pengguna (User Journey)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             SUMBER DATA GROUND TRUTH (ACTIVE LEARNING)                           │
├───────────────────────────────────────────────────────┬──────────────────────────────────────────┤
│ 1. Cold-Start: Data Historis Spreadsheet Terverifikasi │ 2. Live Operator Actions (/triage & /reviews)│
│    (Row dengan validationStatus = APPROVED)           │    (Pegawai Approve / Koreksi Kuratif)   │
└───────────────────────────────────────────────────────┴──────────────────────────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PIPELINE KURASI & ANOTASI DATA LATIH (OcrTrainingDataset)                                         │
│ - Validasi kelayakan citra (format, dimensi, bukan duplikat ekstrem)                             │
│ - Ekstraksi Region of Interest (ROI crop teks pengulas & ulasan)                                 │
│ - Pasangan data: { image_crop_path, ground_truth_text, reviewer_name, validation_source }        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
┌──────────────────────────────────────────────┐ ┌─────────────────────────────────────────────────┐
│ TRIGGER 1: Otomatis Berkala (Dual-Trigger)   │ │ TRIGGER 2: Manual Operator (/ocr-training)      │
│ - Akumulasi Threshold (>= 100 data baru)     │ │ - Tombol "Mulai Training Sekarang"              │
│ - Jadwal Cron Malam (Low-traffic 02:00 WIB)  │ │ - Pilihan Mode: Cepat (Fast) / Cermat (Deep)   │
│ - Cooldown guard (min. 6 jam antar-auto)     │ │ - Pemilihan subset dataset / epoch parameter    │
└──────────────────────────────────────────────┘ └─────────────────────────────────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ANTREAN ASINKRON: BullMQ (ocrTrainingQueue) & ENGINE TRAINING PYTHON                             │
│ - Device Selector: CUDA (GPU) -> MPS (Apple Silicon) -> CPU (Universal Fallback)                 │
│ - Arsitektur: PyTorch CRNN / Lightweight TrOCR + Domain Lexicon Dictionary Builder               │
│ - Output: Model Checkpoint (.pt / .onnx), Vocabulary Map, Loss Logs, & Training Duration         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ BENCHMARK EVALUATOR & MODEL REGISTRY (Staging Area)                                              │
│ - Uji otomatis terhadap Benchmark Golden Dataset (50 sampel terkalibrasi)                        │
│ - Perhitungan Metrik: Character Error Rate (CER), Word Error Rate (WER), Similarity Delta        │
│ - Status: STAGING / DRAFT (Menunggu Persetujuan Operator / Super Admin)                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼ (Aksi Persetujuan Operator di Dasbor UI)
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MODEL PROMOTION, ZERO-DOWNTIME HOT-RELOAD, & INSTANT ROLLBACK                                    │
│ - Super Admin meninjau perbandingan metrik model baru vs model aktif                             │
│ - Tombol "Aktifkan Model": Hot-reload adapter Node.js tanpa restart server Next.js              │
│ - Tombol "Kembalikan (Rollback)": Kembali ke versi model stabil sebelumnya dalam 1 klik         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Matriks Hak Akses & Keamanan (RBAC)

Modul Training OCR mematuhi standar keamanan *Defense-in-Depth* 5 lapis:
1. **Layer 1 (Route Permissions):** Rute antarmuka `/ocr-training` hanya dapat diakses oleh role `[Role.PEGAWAI, Role.SUPER_ADMIN]`. Role `PETUGAS_LAPANGAN` ditolak secara mutlak.
2. **Layer 2 (tRPC Procedure Guards):**
   - Prosedur pembacaan data, metrik, dan riwayat dataset dapat diakses oleh `operatorProcedure` (Pegawai & Super Admin).
   - Prosedur pemicuan training manual dan promosi model / rollback dibatasi secara eksklusif untuk `superAdminProcedure` (atau Pegawai terotorisasi dengan log audit ketat).
3. **Layer 3 (Process Isolation):** Proses training berjalan di dalam worker latar belakang BullMQ dengan prioritas terisolasi, batas waktu timeout eksekusi, serta pembatasan memori agar tidak mengganggu performa server web Next.js dan pipeline OCR utama.
4. **Layer 4 (Audit Log Compliance):** Setiap aksi pemicuan training, pembatalan, aktivasi model, dan rollback model dicatat secara detail pada tabel `AuditLog`.

---

## 4. Pemecahan Subtask (Subtasks Breakdown)

Fitur kompleks ini dipecah menjadi 6 subtask terukur yang dapat dieksekusi secara independen dan bertahap:

### Subtask 19.1: Skema Database & Pipeline Kurasi Data Latih (Cold-Start & Active Learning)
* **Tujuan:** Menyediakan struktur data dan mekanisme pengumpulan dataset ground truth dari dua sumber: impor spreadsheet historis dan aksi validasi operator.
* **Komponen & Berkas:**
  - File Schema Prisma (`prisma/schema.prisma`):
    - Model `OcrTrainingSample`: Menyimpan pasangan gambar, teks ekstraksi awal, teks ground truth, sumber validasi (`IMPORT_SPREADSHEET`, `TRIAGE_VALIDATION`, `MANUAL_CURATION`), status inklusi (`PENDING`, `APPROVED_FOR_TRAIN`, `EXCLUDED`), dan metadata bounding box.
    - Model `OcrModelRegistry`: Menyimpan katalog versi model (`version`, `artifactPath`, `architecture`, `cerScore`, `werScore`, `trainedAt`, `isActive`, `trainedById`, `metadata`).
    - Model `OcrTrainingJob`: Menyimpan riwayat pekerjaan training (`status`, `progress`, `currentEpoch`, `totalEpochs`, `logs`, `error`, `durationMs`).
  - Harvester Service (`src/server/services/ocrDatasetHarvester.ts`):
    - Mengekstrak baris ulasan berstatus `APPROVED` dari data impor spreadsheet untuk *cold-start*.
    - Hook pemicu otomatis saat pegawai melakukan approval / curative update di `/triage` dan `/reviews`.
  - Filter & Deduplikasi Data Latih: Mengabaikan gambar buram, ukuran di bawah batas minimal, atau pHash yang identik ekstrem.

### Subtask 19.2: Engine Training Deep Learning Python & Hybrid Lexicon Pipeline
* **Tujuan:** Membangun pipeline training Python lintas platform yang efisien, menggabungkan pengenalan teks deep learning dengan kamus domain khusus.
* **Komponen & Berkas:**
  - Direktori Servis Python (`python-services/ocr_trainer/`):
    - `trainer.py`: Skrip training utama berbasis PyTorch dengan deteksi perangkat adaptif:
      ```python
      device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
      ```
    - `dataset.py`: PyTorch Dataset & DataLoader dengan augmentasi citra adaptif (rotasi ringan, variasi kontras, simulasi Dark/Light mode).
    - `model.py`: Arsitektur CRNN (Convolutional Recurrent Neural Network: CNN feature extractor + Bidirectional LSTM + CTC Loss) yang sangat ringan dan cepat di CPU / MPS.
    - `lexicon_builder.py`: Generator kamus domain PLN Mobile (istilah ulasan, daftar nama pengulas, variasi ejaan) untuk memandu pemodelan probabilitas kata (Beam Search / Language Model rescoring).
    - `evaluator.py`: Pengujian terhadap *Benchmark Golden Dataset* untuk menghitung metrik objektif CER (Character Error Rate) dan WER (Word Error Rate).

### Subtask 19.3: Orkestrasi Asinkron & Sistem Pemicu Ganda (BullMQ & Cron)
* **Tujuan:** Mengelola eksekusi training di latar belakang tanpa menghambat antrean triase utama, didukung mekanisme pemicu otomatis yang efisien.
* **Komponen & Berkas:**
  - Antrean BullMQ (`src/server/queues/ocrTrainingQueue.ts`):
    - Worker terisolasi dengan penanganan pembatalan (*graceful cancellation*).
    - Streaming progress berkala (epoch, loss, estimasi sisa waktu) ke Redis untuk dibaca oleh frontend.
  - Dual-Trigger Orchestrator (`src/server/services/ocrTrainingTriggerService.ts`):
    - *Threshold Trigger*: Memeriksa apakah jumlah data latih baru telah mencapai ambang batas (misal: 100 sampel baru).
    - *Scheduled Nightly Cron*: Menjadwalkan pengecekan otomatis pada pukul 02:00 WIB (jam sepi beban).
    - *Cooldown Guard*: Memastikan jeda minimal (misal: 6 jam) antar-eksekusi otomatis guna mencegah pemborosan komputasi.

### Subtask 19.4: Model Registry, Evaluasi Metrik, Hot-Reload, & Safe Rollback
* **Tujuan:** Menyimpan versi-versi model, membandingkan akurasi model baru terhadap model aktif, serta memfasilitasi aktivasi instan tanpa restart aplikasi.
* **Komponen & Berkas:**
  - Model Registry Service (`src/server/services/ocrModelRegistryService.ts`):
    - Penyimpanan checkpoint model terversi (`weights/model_v1.0.0.pt`, `weights/model_v1.1.0.pt`).
    - Penyimpanan file benchmark acuan (`data/benchmark_set/`).
    - Penentuan status: `STAGING` (baru selesai dilatih) vs `ACTIVE` (sedang dipakai di produksi).
  - Hot-Reload Hook pada Ingestion Service:
    - `ocrService.ts` membaca path model aktif secara dinamis dari database/Redis cache.
    - Perpindahan ke model baru berlaku seketika (*zero downtime*).
  - Instant Rollback Engine:
    - Mengembalikan model aktif ke versi stabil sebelumnya hanya dengan satu klik jika ditemukan anomali inferensi di lapangan.

### Subtask 19.5: UI/UX Dasbor Manajemen Training OCR & Kurasi Data Latih
* **Tujuan:** Menyediakan antarmuka visual komprehensif, modern, dan ergonomis untuk role Pegawai dan Super Admin sesuai *Design Source of Truth*.
* **Komponen & Berkas:**
  - Halaman Baru: `src/app/(operator)/ocr-training/page.tsx` dan `src/components/operator/training/OcrTrainingDashboard.tsx`.
  - Komponen Pendukung:
    1. **Top Active Model Card:** Menampilkan versi model aktif saat ini, akurasi benchmark terakhir, total sampel yang dipelajari, dan status kesehatan engine.
    2. **Training Dataset Pool Inspector:** Tabel penelusuran sampel data latih, thumbnail gambar eviden, teks ekstraksi vs ground truth, status inklusi, dan tombol *Exclude / Include*.
    3. **Manual Training Control Panel:** Kartu pemicu training dengan pilihan mode (*Adaptasi Cepat / Full Training*), slider epoch, dan tombol *"Mulai Training"*.
    4. **Live Training Console & Metric Chart:** Indikator progress bar melingkar/linear, streaming log terminal real-time, dan grafik garis penurunan loss.
    5. **Model Registry & Version Comparison Table:** Tabel riwayat model (versi, tanggal, pembuat, CER, WER, delta peningkatan $+/-\%$) dengan tombol *"Aktifkan Model"* dan *"Rollback"*.

### Subtask 19.6: Pengujian Menyeluruh (TDD), Verifikasi Lintas Platform, & Dokumentasi
* **Tujuan:** Memastikan keandalan sistem training di berbagai lingkungan sistem operasi dan mencegah terjadinya regresi performa.
* **Komponen & Berkas:**
  - Unit Tests (`tests/unit/ocrTrainingRouter.test.ts`): Pengujian prosedur tRPC untuk dataset curation, job trigger, model registry, dan RBAC guard.
  - Integration Tests (`tests/integration/ocrTrainingLifecycle.test.ts`): Pengujian siklus penuh mulai dari pengumpulan data ground truth, pemicuan antrean, kalkulasi metrik, hingga aktivasi model.
  - Skrip Verifikasi Lintas Platform (`scripts/verify-ocr-trainer-env.py`): Memverifikasi dependensi PyTorch, deteksi hardware (CPU, MPS, CUDA), dan alur inferensi di macOS dan Windows.

---

## 5. Rencana Jadwal Eksekusi Berurutan

```
┌────────────────────────────────────────────────────────────────────────┐
│ Fase 1: Dasar Data & Pipeline                                          │
│ Subtask 19.1: Skema Prisma & Ingestion Hook Ground Truth               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Fase 2: Engine Deep Learning & Algoritma Pembelajaran                  │
│ Subtask 19.2: Pipeline PyTorch CRNN & Kamus Domain PLN Mobile          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Fase 3: Orkestrasi Asinkron & Penjadwalan                              │
│ Subtask 19.3: BullMQ Training Queue, Threshold Triggers, & Cron        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Fase 4: Tata Kelola Model & Keamanan Operasional                       │
│ Subtask 19.4: Model Registry, Benchmark Evaluator, & Safe Rollback     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Fase 5: Pengalaman Pengguna (UI/UX)                                    │
│ Subtask 19.5: Halaman /ocr-training, Live Progress, & Kontrol Manual   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Fase 6: Penjaminan Mutu & Rilis                                        │
│ Subtask 19.6: TDD Test Suites, Cross-Platform Validation, & Audit Pass │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Kriteria Keberhasilan (Acceptance Criteria)

1. **AC-1 (Cold-Start & Active Harvesting):** Seluruh baris data historis spreadsheet yang tercentang/disetujui dapat diekstraksi ke tabel `OcrTrainingSample`, dan setiap aksi validasi baru di `/triage` otomatis menambah data latih.
2. **AC-2 (Cross-Platform Execution):** Skrip training Python dapat berjalan lancar tanpa error dependensi pada macOS (Apple Silicon MPS / CPU) maupun Windows (CUDA / CPU).
3. **AC-3 (Dual Trigger Reliability):** Training otomatis berjalan ketika kuota threshold terpenuhi atau saat jadwal cron malam terpicu, dengan proteksi jeda waktu minimal (*cooldown*).
4. **AC-4 (Staging & Safe Approval):** Model baru yang selesai dilatih tidak langsung menggantikan model produksi secara membabi buta, melainkan masuk ke status `STAGING` dengan skor CER/WER yang terukur terhadap dataset benchmark tetap.
5. **AC-5 (Zero-Downtime Hot-Reload & Rollback):** Saat Super Admin mengklik *"Aktifkan Model"* atau *"Rollback"*, inferensi OCR pada ulasan berikutnya langsung menggunakan model yang ditunjuk tanpa mematikan server.
6. **AC-6 (Desain UI/UX Baku & Bebas Em Dash):** Halaman antarmuka `/ocr-training` mematuhi `docs/ui_ux_guidelines.md`, responsif di layar mobile dan desktop, memiliki kontras tinggi WCAG AA, dan tidak memuat karakter em dash.
7. **AC-7 (Test Suite 100% Green):** Seluruh pengujian unit dan integrasi lolos tanpa galat (`0 failing tests`).

