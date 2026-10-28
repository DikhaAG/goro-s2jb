# Task 3: Mesin AI & Logika Probabilitas (Inti Eksekusi)

> **Status:** Draft / Ready for Engineering Execution  
> **Fase:** 2 (Modul Fitur Utama - Modul 4.2 PRD)  
> **Target Audiens:** AI/Vision Engineer, Backend Engineer, Full-Stack Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 1.2: Titik Lemah Validasi Manual, Bagian 4.2: Mesin AI & Logika Probabilitas)
> - [`docs/GORO S2JB 2026 (Jawaban).xlsx`](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx) (Kolom 4: Nama Pengulas vs Kolom 6: Foto Eviden -> Kolom 12: Nilai Validasi)
> - [`.agents/skills/smart-ocr/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/smart-ocr/)
> - [`.agents/skills/diagnosing-bugs/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/diagnosing-bugs/)
> - [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/)

---

## 1. Ringkasan & Tujuan Task

Mengembangkan **Mesin AI dan Logika Probabilitas** yang bertindak sebagai "otak eksekusi otomatis" sistem GORO. Modul ini bertugas menggantikan beban kerja manual pegawai yang sebelumnya harus membuka tautan Google Drive (*Column 6*) satu per satu dan mencocokkan nama pengulas secara manual dengan *Column 4* untuk memberi nilai TRUE/FALSE pada *Column 12*.

Sistem mengeksekusi tiga kapabilitas utama:
1. **Ekstraksi Teks Cerdas (OCR):** Memindai gambar bukti tangkapan layar Play Store menggunakan engine lokal (Tesseract / PaddleOCR) dengan pipeline prapemrosesan citra.
2. **Logika Pencocokan Toleran (Fuzzy Matching):** Mengomparasi nama pengulas target (*Column 4*) terhadap seluruh teks hasil OCR dengan penilaian kemiripan (*Confidence Score*) dan sistem triase 3 zona (Hijau, Kuning, Merah).
3. **Anti-Fraud Kriptografis (pHash) & Soft-Flagging:** Menghitung sidik jari gambar (*Perceptual Hash*) untuk mendeteksi kecurangan jika gambar tangkapan layar yang sama digunakan berulang kali di hari berbeda, serta menerapkan penandaan aman tanpa menghapus data mentah.

---

## 2. Struktur Sub-Task Hierarkis

* **Task 3.1:** Pipeline Prapemrosesan Citra & Engine Ekstraksi Teks OCR Lokal
* **Task 3.2:** Engine Pencocokan Fuzzy & Klasifikasi Triase Tiga Zona (Confidence Score)
* **Task 3.3:** Mesin Sidik Jari Visual (pHash 64-bit) & Logika Soft-Flagging Anti-Fraud
* **Task 3.4:** BullMQ Worker Processor & Jembatan Integrasi Node.js - Python Bridge

---

## 3. Instruksi Teknis Rinci

### 3.1 Task 3.1: Pipeline Prapemrosesan Citra & Engine Ekstraksi Teks OCR Lokal
1. **Target File:**
   * `python-services/ocr/preprocessor.py`
   * `python-services/ocr/engine.py`
2. **Pipeline Prapemrosesan Citra (Image Preprocessing):**
   * Tangkapan layar dari berbagai perangkat petugas lapangan memiliki resolusi, rasio kontras, dan mode tampilan yang berbeda (Dark Mode vs Light Mode di Play Store).
   * Implementasikan fungsi prapemrosesan dengan Pillow & OpenCV:
     - **Grayscale Conversion:** Menghilangkan noise warna.
     - **Adaptive Thresholding / Otsu Binarization:** Memisahkan teks dari latar belakang secara tajam.
     - **Contrast Limited Adaptive Histogram Equalization (CLAHE):** Menghindari teks hilang pada gambar yang redup atau beresolusi rendah.
     - **Auto-Rotation / Deskewing:** Mengoreksi kemiringan gambar jika tangkapan layar terpangkas miring.
