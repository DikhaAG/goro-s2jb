# Task 13: Refaktorisasi Otorisasi Fitur Migrasi Data Eviden (/migration) ke Peran Pegawai Triase & Hardening RBAC Multi-Peran

> **Status:** Ready for Execution 📋  
> **Fase:** 3 (Otorisasi RBAC Multi-Peran, Manajemen Migrasi Data Historis & Arsitektur App Router)  
> **Target Audiens:** Full-Stack Engineer, Security/RBAC Specialist, Frontend Engineer, QA Automation Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 2 & 5: Alur Kerja Operasional & Matriks RBAC)
> - [`docs/tasks/task_2.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_2.md) (Dasbor Migrasi Berkas Historis CSV / XLSX)
> - [`docs/tasks/task_10.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_10.md) (Matriks RBAC Terpadu)
> - [`docs/tasks/task_12.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_12.md) (Verifikasi Rute Kanonikal & Hardening RBAC)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Anti-Slop Core Filter)
> - [`.agents/skills/antislop-ui/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-ui/SKILL.md) (Desain UI Utilitas & Navigasi)
> - [`.agents/skills/tdd/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/SKILL.md) (Test-Driven Development)
> - [`.agents/skills/nextjs-best-practices/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/nextjs-best-practices/SKILL.md) (Next.js App Router & Server Components)

---

## 1. Ringkasan & Tujuan Task

Memindahkan wewenang operasional fitur **Migrasi Data Eviden Historis (`/migration`)** agar secara resmi dapat diakses dan dioperasikan oleh peran **`PEGAWAI`** (Operator Triase) bersama dengan **`SUPER_ADMIN`**:

1. **Rasionalisasi Operasional Bisnis:**
   * Berdasarkan alur operasional PLN UID S2JB, Pegawai Operator Triase bertugas mengelola pasokan data ulasan Google Play Store historis dari berkas spreadsheet (*Form Responses 1* dan rekap bulanan).
   * Menyerahkan akses fitur `/migration` ke peran `PEGAWAI` memungkinkan operator melakukan proses *onboarding* dan sinkronisasi data tanpa bergantung pada intervensi teknis Administrator Utama.
2. **Restrukturisasi Rute App Router (`(operator)` Group):**
   * Memindahkan berkas rute halaman migrasi dari `src/app/(admin)/migration/page.tsx` ke direktori rute operator `src/app/(operator)/migration/page.tsx`.
   * Memanfaatkan pelindung `OperatorLayout` (`src/app/(operator)/layout.tsx`) yang telah mengawal rute dengan `requireServerAuth([Role.PEGAWAI, Role.SUPER_ADMIN])`.
3. **Pembaruan Otorisasi Berlapis (*Defense-in-Depth*):**
   * **Layer 1 (Route Permissions):** Menambahkan aturan eksplisit pada `src/lib/rbac.ts` untuk rute `/migration` dengan `allowedRoles: [Role.PEGAWAI, Role.SUPER_ADMIN]`.
   * **Layer 2 (Edge Proxy):** Memastikan `src/proxy.ts` meloloskan pengguna berstatus `PEGAWAI` dan `SUPER_ADMIN` pada rute `/migration`.
   * **Layer 3 (HTTP Upload Handler):** Menyesuaikan `src/app/api/upload/route.ts` agar menerima unggahan berkas migrasi (`type="migration"`) dari peran `PEGAWAI` dan `SUPER_ADMIN`.
   * **Layer 4 (tRPC Router):** Menyesuaikan prosedur `migrationRouter` pada `src/server/routers/migration.ts` agar dapat dipanggil oleh `PEGAWAI` dan `SUPER_ADMIN`.
   * **Layer 5 (Navigasi Klien):** Memperbarui `NAV_ITEMS` pada `src/components/layout/GlobalSidebar.tsx` dan kartu modul beranda pada `src/components/home/HomePageClient.tsx`.
