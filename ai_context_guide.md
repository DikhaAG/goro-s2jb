# AI Context Guide & Source of Truth

> **PANDUAN EKSKLUSIF UNTUK AI AGENT (ANTIGRAVITY, CLAUDE CODE, CURSOR, CODEX, DLL.)**  
> Berkas ini merupakan **Source of Truth (Sumber Kebenaran Utama)** bagi seluruh AI agent yang beroperasi di dalam repositori ini. Setiap kali AI merencanakan solusi, menganalisis masalah, atau men-generate kode, AI **DIWAJIBKAN SECARA MUTLAK** untuk mengambil konteks dan instruksi secara eksklusif dari dua direktori resmi berikut:

---

## 1. Peta Lokasi Konteks Resmi (The Two Exclusive Sources)

```
goro-s2jb/
├── docs/                 <-- [SUMBER 1] Spesifikasi Bisnis, PRD & Teknis Proyek
├── .agents/skills/       <-- [SUMBER 2] Standar Perilaku, Alur Kerja & Skill Agen
└── ai_context_guide.md   <-- Berkas Panduan ini
```

---

### Direktori 1: `docs/`
**Fungsi:** Pusat Dokumen Proyek, Persyaratan Bisnis (PRD), Arsitektur Sistem, dan Referensi Teknis Operasional.

* **Isi & Komponen Utama:**
  * [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md): *Product Requirements Document* resmi yang memuat latar belakang masalah, titik lemah (*pain points*), arsitektur *tech stack* (Next.js 16, PostgreSQL, Prisma, Python OCR, Redis/BullMQ, tRPC), spesifikasi modul (4.1 hingga 4.4), matriks hak akses RBAC (Petugas Lapangan, Pegawai, Manager), dan tahapan roadmap MVP.
  * [`docs/GORO S2JB 2026 (Jawaban).xlsx`](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx): Data spreadsheet acuan riil yang memuat struktur lembar kerja asli (*Form Responses 1*, *note*, *LAPORAN HARIAN H-1*, *LAPORAN HARIAN*, dan *LAPORAN BULANAN*) beserta pemetaan 13 kolom operasional.
  * Dokumen teknis, skema arsitektur, diagram data, dan spesifikasi API lain yang ditambahkan ke repositori.
* **Kapan AI Wajib Mengakses `docs/`:**
  * Sebelum merancang skema database, model Prisma, rute API, form UI, alur OCR, atau logika pelaporan.
  * Saat memastikan definisi peran pengguna (*roles*), batas validasi, formula perhitungan metrik, dan aturan bisnis.
  * Saat mencari jawaban atas konteks operasional lama (*As-Is*) maupun sistem baru (*To-Be*).

---

### Direktori 2: `.agents/skills/`
**Fungsi:** Pusat Definisi Agen, Standar Rekayasa Perangkat Lunak, Alur Kerja (*Workflows*), dan Instruksi Perilaku (*Skills*).

* **Isi & Komponen Utama:**
  Folder keahlian modular di mana masing-masing folder memuat berkas `SKILL.md` (dan skrip pendukung) yang merinci instruksi operasional baku:
  * [`.agents/skills/smart-ocr/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/smart-ocr/): Strategi dan teknik pemrosesan OCR, ekstraksi teks, penanganan gambar bukti, dan pencocokan string.
  * [`.agents/skills/working-with-spreadsheets/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/working-with-spreadsheets/) & [`.agents/skills/xlsx/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/xlsx/): Prosedur standar membaca, mem-parsing, memformat, dan mengolah file Excel/CSV bervolume besar tanpa kehilangan presisi data atau merusak formula.
  * [`.agents/skills/frontend-design/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-design/) & [`.agents/skills/web-design-guidelines/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/web-design-guidelines/): Pedoman estetika antarmuka modern, tata letak taktis/korporat (Tailwind CSS + shadcn/ui), aksesibilitas (a11y), dan responsivitas.
  * [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/): Protokol pengujian berbasis *Test-Driven Development* (Red-Green-Refactor).
  * [`.agents/skills/diagnosing-bugs/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/diagnosing-bugs/): Alur investigasi sistematis untuk menangani bug kritis, kegagalan antrean, dan regresi performa.
  * [`.agents/skills/improve-codebase-architecture/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/improve-codebase-architecture/): Pola modularisasi, pemisahan dependensi, dan prinsip *clean architecture*.
  * Skills penunjang interaksi dan verifikasi lainnya (`caveman`, `grill-me`, `grill-with-docs`).
* **Kapan AI Wajib Mengakses `.agents/skills/`:**
  * Saat akan mengeksekusi tugas spesifik yang telah memiliki panduan skill (misal: membangun parser spreadsheet, menyusun prompt OCR, mendesain komponen UI, atau menulis *test suite*).
  * Saat membutuhkan standar penulisan kode atau metodologi penyelesaian masalah yang terstandarisasi.

---

## 2. Aturan Emas & Protokol Eksekusi AI (Cardinal Rules)

Setiap AI agent yang menerima instruksi di repositori ini **WAJIB** mematuhi protokol berikut secara berurutan:

1. **Aturan Pembacaan Awal (Mandatory Pre-Flight Read):**
   * **DILARANG KERAS** langsung menulis kode (*generate code*) atau menyusun asumsi teknis sebelum membaca berkas terkait di direktori `docs/` dan skill relevan di `.agents/skills/`.
   * Jika tugas menyangkut fitur sistem, baca terlebih dahulu [docs/PRD.md](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md).
   * Jika tugas menyangkut domain keahlian tertentu (misal Excel, OCR, UI, Testing), baca berkas `SKILL.md` pada subdirektori terkait di [`.agents/skills/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/).

2. **Hierarki Kebenaran (Hierarchy of Truth):**
   * **Persyaratan Fungsional & Aturan Bisnis:** Kebenaran tertinggi berada pada [docs/PRD.md](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md). AI tidak boleh mengarang entitas baru, mengubah 3 peran RBAC yang telah ditetapkan (Petugas Lapangan, Pegawai, Manager), atau mengganti tech stack yang disepakati tanpa persetujuan eksplisit.
   * **Metodologi Implementasi & Standar Kode:** Mengikuti panduan baku pada berkas `SKILL.md` di [`.agents/skills/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/).

3. **Larangan Halusinasi Konteks:**
   * Jangan mengasumsikan nama kolom, batas baris, atau alur kerja data yang tidak terdokumentasi. Jika ada ketidakpastian struktur data, verifikasi langsung terhadap berkas acuan di `docs/`.

4. **Sinkronisasi Dokumentasi Berkelanjutan:**
   * Jika ada perubahan fundamental pada kebutuhan sistem atau keputusan teknis baru atas permintaan pengguna, dokumentasi pada `docs/` harus diperbarui secara konsisten agar tetap menjadi rujukan yang valid bagi sesi berikutnya.