3. **Engine OCR Lokal (Mengacu ke `.agents/skills/smart-ocr/`):**
   * Gunakan Tesseract OCR lokal (dengan bahasa `ind+eng`) atau PaddleOCR via Python.
   * Ekstrak teks lengkap beserta *bounding boxes* dan nilai keyakinan (*confidence per word*).
   * Kembalikan teks bersih dalam format string terstruktur dan token baris.

---

### 3.2 Task 3.2: Engine Pencocokan Fuzzy & Klasifikasi Triase Tiga Zona
1. **Target File:**
   * `python-services/ocr/matcher.py`
2. **Sanitasi & Normalisasi Teks:**
   * Nama pengulas di Google Play Store kerap memuat karakter spesial, emoji, spasi ganda, atau variasi huruf kapital (misal: "🌟 Rudi Tabuci 🌟" vs "rudi tabuci").
   * Lakukan normalisasi:
     - Konversi ke huruf kecil (*lowercase*).
     - Hapus karakter non-alfanumerik (termasuk emoji dan simbol).
     - Normalisasi spasi (*strip & collapse consecutive spaces*).
3. **Logika Fuzzy Matching (`rapidfuzz`):**
   * Hitung rasio kemiripan dengan menggabungkan dua metrik:
     - `token_set_ratio`: Mengabaikan urutan kata dan kata tambahan yang tidak relevan.
     - `partial_ratio`: Menemukan substring nama pengulas di dalam blok ulasan panjang.
   * Skor Kemiripan Akhir (*Confidence Score*): nilai desimal 0.0 – 100.0%.
4. **Klasifikasi Triase Tiga Zona (Sesuai PRD Bagian 4.2):**
   * **Zona Hijau (Skor $\ge$ 90.0%):** Kemiripan tinggi. Sistem otomatis menetapkan `validationStatus = "APPROVED"` (ekivalen dengan nilai `TRUE`/`1` pada *Column 12* lama) tanpa intervensi manusia.
   * **Zona Kuning (70.0% $\le$ Skor < 90.0%):** Kemiripan moderat (gambar buram, salah ketik tipis, atau nama terpotong). Sistem menetapkan `validationStatus = "NEEDS_REVIEW"` dan menahan data untuk peninjauan manual oleh pegawai di Modul 4.3.
   * **Zona Merah (Skor < 70.0%):** Ketidaksesuaian parah. Sistem menetapkan `validationStatus = "REJECTED"` (ekivalen dengan `FALSE`/`0`) sebagai indikasi salah gambar, manipulasi, atau eviden palsu.

---

### 3.3 Task 3.3: Mesin Sidik Jari Visual (pHash) & Logika Soft-Flagging Anti-Fraud
1. **Target File:**
   * `python-services/ocr/hasher.py`
   * `src/server/services/antiFraudService.ts`
2. **Kalkulasi Perceptual Hashing (pHash):**
   * Menggunakan pustaka `imagehash` (algoritma DCT-based *pHash* 64-bit).
   * Konversi citra eviden menjadi hash string heksadesimal 16 karakter (contoh: `"a8f2c3e4b105d6e7"`).
3. **Deteksi Duplikasi Lintas Tanggal:**
   * Sebelum menetapkan status akhir, sistem mengecek hash gambar terhadap seluruh record `RatingReview` yang telah tersimpan.
   * Hitung **Hamming Distance** (jumlah bit yang berbeda):
     - $\text{Distance} = 0$: Gambar identik 100%.
     - $1 \le \text{Distance} \le 5$: Gambar hasil kompresi ulang, sedikit di-crop, atau diedit ringan (terindikasi duplikat).
     - $\text{Distance} > 5$: Gambar berbeda.
4. **Mekanisme Soft-Flagging (Tanpa Penghapusan Permanen):**
   * Jika gambar terdeteksi duplikat terhadap submission lain:
     - Setel `isDuplicate = true`.
     - Setel `duplicateOfId = existingReview.id` (menghubungkan ke bukti pertama yang diunggah).
     - Turunkan status validasi ke `NEEDS_REVIEW` (jika semula Hijau) atau `REJECTED`, dengan catatan keterangan pada `reviewRemarks = "Terindikasi duplikasi visual dengan ID: <ID_LAMA> (Hamming Distance: <X>)"`.
     - Data **tidak pernah dihapus** dari basis data agar audit jejak historis tetap utuh.

