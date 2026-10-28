# Task 4: Dasbor Operator (Human-in-the-Loop)

> **Status:** Completed / Verified ✅  
> **Fase:** 2 (Modul Fitur Utama - Modul 4.3 PRD)  
> **Target Audiens:** Frontend Engineer, UI/UX Designer, Full-Stack Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 1.2: Beban Validasi Manual Pegawai, Bagian 4.3: Dasbor Operator, Bagian 5: RBAC Role Pegawai)
> - [`docs/GORO S2JB 2026 (Jawaban).xlsx`](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx) (Kolom 4: Nama Pengulas, Kolom 6: Foto Eviden, Kolom 12: Nilai Validasi, Kolom 13: Keterangan)
> - [`.agents/skills/frontend-design/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-design/)
> - [`.agents/skills/web-design-guidelines/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/web-design-guidelines/)
> - [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/)

---

## 1. Ringkasan & Tujuan Task

Membangun antarmuka komando verifikasi manusia (*Human-in-the-Loop Dashboard*) yang dirancang khusus untuk **Role PEGAWAI (Operator / Verifikator)**.

Tujuan utama modul ini adalah **mengeliminasi secara total metode kerja lama yang lambat dan melelahkan**, di mana pegawai sebelumnya terpaksa membuka tautan Google Drive pada *Column 6* satu per satu di peramban, membaca gambar tangkapan layar, memverifikasi kesesuaian dengan *Column 4*, lalu mengetik/mencentang status TRUE/FALSE secara manual pada *Column 12*.

Dengan sistem baru:
1. Data ulasan yang lolos Zona Hijau ($\ge 90\%$) dan gagal Zona Merah ($< 70\%$) telah dieksekusi secara otonom oleh Mesin AI (Modul 4.2).
2. Pegawai **hanya berfokus meninjau kasus-kasus marginal di Zona Kuning (70% - 89.9%)** dan data yang terindikasi duplikat (*soft-flagged*).
3. Seluruh komponen peninjauan (Gambar Bukti, Teks Target, Hasil OCR, dan Tombol Aksi) tersaji dalam **satu baris pandangan kohesif** yang dilengkapi *keyboard hotkeys* dan *virtualisasi tabel* agar peramban tetap responsif saat menangani ribuan data antrean.

---

## 2. Struktur Sub-Task Hierarkis

* **Task 4.1:** Layout & Arsitektur Navigasi Dasbor Operator (`/operator/triage`)
* **Task 4.2:** Komponen Baris Pandangan Kohesif & Virtualisasi Tabel Berperforma Tinggi (TanStack Virtual)
* **Task 4.3:** Fitur Pratinjau Citra Interaktif (Lightbox, Zoom, Rotate) & Highlighting Teks OCR
* **Task 4.4:** Sistem Aksi Cepat (Hotkeys, Optimistic UI Updates, dan Audit Trail Verifikator)

---

## 3. Instruksi Teknis Rinci

### 3.1 Task 4.1: Layout & Arsitektur Navigasi Dasbor Operator (`/operator/triage`)
1. **Target Rute:** `src/app/(operator)/triage/page.tsx`
2. **Proteksi Otorisasi (RBAC):**
   * Pastikan halaman ini hanya dapat diakses oleh pengguna dengan role `PEGAWAI` atau `SUPER_ADMIN`.
   * Jika diakses oleh `PETUGAS_LAPANGAN`, kembalikan kode status HTTP 403 Forbidden atau arahkan ke `/intake`.
3. **Desain Header & Ringkasan Metrik (Command Bar):**
   * Tampilkan kartu metrik taktis ringkas di bagian atas:
     - **Antrean Zona Kuning (Pending Review):** Jumlah data yang memerlukan tindakan pegawai saat ini.
     - **Terverifikasi Hari Ini:** Jumlah data yang telah di-*Approve* atau di-*Reject* oleh operator pada hari berjalan.
     - **Tingkat Otomasi AI:** Persentase ulasan yang diselesaikan otomatis (Zona Hijau + Merah) dibanding total submission.
4. **Bilah Filter Taktis (Filter Controls):**
   * Filter Unit Kerja: Dropdown UP3 dan ULP.
   * Filter Rentang Tanggal: Default pada tanggal hari ini / bulan berjalan.
   * Toggle Switch: `Hanya Tampilkan Duplikasi (pHash Soft-flagged)`.
   * Tabs Kategori:
     - Tab 1: **Perlu Verifikasi (Zona Kuning - Default)**
     - Tab 2: **Semua Ulasan (Riwayat / All)**
     - Tab 3: **Terindikasi Duplikat (Anti-Fraud Queue)**

---

### 3.2 Task 4.2: Komponen Baris Pandangan Kohesif & Virtualisasi Tabel (TanStack Virtual)
1. **Target File:**
   * `src/components/operator/TriageTable.tsx`
   * `src/components/operator/TriageRow.tsx`
