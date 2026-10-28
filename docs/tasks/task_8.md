# Task 8: Implementasi Sistem Desain Responsif, Global Sidebar & Penyelarasan Estetika Utilitas PLN S2JB

> **Status:** Draft / Ready for Engineering Execution  
> **Fase:** 3 (Penyelarasan Desain Antarmuka, Standar Utilitas & Pengalaman Pengguna)  
> **Target Audiens:** Frontend Engineer, UI/UX Designer, Design System Engineer, QA Specialist  
> **Referensi Wajib:**
> - [`DESIGN.md`](file:///Users/a69/Desktop/goro-s2jb/DESIGN.md) (Spesifikasi Fondasi Desain Responsif PLN GORO)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Anti-Slop Core Filter)
> - [`.agents/skills/antislop-ui/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-ui/SKILL.md) (Visual, Warna, Komponen & Hirarki)
> - [`.agents/skills/antislop-layoutmobile/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-layoutmobile/SKILL.md) (Tata Letak Mobile, Breakpoints & Tap Targets)
> - [`.agents/skills/antislop-copywriting/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-copywriting/SKILL.md) (Bahasa Kontekstual & Anti-Buzzword)
> - [`.agents/skills/antislop-human/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-human/SKILL.md) (Kontras WCAG AA & Aksesibilitas Keyboard)
> - [`.agents/skills/nextjs-best-practices/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/nextjs-best-practices/)

---

## 1. Ringkasan & Tujuan Task

Menerapkan sistem desain resmi yang tertuang pada [`DESIGN.md`](file:///Users/a69/Desktop/goro-s2jb/DESIGN.md) ke seluruh antarmuka aplikasi GORO S2JB, dengan memadukan filosofi **Modern Utility Minimalism**:
1. Menghadirkan kesan visual yang tenang (*calm*), jelas (*operational clarity*), dan memiliki beban kognitif rendah (*low cognitive overhead*) bagi petugas lapangan, operator triase, dan pimpinan manajemen PLN UID S2JB.
2. Menggantikan tampilan gelap taktis generik dengan palet kanvas terang yang bersih (`#f9f9ff`), kartu status pastel datar (*zero elevation*), lencana ikon solid sirkular berwibawa, dan aksen *Primary Teal* (`#00A2B9` / `#0097A7`).
3. **Arsitektur Layout Global Berbasis Sidebar (Kecuali Halaman Login):** Menghadirkan kerangka kerja antarmuka terpadu (*Global App Shell*) dengan navigasi sidebar permanen pada layar desktop dan drawer geser (*slide-over*) yang ramah sentuhan pada perangkat seluler/tablet untuk seluruh halaman terautentikasi (`/`, `/intake`, `/operator/triage`, `/manager/reports`, `/admin/users`, `/admin/audit-logs`). Halaman publik login (`/login`) secara khusus dikecualikan agar tetap fokus dan bebas distraksi.
4. Menerapkan disiplin ketat **antislop-ai** (*Mode: DURING*): melarang em dash (`—`), mengeliminasi efek neon glow atau glassmorphism berlebihan, memastikan ukuran tap target minimal 44px, mematuhi rasio kontras WCAG AA (4.5:1), serta menjamin navigasi keyboard penuh (C-1 s/d C-5).

---

## 2. Struktur Sub-Task Hierarkis

* **Task 8.1:** Fondasi Token Desain, Skala Tipografi Inter & Variabel CSS (Tailwind Engine)
* **Task 8.2:** Arsitektur Shell Aplikasi & Sidebar Global Responsif (`AppShell`, `GlobalSidebar`, `MobileNavDrawer`)
* **Task 8.3:** Pustaka Komponen Primitif Sistem Desain (Notification Cards, Badges, Buttons, Inputs)
* **Task 8.4:** Refaktorisasi Antarmuka Multi-Peran Terintegrasi Sidebar
* **Task 8.5:** Penegakan Standar Mutu Anti-Slop (Copywriting, Tipografi, Kontras WCAG AA & Aksesibilitas)
* **Task 8.6:** Otomasi Pengujian Mutu Desain & Regresi Visual (Unit, Layout & Integration Test Suite)

---

## 3. Instruksi Teknis Rinci

### 3.1 Task 8.1: Fondasi Token Desain, Skala Tipografi Inter & Variabel CSS
1. **Target File:**
   * `src/app/globals.css`
   * `src/app/layout.tsx`
2. **Implementasi Variabel CSS & Tema Tailwind v4:**
   * **Kanvas & Permukaan (*Surfaces*):**
     * `--surface`: `#f9f9ff` (latar utama aplikasi)
     * `--surface-container-lowest`: `#ffffff` (latar kartu & modul utama)
     * `--surface-container`: `#e7eeff`
     * `--surface-container-high`: `#dee8ff`
     * `--surface-dim`: `#cfdaf2`
   * **Warna Aksen & Operasional:**
     * `--primary`: `#006877`
     * `--primary-teal`: `#00a2b9` (interaksi primer, tautan aktif)
     * `--primary-teal-dark`: `#0097A7` (status hover tombol primer)
     * `--reward-accent`: `#f97316` (aksen khusus sorotan pencapaian)
   * **Hirarki Teks Tinta Karbon & Slate:**
     * `--text-dark-carbon`: `#0f172a` (judul utama & angka numerik tebal)
     * `--text-primary`: `#1e293b` (judul kartu & teks reguler tebal)
     * `--text-secondary`: `#64748b` (metadata, label tanggal, dan catatan)
   * **Sistem Notifikasi Semantik Pastel:**
     * *Neutral / Info:* background `#f8fafc`, icon container `#475569`, icon `#ffffff`
     * *Warning:* background `#fff7ed`, icon container `#f97316`, icon `#ffffff`
     * *Success:* background `#f0fdf4`, icon container `#22c55e`, icon `#ffffff`
     * *Error:* background `#fef2f2`, icon container `#ef4444`, icon `#ffffff`
3. **Penyelarasan Tipografi Inter:**
   * Konfigurasi font family `Inter`, sans-serif di `src/app/layout.tsx`.
   * Standardisasi kelas tipografi:
     * `headline-xl`: 36px / line-height 44px / font-weight 700 (Desktop), 28px / 34px (Mobile)
     * `headline-lg`: 28px / 36px / font-weight 600 (Desktop), 24px / 30px (Mobile)
     * `headline-md`: 22px / 28px / font-weight 600
     * `title-card`: 16px / 22px / font-weight 600
     * `body-lg`: 16px / 24px / font-weight 400
     * `body-md`: 14px / 20px / font-weight 400
     * `body-meta`: 13px / 18px / font-weight 400
     * `label-badge`: 12px / 16px / font-weight 500
     * `label-action`: 14px / 20px / font-weight 600
4. **Pembersihan Pattern AI Slop (Anti-Slop Hard Gate R-01, R-10, R-12, R-13):**
   * Hapus seluruh kelas `.glow-cyan`, `.glow-amber`, `.glow-emerald`.
   * Batasi penggunaan glassmorphism (dosis maksimal 1-2 elemen pada header mengambang jika diperlukan; dilarang pada kartu dan modal sekaligus per R-10).
   * Terapkan aturan *Flat Pastel Cards*: kartu status semantik wajib murni tanpa bayangan (`box-shadow: none; border: none;`).

---

### 3.2 Task 8.2: Arsitektur Shell Aplikasi & Sidebar Global Responsif
1. **Target File:**
   * `src/components/layout/AppShell.tsx`
   * `src/components/layout/GlobalSidebar.tsx`
   * `src/components/layout/MobileNavDrawer.tsx`
   * `src/components/layout/TopHeader.tsx`
   * `src/app/(field)/layout.tsx`
   * `src/app/(operator)/layout.tsx`
   * `src/app/(manager)/layout.tsx`
   * `src/app/(admin)/layout.tsx`
   * `src/app/page.tsx`
2. **Kaidah Pengecualian Halaman Login (*Login Exclusion Rule*):**
   * Halaman login publik (`src/app/(auth)/login/page.tsx`) **TIDAK** menggunakan `AppShell` atau sidebar. Halaman ini menggunakan layout mandiri terpusat yang tenang dan fokus.
   * Seluruh rute kerja terautentikasi dibungkus oleh `AppShell` yang mengintegrasikan sidebar secara konsisten.
3. **Struktur Komponen & Tata Letak Sidebar:**
   * **Struktur Desktop ($\ge 1024\text{px}$ / Layar Komputer):**
     * Sidebar statis menempel di sebelah kiri dengan lebar tetap `w-64` (256px), ketinggian penuh `h-screen`, latar putih `#ffffff`, dan border kanan tipis 1px `#e2e8f0`.
     * Area konten utama memiliki offset kiri `lg:pl-64`, kanvas latar `#f9f9ff`, dengan padding responsif yang nyaman.
   * **Struktur Seluler & Tablet ($< 1024\text{px}$):**
     * Top header tipis di bagian atas dengan logo PLN, indikator unit, dan tombol pemicu menu (*hamburger button*) dengan target sentuh minimal 44px × 44px (R-03).
     * Sidebar muncul sebagai panel laci geser (*slide-over drawer*) dengan animasi transisi mulus, lapisan overlay peredup layar (*backdrop blur* halus), dan dapat ditutup dengan tombol silang, tombol `Escape` keyboard (R-32), atau ketukan pada area backdrop.
4. **Navigasi Dinamis Berbasis Peran (*RBAC-Filtered Menus*):**
   * **Header Sidebar:**
     * Logo resmi PLN UID S2JB, judul sistem *"GORO S2JB"*, dan lencana tahun *"2026"* bernuansa pastel teal.
   * **Kelompok Menu Navigasi:**
     * *Semua Pengguna Terautentikasi:*
       - Beranda Komando (`/`)
     * *Petugas Lapangan (`PETUGAS_LAPANGAN`):*
       - Entri Eviden Lapangan (`/intake`)
     * *Pegawai Operator (`PEGAWAI`):*
       - Antrean Triase Ulasan (`/operator/triage`)
     * *Manajer Wilayah (`MANAGER`):*
       - Laporan & Intelijen Kinerja (`/manager/reports`)
     * *Super Administrator (`SUPER_ADMIN`):*
       - Akses seluruh modul operasional (`/intake`, `/operator/triage`, `/manager/reports`)
       - Manajemen Pengguna (`/admin/users`)
       - Migrasi Data & Impor Eviden (`/admin/migration`)
       - Catatan Audit Sistem (`/admin/audit-logs`) (Halaman baru yang akan dibangun di Task 8)
   * **Status Visual Item Menu:**
     * *Item Aktif:* Background pastel teal muda (`#e7eeff`), teks tebal Primary Teal `#006877`, border vertikal kiri 3px solid `#00a2b9`, dan lencana indikator status.
     * *Item Tidak Aktif:* Teks warna slate `#64748b`, transisi hover latar `#f8fafc` dan teks `#1e293b`.
     * *Ikon Menu:* Menggunakan ikon Lucide yang relevan dengan konteks tugas (tidak ada ikon sparkle/magic generik per R-04).
   * **Footer Sidebar:**
     * Ringkasan akun login: Avatar inisial bulat solid, nama pengguna, peran pengguna (*badge* pastel), dan nama UP3/ULP penugasan.
     * Tombol Keluar (*Logout Button*): Memiliki aksi fungsional membersihkan cookie sesi JWT dan mengalihkan pengguna kembali ke `/login`.

---

### 3.3 Task 8.3: Pustaka Komponen Primitif Sistem Desain
1. **Target File:**
   * `src/components/ui/NotificationCard.tsx`
   * `src/components/ui/FloatingUtilityCard.tsx`
   * `src/components/ui/Button.tsx`
   * `src/components/ui/Input.tsx`
   * `src/components/ui/Badge.tsx`
2. **Spesifikasi Komponen:**
   * **Semantic Notification Card (`NotificationCard.tsx`):**
     * Struktur: `flex flex-row items-center gap-4 w-full p-4 rounded-2xl transition-all duration-200 cursor-pointer`
     * *Leading Icon Badge:* Lingkaran penuh (`rounded-full`, 40px × 40px) dengan warna solid sesuai status (slate, orange, green, red) dan ikon putih di tengah.
     * *Content Block:* Judul tebal `#1e293b` (`text-title-card`) dan subtitle `#64748b` (`text-body-meta`).
     * *Center Dot Separator Rule:* Wajib menggunakan karakter titik tengah ` • ` dengan padding 1 spasi untuk menghubungkan dua item metadata (contoh: `ULP RIVAI • Hari ini, 09:15` atau `ID: #1092 • 5 Bintang`).
     * *Trailing Action:* Ikon `ChevronRight` di ujung kanan (`ml-auto`), warna `#94a3b8`.
   * **Floating Utility Card (`FloatingUtilityCard.tsx`):**
     * Permukaan `#ffffff`, `rounded-2xl`, elevasi halus `shadow-sm` (`0 1px 3px 0 rgba(0, 0, 0, 0.06)`).
     * Header flex row: label akun/unit, angka metrik tebal, dan tombol aksi primer.
   * **Tombol Interaktif (`Button.tsx`):**
     * Varian Primer: Background `#00a2b9`, teks `#ffffff`, hover `#0097a7`, active scale 0.98, `rounded-lg` (8px).
     * Varian Sekunder/Tersier: Teks `#00a2b9`, weight 600, latar transparan dengan hover `#f0f3ff`.
     * Standar Aksesibilitas: Minimum tap target tinggi 44px (`min-h-[44px]`) untuk perangkat layar sentuh (R-03).
     * Fokus Keyboard: Cincin fokus 2px berwarna `#00a2b9` tanpa mematikan garis luar bawaan (R-32).
   * **Bidang Input Form (`Input.tsx`):**
     * Latar `#f8fafc` dengan border 1px `#cbd5e1`, teks `#0f172a`, `rounded-lg` (8px).
     * State fokus: Ring 2px berwarna `#00a2b9` dengan transisi halus tanpa bayangan buram.

---

### 3.4 Task 8.4: Refaktorisasi Antarmuka Multi-Peran Terintegrasi Sidebar
1. **Target File:**
   * `src/app/(field)/intake/page.tsx` & `src/components/field/`
   * `src/app/(operator)/triage/page.tsx` & `src/components/operator/`
   * `src/app/(manager)/reports/page.tsx` & `src/components/manager/`
   * `src/app/(admin)/users/page.tsx`, `audit-logs/page.tsx` & `src/components/admin/`
2. **Penyelarasan Halaman:**
   * **Petugas Lapangan (`/intake`):**
     * Terintegrasi dalam `AppShell`, navigasi samping memudahkan berpindah antara formulir entri dan halaman ringkasan.
     * Sempurnakan form entri: dropdown unit, input nama pengulas, area dropzone foto eviden dengan feedback instan visual pastel.
     * Desain ramah seluler (*mobile-first*): batas tombol 44px, teks terbaca jelas di bawah terik matahari lapangan.
   * **Pegawai Operator Triase (`/operator/triage`):**
     * Panel triase split-pane yang bersih dengan kartu pastel semantik: ulasan zona hijau (pastel hijau `#f0fdf4`), zona kuning (pastel oranye `#fff7ed`), dan zona merah (pastel merah `#fef2f2`).
     * Integrasikan petunjuk pintasan keyboard (`A`, `R`, `J`, `K`) secara minimalis dan rapi tanpa elemen floating yang mengaburkan teks perbandingan OCR.
   * **Manajer Eksekutif (`/manager/reports`):**
     * Dasbor pelaporan eksekutif berlebar penuh di dalam area konten sidebar (`lg:pl-64`).
     * Kartu KPI (`ExecutiveKpiCards`) menggunakan kanvas putih berkontur halus `shadow-sm`, angka numerik Inter tebal `#0f172a`, dan persentase capaian target dengan indikator warna semantik.
     * Sesuaikan grafik pacing kumulatif (`CumulativePacingChart`) dan chart performa (`PerformanceChart`) agar selaras dengan palet teal dan oranye resmi PLN.
     * Format tabel laporan harian & bulanan dengan baris berkontras tinggi dan padding yang proporsional.
   * **Tata Kelola Pengguna, Migrasi & Audit (`/admin/`):**
     * Menu admin dapat diakses langsung dari sidebar untuk pengguna bertaraf `SUPER_ADMIN`.
     * Menghubungkan rute admin yang telah ada: Manajemen Pengguna (`/admin/users`) dan Migrasi Data Eviden (`/admin/migration`).
     * Halaman Catatan Jejak Audit (`/admin/audit-logs`): Akan dibangun secara baru (*new page*) pada Task 8 untuk memvisualisasikan data tabel `AuditLog` yang telah direkam oleh sistem sejak Task 6.
     * Terapkan tabel data dengan border tipis bersih `#e2e8f0`, lencana peran (*role badge*) pastel solid, dan form modal tambah user yang ramah keyboard.

---

### 3.5 Task 8.5: Penegakan Standar Mutu Anti-Slop & Aksesibilitas
1. **Pemeriksaan Wajib Aturan Keras (*Hard Gate*):**
   * **R-02 (Larangan Em Dash):** Pastikan tidak ada karakter em dash (`—`) di seluruh teks antarmuka. Ganti dengan koma, titik dua, tanda hubung biasa (`-`), atau tanda kurung `()`.
   * **R-03 (Tata Letak Mobile):** Uji pada lebar layar 360px, 390px, 768px, 1024px, dan 1440px. Pastikan sidebar drawer dapat dibuka-tutup dengan mulus tanpa *horizontal overflow*.
   * **R-15 & R-16 (Bahasa Operasional Lugas):** Dilarang keras memakai istilah generik seperti *"AI-Powered"*, *"Revolutionary"*, *"Seamless"*, atau *"Cutting Edge"*. Gunakan istilah operasional yang tepat (contoh: *"Verifikasi Citra Eviden"*, *"Triase Cepat Operator"*, *"Unduh Rekapitulasi Excel"*).
   * **R-23 & R-38 (Kejujuran Konten):** Gunakan data riil dari database atau penanda placeholder yang jujur. Dilarang membuat testimoni atau metrik rekayasa.
   * **R-24 (Navigasi Valid):** Seluruh item tautan di dalam sidebar global wajib mengarah ke rute halaman yang benar-benar ada dan aktif.
   * **R-25 (Kontras Warna WCAG AA):** Uji rasio kontras warna:
     * Teks normal: rasio kontras $\ge 4.5:1$ terhadap latar belakang.
     * Teks besar (18px+) & angka tebal: rasio kontras $\ge 3:1$.
   * **R-26 & R-27 (Ketuntasan Fungsional):** Semua tombol dan tautan di sidebar dan halaman memiliki aksi nyata. Setiap komponen data memiliki 3 status (*Empty State*, *Loading State*, dan *Error State*).
   * **R-32 (Aksesibilitas Keyboard):** Seluruh elemen interaktif dan tautan sidebar dapat dijangkau menggunakan tombol `Tab` / `Shift+Tab`, dapat diaktifkan dengan `Enter` / `Space`, dan drawer mobile dapat ditutup dengan `Escape`.
2. **Pemeriksaan Gerbang Tujuan (*Purpose-Gate*):**
   * Tidak ada gradien biru-ke-ungu generik (R-01).
   * Tidak ada bayangan berlebih yang membuat komponen melayang tanpa arah (R-12).
   * Bentuk radius sudut konsisten (`rounded-xl` untuk kartu, `rounded-lg` untuk tombol, `rounded-full` untuk badge ikon) dan tidak memaksakan bentuk kapsul (*pill*) pada semua elemen (R-11).

---

### 3.6 Task 8.6: Otomasi Pengujian Mutu Desain & Regresi Visual
1. **Target File:**
   * `tests/unit/designSystemTokens.test.ts`
   * `tests/unit/globalSidebar.test.tsx`
   * `tests/unit/colorContrastWcag.test.ts`
   * `tests/integration/responsiveLayout.test.ts`
2. **Cakupan Pengujian:**
   * **Uji Sidebar & Pengecualian Login:** Memvalidasi bahwa komponen sidebar muncul pada rute dashboard dan secara tegas absen pada halaman login `/login`.
   * **Uji Filtering Menu RBAC:** Memvalidasi bahwa peran `PETUGAS_LAPANGAN` hanya melihat menu intake, `PEGAWAI` melihat menu triase, `MANAGER` melihat menu laporan, dan `SUPER_ADMIN` melihat seluruh menu.
   * **Uji Token & Separator:** Memvalidasi format metadata dengan pemisah titik tengah ` • ` yang valid.
   * **Uji Kontras Warna Otomatis:** Menghitung rasio luminansi relatif antara warna teks `#1E293B` / `#0F172A` / `#64748B` terhadap latar pastel `#F8FAFC`, `#FFF7ED`, `#F0FDF4`, `#FEF2F2`, dan `#FFFFFF` untuk memastikan kelulusan WCAG AA.
   * **Uji 3 Status Komponen UI:** Memverifikasi kehadiran *Empty State*, *Loading Skeleton*, dan *Error Boundary* pada masing-masing modul.
   * **Uji Bebas Em Dash:** Pengujian unit ripgrep/string assertion otomatis yang memastikan tidak ada karakter `—` (Unicode `\u2014`) yang lolos ke bundle produksi.

---

## 4. Kriteria Penerimaan (Acceptance Criteria)

- [ ] **AC-1 (Design System Fidelity):** Seluruh palet warna, skala tipografi Inter, dan bentuk sudut dari `DESIGN.md` terimplementasi 100% pada variabel global CSS dan tema aplikasi.
- [ ] **AC-2 (Zero Slop / Clean Aesthetics):** Tidak ada gradien generik, tidak ada efek neon glow, dan tidak ada glassmorphism berlebih. Kartu notifikasi semantik berkarakter datar pastel (*zero elevation*) dengan lencana ikon bulat solid.
- [ ] **AC-3 (Global Sidebar Integration & Login Exclusion):** Sidebar global aktif pada seluruh rute terautentikasi (`/`, `/intake`, `/operator/triage`, `/manager/reports`, `/admin/users`, `/admin/audit-logs`) dengan menu terfilter otomatis berdasarkan peran pengguna, dan secara eksklusif TIDAK muncul pada halaman login publik (`/login`).
- [ ] **AC-4 (Responsive Navigation Drawer):** Pada layar desktop ($\ge 1024\text{px}$), sidebar tampil tetap di sisi kiri (`w-64`). Pada layar seluler/tablet ($< 1024\text{px}$), sidebar bertransisi menjadi drawer geser yang dapat dibuka via tombol pemicu 44px dan ditutup via tombol silang, backdrop click, atau tombol `Escape` (R-03, R-32).
- [ ] **AC-5 (Anti-Slop Hard Gate Compliance):**
  - Bebas em dash (`—`) di seluruh teks antarmuka pengguna (R-02).
  - Seluruh tombol interaktif memiliki target sentuh minimal 44px (R-03).
  - Teks bebas dari istilah *marketing fluff* / *AI buzzwords* (R-16).
- [ ] **AC-6 (WCAG AA Contrast & Keyboard A11y):** Seluruh pasangan warna teks dan latar belakang lolos standar kontras minimal 4.5:1 (teks normal) dan 3:1 (teks besar). Seluruh alur dapat dinavigasi penuh menggunakan keyboard (R-25, R-32).
- [ ] **AC-7 (Consistent Three-State Handling):** Halaman entri, triase, laporan, dan manajemen memiliki tampilan *Empty State*, *Loading Skeleton*, dan *Error Boundary* yang seragam (R-27).
- [ ] **AC-8 (Test Suite & Build Green):** Rangkaian pengujian unit token sistem desain, navigasi sidebar, dan integrasi lolos 100%, serta `npm run build` berhasil tanpa galat kompilasi atau peringatan TypeScript.

---

## 5. Matriks Berkas yang Dibuat / Diubah

| Jalur Berkas | Aksi | Deskripsi Perubahan |
| :--- | :--- | :--- |
| `docs/tasks/task_8.md` | Diubah | Dokumen spesifikasi teknis Task 8 mencakup sistem desain & sidebar global |
| `src/components/layout/AppShell.tsx` | Dibuat | Wrapper shell aplikasi utama pengelola layout desktop & mobile |
| `src/components/layout/GlobalSidebar.tsx` | Dibuat | Navigasi sidebar kiri persisten dengan filtering menu berbasis peran RBAC |
| `src/components/layout/MobileNavDrawer.tsx` | Dibuat | Laci geser navigasi responsif untuk layar seluler & tablet |
| `src/components/layout/TopHeader.tsx` | Dibuat | Header seluler ramping dengan tombol menu hamburger $\ge 44\text{px}$ |
| `src/app/globals.css` | Diubah | Pembaruan variabel CSS, palet warna pastel & token tipografi Inter |
| `src/app/layout.tsx` | Diubah | Integrasi font Inter dan konfigurasi kanvas dasar `#f9f9ff` |
| `src/app/(field)/layout.tsx` | Dibuat | Layout rute petugas lapangan terintegrasi `AppShell` |
| `src/app/(operator)/layout.tsx` | Dibuat | Layout rute operator triase terintegrasi `AppShell` |
| `src/app/(manager)/layout.tsx` | Dibuat | Layout rute manajer eksekutif terintegrasi `AppShell` |
| `src/app/(admin)/layout.tsx` | Dibuat | Layout rute admin terintegrasi `AppShell` |
| `src/components/ui/NotificationCard.tsx` | Dibuat | Kartu status pastel semantik (Info, Warning, Success, Error) |
| `src/components/ui/FloatingUtilityCard.tsx` | Dibuat | Kartu modul utilitas mengambang dengan elevasi halus `shadow-sm` |
| `src/components/ui/Button.tsx` | Diubah/Dibuat | Tombol aksi primer `#00A2B9` dengan target sentuh $\ge 44\text{px}$ |
| `src/components/ui/Input.tsx` | Diubah/Dibuat | Bidang input latar `#F8FAFC` dengan cincin fokus teal 2px |
| `src/components/ui/Badge.tsx` | Diubah/Dibuat | Lencana status semantik bulat solid berwibawa |
| `src/app/(field)/intake/page.tsx` | Diubah | Penyelarasan antarmuka formulir input eviden petugas lapangan |
| `src/app/(operator)/triage/page.tsx` | Diubah | Penyelarasan antarmuka triase 3 zona dengan kartu status pastel |
| `src/app/(manager)/reports/page.tsx` | Diubah | Penyelarasan dasbor laporan manajer dan kartu metrik KPI |
| `src/app/(admin)/users/page.tsx` | Diubah | Penyelarasan tabel manajemen pengguna dengan token desain |
| `src/app/(admin)/migration/page.tsx` | Diubah | Penyelarasan antarmuka migrasi eviden dengan token desain |
| `src/app/(admin)/audit-logs/page.tsx` | Dibuat | Halaman antarmuka penampil catatan jejak audit keamanan |
| `src/components/admin/AuditLogTable.tsx` | Dibuat | Komponen tabel interaktif pencarian dan filter log audit |
| `tests/unit/globalSidebar.test.tsx` | Dibuat | Pengujian unit komponen sidebar, filtering peran RBAC & drawer |
| `tests/unit/designSystemTokens.test.ts` | Dibuat | Pengujian unit integritas token warna dan separator titik tengah |
| `tests/unit/colorContrastWcag.test.ts` | Dibuat | Pengujian unit rasio kontras WCAG AA palet desain sistem |

---

## 6. Titik Uji & Pengujian (TDD Seams)

1. **Sidebar RBAC Rendering Seam:** Uji rendering `GlobalSidebar` dengan mock berbagai role pengguna (Petugas Lapangan, Pegawai, Manajer, Super Admin). Pastikan menu yang tidak diizinkan tidak pernah dirender ke DOM (R-24).
2. **Login Page Exclusion Seam:** Pastikan rute `/(auth)/login` tidak merender elemen `<aside>` atau `GlobalSidebar` sama sekali.
3. **Mobile Drawer Accessibility Seam:** Uji pembukaan dan penutupan `MobileNavDrawer` via interaksi tombol sentuh dan penekanan tombol `Escape` keyboard (R-32).
4. **Token & Luminance Ratio Seam:** Uji matematis nilai RGB pada palet warna untuk memvalidasi bahwa rasio kontras teks terhadap latar pastel memenuhi formula WCAG AA ($> 4.5:1$).
5. **Center Dot Formatter Seam:** Uji fungsi utilitas format metadata yang memastikan karakter pemisah adalah ` • ` dengan padding satu spasi.
6. **No-Em-Dash Linter Seam:** Skrip verifikasi statis yang memindai semua berkas komponen TSX untuk mendeteksi potensi kebocoran karakter em dash (`—`).