---

### 3.4 Task 3.4: BullMQ Worker Processor & Jembatan Integrasi Node.js - Python
1. **Target File:**
   * `python-services/ocr/main.py` (FastAPI local server pada port internal `8001` atau CLI bridge)
   * `src/server/services/ocrBridge.ts`
   * `src/server/workers/ocrWorker.ts`
2. **Spesifikasi Kontrak Komunikasi Bridge:**
   * Node.js worker memanggil endpoint lokal `POST http://127.0.0.1:8001/api/v1/process`:
     ```json
     {
       "image_path": "/absolute/path/to/uploads/evidence/2026/10/28/img.jpg",
       "target_name": "Rudi Tabuci"
     }
     ```
   * Respon JSON:
     ```json
     {
       "success": true,
       "extracted_text": "Rudi Tabuci ... aplikasi sangat membantu ...",
       "phash": "a8f2c3e4b105d6e7",
       "similarity_score": 96.2,
       "zone": "GREEN",
       "recommended_status": "APPROVED",
       "execution_time_ms": 320
     }
     ```
3. **Eksekusi Atomik Worker di Node.js:**
   * Menerima job dari `ocrQueue`.
   * Memanggil `ocrBridge`.
   * Melakukan pengecekan duplikasi via `antiFraudService`.
   * Memperbarui tabel `RatingReview` melalui Prisma ORM:
     ```typescript
     await prisma.ratingReview.update({
       where: { id: job.data.reviewId },
       data: {
         extractedOcrText: result.extracted_text,
         evidenceImageHash: result.phash,
         confidenceScore: result.similarity_score,
         validationStatus: finalStatus,
         isDuplicate: isDuplicateDetected,
         duplicateOfId: originalReviewId,
         reviewRemarks: remarks
       }
     });
     ```
   * Jika status adalah `NEEDS_REVIEW`, kirimkan event notifikasi internal (agar dasbor operator di Modul 4.3 langsung me-refresh baris antrean).

---

## 4. Kriteria Penerimaan (Acceptance Criteria)

- [ ] **AC-1 (Preprocessing Quality):** Modul prapemrosesan berhasil meningkatkan ketajaman gambar tangkapan layar beresolusi rendah dan tangkapan layar mode gelap (*Dark Mode*) sehingga teks dapat dibaca oleh engine OCR.
- [ ] **AC-2 (Text Extraction Accuracy):** Engine OCR berhasil mengekstrak teks nama pengulas dan ulasan dari gambar tangkapan layar Play Store dengan tingkat keberhasilan baca > 90% pada sampel eviden yang valid.
- [ ] **AC-3 (Fuzzy Match Robustness):** Algoritma fuzzy matching berhasil mencocokkan variasi penulisan nama yang memuat emoji, spasi ganda, atau perbedaan kapitalisasi dengan skor $\ge 90\%$.
- [ ] **AC-4 (Accurate Tri-Zone Triage):**
  - Skor $\ge 90\%$ menghasilkan `validationStatus = "APPROVED"` (Zona Hijau).
  - Skor 70% – 89.9% menghasilkan `validationStatus = "NEEDS_REVIEW"` (Zona Kuning).
  - Skor < 70% menghasilkan `validationStatus = "REJECTED"` (Zona Merah).