4. **Validasi TDD Komprehensif:**
   * Memperbarui seluruh suite pengujian RBAC (`routeGuardMatrix.test.ts`, `comprehensiveRbacMatrix.test.ts`, `trpcRbacFullMatrix.test.ts`, `globalSidebar.test.tsx`) guna mengonfirmasi kelulusan 100% tanpa celah keamanan.

---

## 2. Struktur Sub-Task Hierarkis

* **Task 13.1:** Pemindahan Berkas Rute Halaman Migrasi ke `src/app/(operator)/migration/`
* **Task 13.2:** Pembaruan Matriks `ROUTE_PERMISSIONS` pada `src/lib/rbac.ts`
* **Task 13.3:** Penyesuaian Guard Otorisasi HTTP Route Handler `POST /api/upload`
* **Task 13.4:** Penyesuaian Prosedur Backend tRPC `src/server/routers/migration.ts`
* **Task 13.5:** Penyelarasan Navigasi Antarmuka `GlobalSidebar.tsx` & `HomePageClient.tsx`
* **Task 13.6:** Pembaruan & Eksekusi Pengujian Otomatis Matriks RBAC (TDD)

---

## 3. Instruksi Teknis Rinci

### 3.1 Task 13.1: Pemindahan Rute Halaman Migrasi ke Direktori Operator
1. **Target Berkas:**
   * Pindahkan `src/app/(admin)/migration/page.tsx` $\rightarrow$ `src/app/(operator)/migration/page.tsx`.
   * Hapus direktori `src/app/(admin)/migration/` yang telah kosong.
2. **Kesesuaian Arsitektur:**
   * Karena rute berada di dalam grup `(operator)`, Next.js menyajikan rute kanonikal tetap pada `/migration`.
   * Halaman secara otomatis terproteksi oleh `src/app/(operator)/layout.tsx` yang mewajibkan peran `PEGAWAI` atau `SUPER_ADMIN`.

---

### 3.2 Task 13.2: Pembaruan Matriks RBAC (`src/lib/rbac.ts`)
1. **Target Berkas:**
   * `src/lib/rbac.ts`
2. **Spesifikasi Aturan:**
   * Tambahkan entri rute spesifik `/migration` ke dalam `ROUTE_PERMISSIONS` sebelum aturan fallback:
     ```typescript
     {
       pattern: /^\/migration(\/.*)?$/,
       allowedRoles: [Role.PEGAWAI, Role.SUPER_ADMIN],
     },
     ```
   * Pastikan `isRouteAllowed("/migration", Role.PEGAWAI)` menghasilkan nilai `true`.

---

### 3.3 Task 13.3: Penyesuaian Guard Otorisasi `POST /api/upload`
1. **Target Berkas:**
   * `src/app/api/upload/route.ts`
2. **Spesifikasi Otorisasi Kategori Berkas:**
   * Jika tipe unggahan adalah `type === "migration"`:
     * Izinkan peran `PEGAWAI` dan `SUPER_ADMIN`.
     * Tolak peran `PETUGAS_LAPANGAN` dan `MANAGER` dengan status `403 Forbidden`.
   * Jika tipe unggahan adalah bukti eviden ulasan biasa (`type !== "migration"`):
     * Izinkan peran `PETUGAS_LAPANGAN` dan `SUPER_ADMIN`.
     * Tolak peran `PEGAWAI` dan `MANAGER` dengan status `403 Forbidden`.

---

### 3.4 Task 13.4: Penyesuaian Prosedur Backend tRPC `migration.ts`
1. **Target Berkas:**
   * `src/server/routers/migration.ts`
2. **Spesifikasi Prosedur:**
   * Ganti `adminProcedure` pada router migrasi dengan middleware otorisasi yang menerima `PEGAWAI` dan `SUPER_ADMIN` (`operatorOrAdminProcedure` atau verifikasi `ctx.user.role`).
   * Prosedur kueri dan mutasi yang diizinkan untuk `PEGAWAI`:
     - `migration.startMigration`: Memulai antrean pemrosesan berkas.
     - `migration.listBatches`: Menampilkan riwayat batch impor.
     - `migration.getBatchStatus`: Memantau progres pemrosesan BullMQ.

---

