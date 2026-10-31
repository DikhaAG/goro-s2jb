# Task 18: Pusat Manajemen & Pengelolaan Data Ulasan (Full-Lifecycle CRUD & Advanced Data Grid) untuk Role Pegawai

> **Status:** Selesai / Completed ✅  
> **Fase:** 3 (Manajemen Data Operasional Pasca-Migrasi, Auditability, & Kontrol Kuratif Operator)  
> **Target Audiens:** Operator Triase (Pegawai), Fullstack Next.js Engineer, Data QA Specialist, UI/UX Designer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Modul 4.1: Migrasi Data Historis & Modul 4.3: Dasbor Triase Operator)
> - [`docs/tasks/task_4.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_4.md) (Sistem Triase Ulasan Operator)
> - [`docs/tasks/task_16.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_16.md) (Arsitektur Dekopel Ingesti Data Masif & Streaming Eviden)
> - [`docs/tasks/task_17.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_17.md) (Pusat Kontrol Layanan & Observabilitas Sistem)
> - [`.agents/skills/frontend-ui-engineering/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-ui-engineering/SKILL.md) (Arsitektur UI, Aksesibilitas WCAG, & State Management)
> - [`.agents/skills/apple-design/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/apple-design/SKILL.md) (Estetika Apple Design, Slide-Over Sheet, & Transisi Halus)
> - [`.agents/skills/impeccable/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/impeccable/SKILL.md) (High-End Interface Polish & Typographic Hierarchy)
> - [`.agents/skills/tdd/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/SKILL.md) (Test-Driven Development & Pengujian Menyeluruh)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Core Anti-Slop Filter & Larangan Karakter Em Dash)

---

## 1. Latar Belakang Masalah & Urgensi Bisnis

### 1.1 Kebutuhan Manajemen Data Pasca-Migrasi Masif
Setelah implementasi pipeline migrasi dekopel berjenjang (Task 16), puluhan hingga ratusan ribu baris data ulasan dari Google Form historis ([`docs/testing/dataformasli.csv`](file:///Users/a69/Desktop/goro-s2jb/docs/testing/dataformasli.csv)) berhasil diimpor ke dalam tabel `RatingReview` PostgreSQL.

Namun, dalam operasional harian terdapat keterbatasan fungsional yang signifikan bagi role **Pegawai (Operator Triase)**:
1. **Dasbor Triase (`/triage`) Hanya Berfokus pada Antrean Zona Kuning:**  
   Halaman triase dirancang khusus untuk memvalidasi kasus marginal (skor konfiden 70.0% - 89.9%). Dasbor tersebut tidak menyediakan kapabilitas untuk menelusuri data ulasan yang berstatus *Hijau* (disetujui otomatis), *Merah* (ditolak), maupun data historis yang sudah selesai divalidasi.
2. **Tidak Ada Antarmuka Kuratif untuk Koreksi Data Impor:**  
   Data mentah spreadsheet kerap mengandung kesalahan ketik (*typo*) nama pengulas Play Store, salah pemetaan unit UP3/ULP oleh petugas lapangan, atau tanggal entri yang keliru. Saat ini, pegawai tidak memiliki sarana untuk mengedit atau memperbarui metadata baris tersebut tanpa intervensi langsung ke basis data.
3. **Ketiadaan Aksi Massal (*Bulk Actions*):**  
   Jika sebuah file CSV diimpor dengan penetapan unit UP3 yang keliru untuk 500 baris, operator tidak dapat memindahkan unit ulasan tersebut secara kolektif, memicu pemicuan ulang OCR serentak (*bulk retry OCR*), atau menghapus baris duplikat yang tidak valid secara massal.
4. **Kebutuhan Jejak Audit (*Audit Trail*) Menyeluruh:**  
   Setiap penyuntingan atau pembaruan status manual wajib tercatat secara transparan di tabel `AuditLog` agar manajer dan super admin dapat memverifikasi siapa yang mengubah data, kapan, dan nilai sebelum/sesudah perubahan.

Oleh karena itu, diperlukan sebuah modul baru: **Pusat Manajemen & Pengelolaan Data Ulasan (Full-Lifecycle CRUD & Advanced Data Grid)** pada rute `/reviews` khusus untuk role `PEGAWAI` dan `SUPER_ADMIN`.

---

## 2. Arsitektur Solusi & Alur Pengguna (User Journey)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             PUSAT MANAJEMEN DATA ULASAN: /reviews (Role: PEGAWAI & SUPER_ADMIN)         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Top KPI Ribbon]                                                                       │
│ Total: 143.234 | Disetujui: 135.210 | Ditolak: 4.820 | Pending: 3.204 | OCR Aktif: 12  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Multidimensional Filter Bar]                                                          │
│ [Cari Nama / Teks OCR] [Status Validasi ▾] [Status OCR ▾] [UP3 ▾] [ULP ▾] [Rentang Tgl]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [Advanced Data Grid with Server-Side Pagination]                                       │
│ [x] D Centang Semua (Bulk Action Toolbar Muncul)                                       │
│ ┌───┬──────────────────────┬─────────────┬──────────┬───────────┬──────────┬─────────┐ │
│ │[x]│ Nama Pengulas (Play) │ Unit UP3/ULP│ Tgl Entri│ Skor OCR  │ Status   │ Aksi    │ │
│ ├───┼──────────────────────┼─────────────┼──────────┼───────────┼──────────┼─────────┤ │
│ │[ ]│ Ahmad Rizky          │ Palembang   │ 28/10/26 │ 94.2% [●] │ APPROVED │ [⋯] [✎] │ │
│ │[x]│ Budi Santoso         │ Jambi       │ 27/10/26 │ 45.0% [●] │ REJECTED │ [⋯] [✎] │ │
│ └───┴──────────────────────┴─────────────┴──────────┴───────────┴──────────┴─────────┘ │
│                                                                                        │
│ [Floating Bulk Action Bar] (Muncul otomatis saat >= 1 baris dicentang)                 │
│  2 baris terpilih | [Ubah Unit Massal] [Picu Ulang OCR] [Validasi Massal] [Ekspor CSV] │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (Klik baris atau tombol ✎)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ SLIDE-OVER INSPECTION & EDIT DRAWER (Apple Sheet Interaction)                          │
│ ┌───────────────────────────────────────┬────────────────────────────────────────────┐ │
│ │ Panel Kiri: Live Evidence Viewer      │ Panel Kanan: Form Koreksi & Audit Trail    │ │
│ │ - Gambar Eviden (Streaming Proxy)     │ - Nama Pengulas Play Store (Editable)      │ │
│ │ - Kontrol Zoom, Pan, & Putar          │ - Nama Akun Google Form (Editable)         │ │
│ │ - Teks Hasil Ekstraksi OCR            │ - Penugasan Unit UP3 & ULP (Cascading Drop)│ │
│ │ - Status Hashing pHash & Duplikasi    │ - Tanggal & Jam Entri Ulasan               │ │
│ │                                       │ - Kategori Pengulas & Catatan Lapangan     │ │
│ │ [Tombol Picu Ulang OCR]               │ - Riwayat Jejak Audit Perubahan Data       │ │
│ │                                       │ [Simpan Perubahan] [Batal]                 │ │
│ └───────────────────────────────────────┴────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Matriks Hak Akses & Keamanan (RBAC)

Modul ini mematuhi standar keamanan *Defense-in-Depth* 5 lapis:
1. **Layer 1 (Edge Proxy):** Rute `/reviews` didaftarkan pada `ROUTE_PERMISSIONS` di `src/lib/rbac.ts` dengan peran `[Role.PEGAWAI, Role.SUPER_ADMIN]`.
2. **Layer 2 (Server Component Layout):** Berada di dalam grup rute terproteksi `src/app/(operator)/layout.tsx` yang menggunakan `createRoleLayout`.
3. **Layer 3 & 4 (tRPC Procedures):** Prosedur mutasi `reviews.update`, `reviews.delete`, `reviews.bulkUpdate`, dan `reviews.retryOcr` dilindungi oleh `operatorProcedure` (hanya Pegawai dan Super Admin).
4. **Layer 5 (Audit Log Compliance):** Setiap mutasi data merekam `action`, `actorId`, `targetId`, `previousState`, dan `newState` ke dalam tabel `AuditLog`.

---

## 4. Rincian Fitur CRUD yang Dirancang

### 4.1 Create (Entri Manual Cepat & Navigasi Terpadu)
* Tombol **"Tambah Ulasan Baru"** di sudut kanan atas header.
* Menyediakan opsi:
  1. *Quick Inline Modal*: Untuk entri cepat 1 data darurat oleh operator.
  2. *Tautan Form Lengkap*: Menuju modul [`/intake`](file:///Users/a69/Desktop/goro-s2jb/src/app/(field)/intake/page.tsx) dengan status sesi operator.

### 4.2 Read (Pencarian Multidimensi & Grid Performa Tinggi)
* **Server-Side Pagination:** Menampilkan 25, 50, atau 100 baris per halaman dengan query efisien (`take`, `skip`, atau cursor-based).
* **Pencarian Cepat Berjenjang (Debounced 300ms):**
  - Mencari berdasarkan `playstoreReviewerName`, `originalReviewerName`, `extractedOcrText`, `fieldNotes`, atau `id`.
* **Filter Komprehensif:**
  - Status Validasi: `ALL`, `PENDING`, `APPROVED`, `REJECTED`.
  - Status Pemrosesan OCR: `ALL`, `QUEUED`, `DOWNLOADING`, `PROCESSING`, `COMPLETED`, `FAILED`.
  - Zona Validasi: `ALL`, `GREEN` (>= 90%), `YELLOW` (70.0% - 89.9%), `RED` (< 70%).
  - Hierarki Unit: Dropdown UP3 dan ULP bertingkat (*cascading*).
  - Filter Flag Duplikat: Menampilkan khusus baris yang terindikasi duplikasi eviden (*pHash duplicate*).
  - Filter Batch Migrasi: Menyaring ulasan berdasarkan batch impor tertentu.
* **KPI Ribbon Real-time:** Menampilkan kartu ringkasan di atas tabel: Total Baris, Lolos Validasi, Ditolak, Menunggu Triase, dan Dalam Proses Antrean OCR.

### 4.3 Update (Drawer Penyuntingan Halus & Koreksi Data)
* **Slide-Over Sheet (Apple Design):**
  - Muncul halus dari sisi kanan tanpa memutus konteks tabel utama.
  - Memuat pratinjau gambar eviden beresolusi penuh menggunakan streaming proxy `/api/evidence/proxy/[reviewId]`.
* **Field yang Dapat Disunting:**
  - `playstoreReviewerName` (Nama pada ulasan Play Store).
  - `originalReviewerName` (Nama akun pengisi).
  - `up3Id` dan `ulpId` (Peralihan unit kerja jika terjadi salah penugasan).
  - `entryDate` (Koreksi tanggal aktivitas ulasan).
  - `appVersionId` (Versi aplikasi PLN Mobile yang diulas).
  - `reviewerCategory` (Pelanggan, Pegawai, Tenaga Alih Daya, dsb.).
  - `fieldNotes` & `reviewRemarks` (Catatan penjelas dari operator).
  - `validationStatus` (Override manual status validasi).
* **Aksi Cepat Baris (*Quick Actions*):**
  - **Picu Ulang OCR (*Retry OCR*):** Memasukkan pekerjaan ke BullMQ dengan prioritas tinggi jika OCR sebelumnya gagal atau menghasilkan skor rendah.
  - **Alihkan Status Duplikat (*Toggle Duplicate Flag*):** Menonaktifkan atau mengaktifkan flag duplikat jika operator memverifikasi ulasan tersebut sah secara manual.

### 4.4 Delete & Kuratif (Pembersihan Data Terkendali)
* **Soft Rejection / Archive:** Menandai baris ulasan sebagai `REJECTED` dengan catatan alasan arsip (misal: "Data Sampah Hasil Uji Coba Lapangan" atau "Spam Bot").
* **Hard Delete Terproteksi (Super Admin Only):** Penghapusan permanen dari basis data hanya diizinkan untuk peran `SUPER_ADMIN` dengan dialog konfirmasi 2 langkah (*two-step destructive confirmation dialog*), dilengkapi input teks verifikasi.

### 4.5 Bulk Actions (Operasi Massal Efisien)
* Bilah tindakan terapung (*Floating Action Bar*) otomatis muncul di bagian bawah layar saat operator memilih minimal 1 baris.
* Opsi operasi massal:
  1. **Bulk Reassign Unit:** Memindahkan puluhan ulasan yang salah penugasan ke UP3/ULP yang benar dalam 1 kali transaksi.
  2. **Bulk Retry OCR:** Memasukkan seluruh baris terpilih yang berstatus `FAILED` atau `QUEUED` ke antrean BullMQ.
  3. **Bulk Status Change:** Menyetujui atau menolak ulasan terpilih secara serentak.
  4. **Bulk Export:** Mengunduh baris yang dipilih dalam format Excel (.xlsx) atau CSV.

---

## 5. Rencana Pembagian Tahapan Implementasi (Phased Plan)

### Tahap 18.1: Backend tRPC Router & Data Access Layer
- [x] Buat router tRPC baru: `src/server/routers/reviews.ts`.
- [x] Implementasikan prosedur:
  - `reviews.getList`: Kueri daftar ulasan dengan paginasi, pengurutan, dan filter multidimensi.
  - `reviews.getDetail`: Kueri detail 1 ulasan beserta relasi UP3, ULP, Batch, dan Audit Log.
  - `reviews.update`: Mutasi pembaruan field ulasan + pencatatan log audit.
  - `reviews.bulkUpdate`: Mutasi batch untuk update unit atau status massal.
  - `reviews.retryOcr`: Enqueue ulang job ke BullMQ `ocrQueue`.
  - `reviews.delete`: Penghapusan aman dengan verifikasi hak akses Super Admin.
- [x] Daftarkan router `reviews` ke dalam root router di [`src/server/routers/_app.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/routers/_app.ts).
- [x] Tulis pengujian unit router di `tests/unit/reviewsRouter.test.ts`.