2. **Persyaratan Performa UI (TanStack Virtual):**
   * Sesuai mandat PRD Bagian 4.3, antarmuka wajib mengimplementasikan `@tanstack/react-virtual`.
   * Hanya merender elemen DOM yang berada di dalam area pandang (*viewport*). Antarmuka harus tetap stabil pada 60 FPS meskipun antrean data memuat lebih dari 5.000 ulasan.
3. **Komponen Visual Kohesif (4 Pilar Informasi per Baris):**
   Setiap kartu/baris triase menampilkan 4 elemen utama secara berdampingan tanpa perlu berpindah tab:
   * **Pilar 1 (Foto Eviden Thumbnail):** Menampilkan thumbnail gambar bukti dari penyimpanan lokal (`/api/uploads/...`). Klik gambar untuk membuka modal pratinjau penuh.
   * **Pilar 2 (Nama Pengulas Target & Metadata):** Teks nama pengulas (*Column 4*), unit kerja (UP3 / ULP), versi aplikasi PLN Mobile, dan waktu kirim.
   * **Pilar 3 (Hasil Ekstraksi OCR & Diff Visual):** Blok cuplikan teks yang terbaca oleh AI dari gambar, dengan penanda visual (highlight warna hijau muda) pada kata yang cocok dengan nama pengulas.
   * **Pilar 4 (Skor Keyakinan & Tombol Aksi Cepat):**
     - Badge persentase skor kemiripan (misal: `78.5%` dengan warna kuning peringatan).
     - Badge peringatan merah `DUPLIKAT` jika `isDuplicate = true`.
     - Tombol aksi `[Approve]` (ikon centang hijau) dan `[Reject]` (ikon silang merah).

---

### 3.3 Task 4.3: Fitur Pratinjau Citra Interaktif (Lightbox) & Text Highlighting
1. **Target File:**
   * `src/components/operator/EvidenceLightbox.tsx`
   * `src/components/operator/OcrTextHighlighter.tsx`
2. **Kemampuan Modal Pratinjau Citra (Evidence Lightbox):**
   * Tampilan modal layar penuh yang dapat dipanggil dengan klik mouse atau tombol `[Space]`.
   * **Zoom & Pan:** Kemampuan memperbesar gambar hingga 300% menggunakan scroll mouse untuk membaca teks nama akun Play Store yang sangat kecil.
   * **Rotasi Citra (Rotate):** Tombol rotasi $90^\circ$ jika tangkapan layar diunggah dalam posisi lanskap atau terbalik oleh petugas lapangan.
   * **Split View:** Panel samping yang menampilkan teks lengkap hasil ekstraksi OCR di sebelah gambar bukti untuk perbandingan visual instan.
3. **Komponen Text Highlighter:**
   * Memetakan kata-kata nama target ke teks OCR dan memberikan latar warna cerah pada substring yang paling mendekati kecocokan nama.

---

### 3.4 Task 4.4: Sistem Aksi Cepat, Hotkeys, & Audit Trail Verifikator
1. **Target File:**
   * `src/hooks/useTriageHotkeys.ts`
   * `src/server/routers/triage.ts`
2. **Navigasi Keyboard Hotkeys (Tanpa Perlu Mouse):**
   * `[A]` atau `[Enter]`: Menyetujui ulasan yang sedang aktif (*Approve* $\rightarrow$ status `APPROVED`).
   * `[R]`: Menolak ulasan yang sedang aktif (*Reject* $\rightarrow$ status `REJECTED`).
   * `[J]` atau `[Panah Bawah]`: Pindah fokus ke baris ulasan berikutnya.
   * `[K]` atau `[Panah Atas]`: Pindah fokus ke baris ulasan sebelumnya.
   * `[Space]`: Buka / tutup modal Lightbox gambar eviden.
   * Indikator visual cincin fokus (*focus ring*) yang jelas pada baris ulasan yang sedang dipilih.
3. **Optimistic UI Updates & Undo Mechanism:**
   * Ketika tombol *Approve* atau *Reject* ditekan, baris ulasan langsung menghilang dari antrean secara optimistik dengan animasi transisi yang mulus.
   * Tampilkan toast notifikasi singkat di pojok bawah: *"Ulasan [Nama] disetujui"* dengan tombol `[Undo]` yang aktif selama 5 detik untuk membatalkan tindakan jika terjadi salah pencet.
4. **Pencatatan Audit Trail di Basis Data:**
   * Prosedur tRPC `trpc.triage.submitDecision` memperbarui record `RatingReview`:
     - `validationStatus`: `"APPROVED"` atau `"REJECTED"`.
     - `verifiedById`: ID akun pegawai yang sedang bertugas.
     - `verifiedAt`: Timestamp waktu verifikasi dilakukan.
     - `reviewRemarks`: Catatan alasan penolakan jika di-reject (opsi: *"Nama akun tidak cocok"*, *"Eviden buram/tidak terbaca"*, *"Bukan ulasan rating PLN Mobile"*, atau catatan kustom).

---

## 4. Kriteria Penerimaan (Acceptance Criteria)

