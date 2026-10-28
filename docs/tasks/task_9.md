# Task 9: Implementasi Modul Manajemen Pengguna Eksklusif Super Admin, Otorisasi RBAC & Penyelarasan Desain Utilitas

> **Status:** Completed / Verified ✅  
> **Fase:** 3 (Keamanan Administratif, Otorisasi RBAC Eksklusif & Desain Sistem Utilitas)  
> **Target Audiens:** Full-Stack Engineer, Security/RBAC Specialist, Frontend Engineer, QA Automation Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 5: Keamanan & Hak Akses RBAC)
> - [`DESIGN.md`](file:///Users/a69/Desktop/goro-s2jb/DESIGN.md) (Spesifikasi Fondasi Desain Responsif & Estetika Utilitas)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Anti-Slop Core Filter)
> - [`.agents/skills/antislop-ui/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-ui/SKILL.md) (Visual, Warna, Komponen & Hirarki)
> - [`.agents/skills/antislop-layoutmobile/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-layoutmobile/SKILL.md) (Breakpoints, Layout Mobile & Tap Targets)
> - [`.agents/skills/antislop-human/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-human/SKILL.md) (Kontras WCAG AA & Aksesibilitas Keyboard)
> - [`.agents/skills/nextjs-best-practices/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/nextjs-best-practices/)

---

## 1. Ringkasan & Tujuan Task

Mengimplementasikan modul **Manajemen Pengguna (`/users`)** secara penuh dengan standar **Modern Utility Minimalism** dan penegakan keamanan ketat berbasis peran (*Role-Based Access Control / RBAC*):

1. **Visibilitas Navigasi Eksklusif:**
   * Menu **"Manajemen Pengguna"** (`/users`) dan seluruh menu administratif hanya boleh tampil pada bilah navigasi (`GlobalSidebar` dan `MobileNavDrawer`) apabila pengguna telah terautentikasi dengan peran **`SUPER_ADMIN`**.
   * Menu ini tidak boleh dirender sama sekali untuk tamu (`GUEST`), petugas lapangan (`PETUGAS_LAPANGAN`), verifikator triase (`PEGAWAI`), maupun manajer (`MANAGER`).
2. **Proteksi Rute & Server Prosedur Berlapis:**
   * Di tingkat middleware Next.js (`middleware.ts`), seluruh akses menuju rute `/users` diverifikasi via JSON Web Token (JWT). Akses tanpa sesi dialihkan ke `/login?redirect=/users`, sedangkan pengguna terautentikasi non-admin dialihkan ke `/unauthorized?required=SUPER_ADMIN`.
   * Di tingkat API tRPC (`src/server/routers/user.ts`), seluruh prosedur mutasi dan kueri dilindungi oleh `adminProcedure` dengan penolakan `TRPCError({ code: "FORBIDDEN" })` jika peran bukan `SUPER_ADMIN`.
3. **Penyelarasan Desain Utilitas (Modern Utility Minimalism):**
   * Menggantikan palet gelap lama pada tabel manajemen dan modal formulir dengan kanvas terang bersih (`#f9f9ff`), kartu putih `#ffffff`, batas tepi lembut `#e2e8f0`, dan tipografi teks tinta karbon `#0f172a`.
   * Lencana peran (*Role Badges*) dan status akun (*Account Status*) menggunakan varian pastel datar (*zero elevation*) dengan kontras tinggi WCAG AA.
   * Seluruh elemen interaktif (tombol, input, dropdown, toggle switch) mematuhi batas tap target minimal 44px (R-03).
4. **Alur Kerja Operasional & Jejak Audit (Audit Trail):**
   * Pembuatan akun baru dengan validasi penugasan unit kerja (UP3/ULP) dinamis.
   * Penggantian status aktif/nonaktif akun secara instan dengan konfirmasi taktis.
   * Reset kata sandi pengguna dengan pembuatan kredensial sementara dan fitur salin sekali klik.
   * Pencatatan otomatis ke tabel `AuditLog` pada database setiap kali terjadi perubahan kredensial atau status pengguna.

---

## 2. Struktur Sub-Task Hierarkis

* **Task 9.1:** Penegakan Navigasi Eksklusif Super Admin pada `GlobalSidebar` dan `MobileNavDrawer`
* **Task 9.2:** Refaktorisasi Tabel Pengguna (`UserManagementTable.tsx`) ke Desain Modern Utility Minimalism
* **Task 9.3:** Refaktorisasi Dialog Tambah Pengguna & Modal Reset Sandi (`UserFormDialog.tsx`)
* **Task 9.4:** Penyelarasan Prosedur Backend tRPC & Integrasi Jejak Audit (`user.ts`, `auditService.ts`)
* **Task 9.5:** Penegakan Standar Mutu Anti-Slop (WCAG AA Contrast $\ge 4.5:1$, Keyboard A11y & Copywriting)
* **Task 9.6:** Otomasi Pengujian Unit, Integrasi RBAC & Regresi Visual

---

## 3. Instruksi Teknis Rinci

### 3.1 Task 9.1: Penegakan Navigasi Eksklusif Super Admin pada Sidebar Global
1. **Target File:**
   * `src/components/layout/GlobalSidebar.tsx`
2. **Aturan Otorisasi Navigasi:**
   * Konfigurasikan item menu `NAV_ITEMS` untuk rute admin agar hanya berisi peran `SUPER_ADMIN`:
     ```typescript
     {
       label: "Manajemen Pengguna",
       href: "/users",
       icon: Users,
       roles: ["SUPER_ADMIN"],
     },
     {
       label: "Migrasi Data Eviden",
       href: "/admin/migration",
       icon: Database,
       roles: ["SUPER_ADMIN"],
     },
     {
       label: "Catatan Audit Log",
       href: "/admin/audit-logs",
       icon: ShieldAlert,
       roles: ["SUPER_ADMIN"],
     }
     ```
   * Pastikan pengguna `GUEST`, `PETUGAS_LAPANGAN`, `PEGAWAI`, dan `MANAGER` tidak dapat melihat opsi menu tersebut di bilah navigasi desktop maupun mobile drawer.
   * Di beranda komando (`src/app/page.tsx`), sembunyikan atau berikan pembatasan visual pada kartu pintasan navigasi "Manajemen Pengguna" sesuai peran aktif sesi.

---

### 3.2 Task 9.2: Refaktorisasi Tabel Pengguna (`UserManagementTable.tsx`)
1. **Target File:**
   * `src/components/admin/UserManagementTable.tsx`
2. **Spesifikasi Visual & Antarmuka:**
   * **Bilah Toolbar Pencarian & Filter:**
     * Latar kartu putih `#ffffff`, batas tepi `#e2e8f0`, bayangan halus `shadow-xs`.
     * Kotak pencarian dengan ikon `Search`, input tinggi minimal 44px, teks tinta karbon `#0f172a`.
     * Dropdown filter Peran (*All*, *Petugas Lapangan*, *Pegawai Triase*, *Manager*, *Super Admin*) dan Status (*All*, *Aktif*, *Nonaktif*).
     * Tombol refresh data berukuran minimal 44x44px dengan indikator animasi putar saat fetching.
   * **Struktur Tabel Utilitas:**
     * Header tabel latar `#f8fafc`, teks `#475569`, border `#e2e8f0`, ukuran teks `text-xs uppercase font-semibold`.
     * Kolom: Pengguna (Nama & Username), Peran (Lencana RBAC), Penugasan Unit (UP3/ULP), Status Akun, Waktu Terdaftar, dan Tindakan.
   * **Desain Lencana Peran (Pastel Flat):**
     * `PETUGAS_LAPANGAN`: Latar `#e0f2fe`, teks `#0369a1`, border `#bae6fd` (Biru Kehijauan).
     * `PEGAWAI`: Latar `#fff7ed`, teks `#b45309`, border `#fed7aa` (Oranye Kuning).
     * `MANAGER`: Latar `#eff6ff`, teks `#1d4ed8`, border `#bfdbfe` (Biru Laut).
     * `SUPER_ADMIN`: Latar `#ecfdf5`, teks `#15803d`, border `#a7f3d0` (Hijau Zamrud).
   * **Desain Status Akun:**
     * `AKTIF`: Latar `#f0fdf4`, teks `#15803d`, border `#bbf7d0` dengan indikator titik solid hijau `#16a34a`.
     * `NONAKTIF`: Latar `#fef2f2`, teks `#b91c1c`, border `#fecaca` dengan indikator titik solid merah `#ef4444`.
   * **Tombol Aksi Taktis (Tap Target $\ge 44\text{px}$):**
     * Tombol *Reset Sandi*: Latar `#f8fafc`, border `#cbd5e1`, teks `#334155`, hover `#f1f5f9`.
     * Tombol *Nonaktifkan / Aktifkan*: Merah pastel saat aktif, hijau pastel saat nonaktif.

---

### 3.3 Task 9.3: Refaktorisasi Modal Tambah Pengguna & Reset Sandi
1. **Target File:**
   * `src/components/admin/UserFormDialog.tsx`
2. **Formulir Tambah Pengguna (`UserFormDialog`):**
   * Backdrop modal: `bg-slate-900/40 backdrop-blur-xs`.
   * Panel dialog: Latar `#ffffff`, border `#e2e8f0`, rounded-2xl, bayangan `shadow-xl`.
   * Input teks terstruktur:
     - Nama Lengkap (min 2 karakter).
     - Username (huruf kecil, angka, garis bawah, unik, min 3 karakter).
     - Kata Sandi Awal (default disiapkan acak atau `password123`).
     - Pilihan Peran (Dropdown: Petugas Lapangan, Pegawai Triase, Manager, Super Admin).
     - Pilihan UP3 & ULP: Menampilkan pilihan UP3 secara dinamis; jika peran adalah `PETUGAS_LAPANGAN`, wajib memilih ULP spesifik.
   * Tombol *Batal* (minimal 44px) dan *Simpan Pengguna* (warna `#00a2b9`, hover `#0097a7`, teks putih, min 44px).
3. **Modal Umpan Balik Reset Kata Sandi:**
   * Menampilkan kata sandi baru dalam blok font monospaced tebal (`bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a]`).
   * Tombol aksi *Salin Kata Sandi* sekali klik dengan indikator centang hijau saat berhasil disalin.

---

### 3.4 Task 9.4: Integrasi Prosedur Backend tRPC & Jejak Audit
1. **Target File:**
   * `src/server/routers/user.ts`
   * `src/server/services/auditService.ts`
2. **Pengecekan Otorisasi `adminProcedure`:**
   * Seluruh mutasi (`createUser`, `toggleStatus`, `resetPassword`) dan kueri (`listUsers`, `getUnitOptions`) terlindungi mutlak oleh `adminProcedure`.
3. **Pencatatan Audit Trail:**
   * Saat akun baru dibuat: `logAuditEvent({ action: "USER_CREATE", actorId, targetId: newUser.id, details: { username, role, up3Id, ulpId } })`.
   * Saat status diubah: `logAuditEvent({ action: "USER_STATUS_TOGGLE", actorId, targetId: user.id, details: { previousStatus, newStatus } })`.
   * Saat sandi di-reset: `logAuditEvent({ action: "USER_PASSWORD_RESET", actorId, targetId: user.id, details: { resetAt: new Date() } })`.

---

### 3.5 Task 9.5: Penegakan Kepatuhan Standar Anti-Slop
1. **Aturan Mutlak:**
   * Dilarang menggunakan tanda baca em dash (`—`). Gunakan tanda kurung atau titik dua.
   * Seluruh teks antarmuka wajib memenuhi rasio kontras WCAG AA $\ge 4.5:1$ terhadap latar belakangnya.
   * Seluruh tombol interaktif dan kontrol input wajib memiliki ukuran tap target minimal $44 \times 44\text{px}$.
   * Aksesibilitas keyboard penuh: modal dapat ditutup dengan tombol `Escape`, fokus otomatis pada input pertama saat modal terbuka, dan outline fokus terlihat jelas (`focus-utility-ring`).

---

### 3.6 Task 9.6: Otomasi Pengujian Unit, Integrasi & Keamanan RBAC
1. **Target File:**
   * `tests/unit/adminUserManagement.test.ts`
   * `tests/integration/adminRbacSecurity.test.ts`
2. **Cakupan Pengujian:**
   * **Test 1 (Navigasi Berbasis Peran):** Memastikan menu "Manajemen Pengguna" hanya ada dalam daftar `visibleItems` jika peran adalah `SUPER_ADMIN`, dan bernilai `false` untuk peran lainnya.
   * **Test 2 (Penolakan API untuk Non-Admin):** Memastikan pemanggilan `user.listUsers` atau `user.createUser` oleh peran `PETUGAS_LAPANGAN`, `PEGAWAI`, atau `MANAGER` memicu `FORBIDDEN` error.
   * **Test 3 (Validasi Input Tambah User):** Memastikan Petugas Lapangan wajib memilih UP3 dan ULP, serta username duplikat memicu `CONFLICT` error.
   * **Test 4 (Pencatatan Audit Trail):** Memastikan entri `AuditLog` tercipta setiap kali mutasi user dijalankan.

---

## 4. Kriteria Keberhasilan & Verifikasi Penerimaan

* [x] Menu **"Manajemen Pengguna"** pada `GlobalSidebar` dan `MobileNavDrawer` HANYA muncul jika pengguna yang login memiliki peran `SUPER_ADMIN`.
* [x] Rute `/users` menolak akses pengguna non-admin dan mengalihkannya ke halaman `/unauthorized`.
* [x] Tampilan halaman `/users`, tabel pengguna, dan formulir dialog modal menggunakan palet Modern Utility Minimalism (`bg-[#f9f9ff]`, kartu putih, border `#e2e8f0`, teks carbon `#0f172a`).
* [x] Fitur pencarian, filter peran, filter status, tambah user, toggle aktif/nonaktif, dan reset password berfungsi mulus tanpa glitch visual.
* [x] Seluruh aksi admin tercatat secara akurat di tabel `AuditLog`.
* [x] Seluruh kontrol interaktif memiliki ukuran tap target minimal 44px dan lolos audit kontras WCAG AA (4.5:1).
* [x] Seluruh unit test dan integration test baru berhasil lulus tanpa regresi (115 passing tests across 27 suites).