### Tahap 18.2: Registrasi Rute, RBAC, dan Navigasi Sidebar
- [x] Daftarkan pola rute `/reviews` pada `ROUTE_PERMISSIONS` di [`src/lib/rbac.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/rbac.ts) untuk `[Role.PEGAWAI, Role.SUPER_ADMIN]`.
- [x] Tambahkan menu "Kelola Data Ulasan" ke dalam `NAV_ITEMS` di [`src/components/layout/GlobalSidebar.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/GlobalSidebar.tsx).
- [x] Buat halaman rute baru di `src/app/(operator)/reviews/page.tsx` menggunakan `RoleLayout`.
- [x] Tulis pengujian akses RBAC di `tests/unit/navigationRbacFilter.test.ts` dan `tests/integration/rbacMiddleware.test.ts`.

### Tahap 18.3: Pembangunan Komponen Data Grid & Filter Bar
- [x] Buat komponen KPI Ribbon: `src/components/operator/reviews/ReviewsKpiRibbon.tsx`.
- [x] Buat bilah filter komprehensif: `src/components/operator/reviews/ReviewsFilterBar.tsx` (pencarian debounced, dropdown UP3/ULP cascading, selector status).
- [x] Bangun komponen tabel responsif: `src/components/operator/reviews/ReviewsTable.tsx` dengan checkbox seleksi, lencana status OCR berwarna pastel, indikator zona, dan menu aksi baris.
- [x] Buat kontrol paginasi modern dengan pemilih ukuran halaman (*page size selector*).