- [ ] **AC-5 (pHash Calculation & Storage):** Setiap gambar yang diproses menghasilkan string heksadesimal pHash 64-bit yang tersimpan rapi di kolom `evidenceImageHash`.
- [ ] **AC-6 (Anti-Fraud Duplicate Detection):** Jika sebuah gambar eviden diunggah ulang (meskipun nama file diubah atau di-crop tipis), sistem mendeteksi Hamming Distance $\le 5$, menandai `isDuplicate = true`, dan mengaitkan `duplicateOfId` ke entri sumber.
- [ ] **AC-7 (Asynchronous Queue Reliability):** BullMQ worker memproses antrean job OCR satu per satu secara asinkron tanpa memblokir server utama, dengan waktu eksekusi rata-rata < 1,5 detik per gambar.
- [ ] **AC-8 (Zero Data Loss on Soft-Flagging):** Data yang terindikasi manipulasi atau duplikat tetap tersimpan di basis data tanpa pernah dihapus secara permanen.

---

## 5. Matriks Berkas yang Dibuat / Diubah

| Jalur Berkas | Aksi | Deskripsi Perubahan |
| :--- | :--- | :--- |
| `python-services/ocr/preprocessor.py` | Dibuat | Pipeline pembersihan gambar (grayscale, binarisasi, CLAHE, deskewing) |
| `python-services/ocr/engine.py` | Dibuat | Wrapper OCR (Tesseract / PaddleOCR) untuk ekstraksi teks gambar |
| `python-services/ocr/matcher.py` | Dibuat | Modul normalisasi teks dan kalkulasi fuzzy similarity ratio |
| `python-services/ocr/hasher.py` | Dibuat | Modul kalkulasi pHash 64-bit dan perhitungan Hamming Distance |
| `python-services/ocr/main.py` | Dibuat | Entrypoint HTTP FastAPI lokal / CLI runner untuk layanan OCR |
| `python-services/ocr/requirements.txt` | Diubah | Penambahan dependensi: `pytesseract`, `pillow`, `imagehash`, `rapidfuzz`, `fastapi`, `uvicorn` |
| `src/server/services/ocrBridge.ts` | Dibuat | Klien TypeScript untuk pemanggilan microservice Python secara aman |
| `src/server/services/antiFraudService.ts`| Dibuat | Layanan pengecekan duplikasi pHash terhadap database PostgreSQL |
| `src/server/workers/ocrWorker.ts` | Dibuat | Worker BullMQ untuk memproses antrean `ocrQueue` dan update status Prisma |
| `tests/unit/ocrMatcher.test.py` | Dibuat | Pengujian unit algoritma fuzzy matching dan batas triase zona |
| `tests/unit/phashAntiFraud.test.py` | Dibuat | Pengujian unit deteksi duplikasi visual dengan variasi distorsi gambar |
| `tests/integration/ocrWorker.test.ts` | Dibuat | Pengujian integrasi alur BullMQ worker dari antrean ke basis data |

---

## 6. Titik Uji & Pengujian (TDD Seams)

1. **OCR Preprocessing Seam:** Uji fungsi binarisasi dan CLAHE terhadap gambar tangkapan layar Play Store mode gelap (*dark mode*) untuk memastikan teks putih pada latar gelap terbaca dengan jelas.
2. **Fuzzy Matching Seam:** Uji fungsi `calculate_similarity` dengan tabel kasus uji batas:
   - "Rudi Tabuci" vs "Rudi Tabuci" $\rightarrow 100\%$ (Hijau)
   - "Rudi Tabuci" vs "⭐ rudi tabuci ⭐" $\rightarrow \ge 95\%$ (Hijau)
   - "Rudi Tabuci" vs "Rudi Tabucy" $\rightarrow 85-89\%$ (Kuning)
   - "Rudi Tabuci" vs "Miki" $\rightarrow < 40\%$ (Merah)
3. **pHash Anti-Fraud Seam:** Uji dua gambar yang sama namun salah satunya disimpan ulang dengan resolusi berbeda: Hamming distance harus $\le 5$. Uji dua gambar berbeda: Hamming distance harus $> 15$.
4. **BullMQ Worker Integration Seam:** Simulasikan penambahan job ke `ocrQueue` dan verifikasi bahwa record di tabel `RatingReview` beralih dari `PENDING` ke salah satu status final (`APPROVED`, `NEEDS_REVIEW`, `REJECTED`) dengan data `confidenceScore` dan `evidenceImageHash` terisi.