### 3.5 Task 13.5: Penyelarasan Navigasi Antarmuka `GlobalSidebar.tsx` & `HomePageClient.tsx`
1. **Target Berkas:**
   * `src/components/layout/GlobalSidebar.tsx`
   * `src/components/home/HomePageClient.tsx`
2. **Spesifikasi Antarmuka:**
   * Pada `GlobalSidebar.tsx`:
     ```typescript
     {
       label: "Migrasi Data Eviden",
       href: "/migration",
       icon: Database,
       roles: ["PEGAWAI", "SUPER_ADMIN"],
     }
     ```
   * Pada `HomePageClient.tsx`:
     * Tampilkan kartu pintasan operasional "Migrasi Data Eviden" untuk peran `PEGAWAI` di samping modul "Antrean Triase Ulasan".
     * Tetap sembunyikan modul "Manajemen Pengguna" (`/users`) dan "Catatan Audit Log" (`/audit-logs`) dari peran `PEGAWAI`.

---

### 3.6 Task 13.6: Pembaruan & Eksekusi Pengujian Otomatis Matriks RBAC
1. **Target Berkas Pengujian:**
   * `tests/unit/globalSidebar.test.tsx`
   * `tests/integration/routeGuardMatrix.test.ts`
   * `tests/integration/comprehensiveRbacMatrix.test.ts`
   * `tests/integration/trpcRbacFullMatrix.test.ts`
2. **Spesifikasi Pengujian TDD:**
   * **Sidebar Test:** Pegawai Triase melihat 3 item menu navigasi: `["/", "/triage", "/migration"]`.
   * **Route Guard Test:** Pengguna dengan peran `PEGAWAI` yang membuka rute `/migration` mendapatkan respons status `200 OK` (bukan 403 atau redirect).
   * **tRPC Test:** Pemanggilan prosedur migrasi oleh `PEGAWAI` berhasil diproses tanpa `FORBIDDEN` error.
   * **Upload Handler Test:** Unggah berkas CSV/XLSX migrasi oleh `PEGAWAI` lolos verifikasi otorisasi.

---

## 4. Matriks Akses Pasca Refaktorisasi

| Aktor Peran | Akses Halaman `/migration` | Akses API `POST /api/upload` (Migration) | Prosedur tRPC `migration.*` | Visibilitas Menu Sidebar |
| :--- | :--- | :--- | :--- | :--- |
| `GUEST` (Publik) | 307 $\rightarrow$ `/login` | 401 Unauthorized | 401 Unauthorized | Tidak Ada |
| `PETUGAS_LAPANGAN` | 307 $\rightarrow$ `/unauthorized` | 403 Forbidden | 403 Forbidden | Tersembunyi |
| `PEGAWAI` (Triase) | **200 OK** | **200 / 400 (Allowed)** | **Allowed** | **Tampil** |
| `MANAGER` (Eksekutif) | 307 $\rightarrow$ `/unauthorized` | 403 Forbidden | 403 Forbidden | Tersembunyi |
| `SUPER_ADMIN` | **200 OK** | **200 / 400 (Allowed)** | **Allowed** | **Tampil** |

---

## 5. Kriteria Keberhasilan & Verifikasi Penerimaan

* [ ] Halaman migrasi telah dipindahkan ke `src/app/(operator)/migration/page.tsx`.
* [ ] Rute kanonikal `/migration` dapat dibuka langsung oleh peran `PEGAWAI` dan `SUPER_ADMIN`.
* [ ] Pengguna dengan peran `PETUGAS_LAPANGAN` dan `MANAGER` ditolak secara aman (`403 Forbidden` / redirect `/unauthorized`).
* [ ] Menu navigasi "Migrasi Data Eviden" muncul pada sidebar pengguna `PEGAWAI` dan `SUPER_ADMIN`.
* [ ] Upload berkas migrasi melalui `POST /api/upload` dengan `type="migration"` berhasil untuk `PEGAWAI`.
* [ ] Seluruh pengujian unit dan integrasi RBAC (`npm test`) lulus 100% tanpa ada regresi.