- [x] **AC-1 (RBAC Guard):** Akses rute `/operator/triage` terlindungi secara ketat. Pengguna dengan peran `PEGAWAI` dan `SUPER_ADMIN` dapat mengakses antarmuka, sedangkan peran `PETUGAS_LAPANGAN` ditolak dengan respon 403 Forbidden.
- [x] **AC-2 (Zero Browser Freeze via Virtualization):** Antarmuka tabel triase menggunakan `@tanstack/react-virtual` dan dapat menggulir (*scrolling*) ribuan data ulasan pada kecepatan 60 FPS tanpa lag memori peramban.
- [x] **AC-3 (Single-Glance Cohesive View):** Dalam satu kartu/baris, operator dapat melihat thumbnail gambar, nama target, teks OCR, dan skor keyakinan secara simultan tanpa membuka jendela terpisah.
- [x] **AC-4 (Interactive Lightbox & Zoom):** Modal lightbox dapat dibuka secara instan, mendukung fitur perbesaran citra (zoom), geser (pan), serta rotasi gambar $90^\circ$.
- [x] **AC-5 (Rapid Keyboard Navigation):** Pegawai dapat menavigasi seluruh antrean triase dan mengeksekusi *Approve/Reject* murni menggunakan keyboard (`A`, `R`, `J`, `K`, `Space`) dengan indikator fokus yang tegas.
- [x] **AC-6 (Optimistic UI & Reversible Action):** Baris ulasan langsung terhapus dari tampilan antrean seketika setelah tombol ditekan, dan toast notifikasi menyediakan tombol `Undo` selama 5 detik.
- [x] **AC-7 (Tamper-Proof Audit Trail):** Setiap perubahan status mencatat akun verifikator (`verifiedById`) dan waktu eksekusi (`verifiedAt`) di basis data PostgreSQL.
- [x] **AC-8 (Duplicate Indicator Visibility):** Submission yang memiliki tanda `isDuplicate = true` menampilkan badge peringatan merah dan tautan untuk meninjau submission awal pembandingnya.

---

## 5. Matriks Berkas yang Dibuat / Diubah

| Jalur Berkas | Aksi | Deskripsi Perubahan |
| :--- | :--- | :--- |
| `src/app/(operator)/triage/page.tsx` | Dibuat | Halaman utama dasbor triase operator pegawai |
| `src/components/operator/TriageHeader.tsx` | Dibuat | Baris atas ringkasan metrik antrean dan tingkat automasi |
| `src/components/operator/TriageFilterBar.tsx`| Dibuat | Kontrol filter UP3, ULP, rentang tanggal, dan toggle duplikat |
| `src/components/operator/TriageTable.tsx` | Dibuat | Tabel virtualisasi TanStack Virtual untuk rendering ribuan data |
| `src/components/operator/TriageRow.tsx` | Dibuat | Komponen baris pandangan kohesif (Thumbnail, Target, OCR, Skor, Aksi) |
| `src/components/operator/EvidenceLightbox.tsx`| Dibuat | Modal perbesaran gambar bukti eviden dengan fitur zoom, pan, rotate |
| `src/components/operator/OcrTextHighlighter.tsx`| Dibuat | Komponen penampil teks OCR dengan pewarnaan highlight kata cocok |
| `src/components/operator/RejectReasonDialog.tsx`| Dibuat | Dialog pemilihan alasan penolakan ulasan sebelum status di-reject |
| `src/hooks/useTriageHotkeys.ts` | Dibuat | Hook kustom penangkap shortcut keyboard `A`, `R`, `J`, `K`, `Space` |
| `src/server/routers/triage.ts` | Dibuat | Prosedur tRPC untuk query antrean triase dan mutasi keputusan operator |
| `src/server/routers/_app.ts` | Diubah | Mendaftarkan router `triage` ke dalam root AppRouter |
| `tests/unit/triageHotkeys.test.tsx` | Dibuat | Pengujian unit event listener keyboard pada hook hotkeys |
| `tests/integration/triageProcedure.test.ts` | Dibuat | Pengujian integrasi mutasi keputusan triase dan pencatatan audit trail |

---

## 6. Titik Uji & Pengujian (TDD Seams)

1. **RBAC Guard Seam:** Uji otorisasi middleware tRPC `operatorProcedure` untuk memastikan token petugas lapangan ditolak dan token pegawai diterima.
2. **Triage Queue Query Seam:** Uji query `trpc.triage.getQueue` dengan parameter filter zona (`status = "NEEDS_REVIEW"`), memastikan data yang dikembalikan urut berdasarkan timestamp terlama (*FIFO*).
3. **Decision Mutation Seam:** Uji prosedur `trpc.triage.submitDecision` untuk mutasi *Approve* dan *Reject*, memastikan kolom `validationStatus`, `verifiedById`, dan `verifiedAt` terisi dengan benar di PostgreSQL.
4. **Hotkey Hook Seam:** Simulasikan penekanan tombol `A` dan `R` pada DOM terisolasi untuk memastikan callback mutasi terpicu dengan ID baris aktif yang tepat.