### Tahap 18.4: Pembangunan Slide-Over Inspection & Edit Drawer
- [x] Bangun komponen slide-over drawer: `src/components/operator/reviews/ReviewDetailDrawer.tsx` menggunakan prinsip interaksi Apple Design.
- [x] Integrasikan penampil citra eviden resolusi tinggi dengan kemampuan zoom dan streaming proxy.
- [x] Implementasikan form penyuntingan metadata (Nama, Unit, Tanggal, Catatan) dengan validasi Zod.
- [x] Tampilkan tab *Audit History* yang merinci rekaman aktivitas dari tabel `AuditLog`.

### Tahap 18.5: Bilah Aksi Massal (*Floating Bulk Action Bar*) & Modal Konfirmasi
- [x] Buat komponen floating action bar: `src/components/operator/reviews/BulkActionBar.tsx`.
- [x] Buat modal pindah unit massal (*Bulk Unit Reassign Modal*).
- [x] Buat modal konfirmasi eksekusi massal (Status & OCR).
- [x] Buat modal konfirmasi penghapusan kuratif dengan verifikasi dua langkah.

### Tahap 18.6: Pengujian Integrasi Menyeluruh & Verifikasi E2E
- [x] Tulis pengujian integrasi lifecycle CRUD di `tests/integration/reviewsManagementLifecycle.test.ts`.
- [x] Verifikasi seluruh alur pengujian dengan `npm test` dan typecheck `npx tsc --noEmit`.
- [x] Validasi kepatuhan aksesibilitas WCAG AA (kontras warna dan target ketuk tombol).

---

## 6. Kriteria Keberhasilan & Definisi Selesai (DoD)

1. **Akurasi Data & Fungsionalitas CRUD:**
   - Operator dapat mencari dan menemukan baris data ulasan secara instan (< 100ms kueri database).
   - Pengeditan metadata ulasan (nama, unit, tanggal) tersimpan secara atomik dan langsung memicu kalkulasi ulang statistik terkait.
   - Pemicuan ulang OCR dari tabel berhasil menambahkan job ke BullMQ dan status baris berpindah menjadi `QUEUED`/`PROCESSING`.
2. **Integritas Audit Trail:**
   - 100% mutasi data (edit field, pindah unit, perubahan status) tercatat di tabel `AuditLog` dengan detail nilai lama dan nilai baru.
3. **Kualitas Antarmuka Pengguna (UI/UX):**
   - Mengikuti token desain pastel PLN UID S2JB dan standar interaksi Apple Design.
   - Mematuhi standar Anti-Slop (tidak ada karakter em dash, target tap minimal 44px).
4. **Kualitas Kode & Stabilitas Pengujian:**
   - Lolos uji statis TypeScript tanpa error (`npx tsc --noEmit` exit 0).
   - Seluruh test suite (unit + integrasi) lulus 100%.

