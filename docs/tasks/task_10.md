# Task 10: Pengerasan Otorisasi RBAC End-to-End dengan Next.js Edge Proxy Pattern, Standar Best Practice Autentikasi & Pertahanan Berlapis (Defense-in-Depth)

> **Status:** Completed / Verified ✅  
> **Fase:** 3 (Arsitektur Keamanan, Otorisasi Multi-Layer & Pencegahan Kerentanan Akses)  
> **Target Audiens:** Security Engineer, Backend Lead, Full-Stack Engineer, QA Automation Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 5: Keamanan & Hak Akses RBAC)
> - [`DESIGN.md`](file:///Users/a69/Desktop/goro-s2jb/DESIGN.md) (Spesifikasi Fondasi Desain & Antarmuka)
> - [`.agents/skills/nextjs-best-practices/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/nextjs-best-practices/) (Next.js Security & App Router Patterns)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Anti-Slop Core Filter)
> - [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/) (Test-Driven Security Assurance)

---

## 1. Ringkasan & Tujuan Task

Mengaudit dan mengimplementasikan arsitektur keamanan **Pertahanan Berlapis (*Defense-in-Depth*)** untuk sistem **Role-Based Access Control (RBAC)** di seluruh rute aplikasi GORO S2JB menggunakan standar resmi **Next.js Edge Proxy Pattern (`proxy.ts`)**.

### Aturan Utama Akses Publik vs Terautentikasi:
* **Rute `/` (Beranda Komando) TIDAK BOLEH diakses oleh pengguna tanpa autentikasi (*unauthenticated user* / *guest*).** Jika pengguna belum masuk sesi, sistem wajib langsung mengalihkan (*redirect*) ke `/login`.
* Rute publik yang dapat diakses tanpa sesi **HANYA**:
  1. `/login` (Formulir Masuk; jika sudah login, dialihkan ke dasbor sesuai peran).
  2. `/unauthorized` (Halaman Peringatan 403).
  3. Aset internal Next.js & berkas statis (`/_next/*`, favicon, dsb.).
* Seluruh rute aplikasi lainnya (termasuk Beranda Komando `/`, entri lapangan `/intake`, triase `/operator/triage`, laporan `/manager/reports`, administrasi `/admin/*`, serta API ekspor dan upload) terkunci mutlak dan membutuhkan autentikasi serta otorisasi peran yang valid.

### Mengapa Menggunakan Proxy, Bukan Middleware Tradisional?
Dalam standar dan evolusi arsitektur *Next.js App Router* terkini (resmi distandardisasi pada Next.js 16 melalui konvensi file `proxy.ts` dan fungsi `proxy()`), tim inti Next.js merekomendasikan peralihan dari istilah lama *middleware* menuju **Network Edge Proxy**:
1. **Pemisahan Tanggung Jawab (*Separation of Concerns*):** Istilah *middleware* kerap disalahpahami seperti middleware Express/Node.js di mana pengembang menaruh seluruh logika otorisasi bisnis di satu tempat.
2. **Peran Sejati Edge Proxy:** Proxy bertindak di lapisan terluar batas jaringan (*network boundary*) untuk melakukan *request interception*, penulisan ulang URL (*URL rewrites*), penyuntikan header identitas (*header enrichment*), dan pengalihan dini (*early optimistic redirects* seperti pengalihan tamu dari `/` langsung ke `/login`).
3. **Pertahanan Berlapis (*Defense-in-Depth*):** Sesuai panduan keamanan resmi Next.js (*Next.js Security Architecture*), proxy **bukan** pengganti otorisasi data (*Data Access Layer / DAL*). Otorisasi mutlak wajib ditegakkan di Server Components / Server Layouts, Server Actions, tRPC Procedures, dan Route Handlers.

```
[Layer 1: Network Edge Proxy (src/proxy.ts)] -> Intersepsi batas jaringan, URL rewrites & pengalihan sesi dini (/login & /unauthorized)
          │
[Layer 2: Server Layouts & Root Guard (src/lib/server-auth.ts)] -> Verifikasi sesi mandiri sebelum render Server Component
          │
[Layer 3: HTTP Route Handlers] -> Proteksi endpoint API unduh Excel/PDF & upload berkas bukti
          │
[Layer 4: tRPC Server Procedures] -> Guard otorisasi mutasi/kueri data berbasis Prisma
          │
[Layer 5: Client UI & Navigation] -> Pemfilteran ketat menu sidebar & tombol aksi berbasis peran
```

---

## 2. Matriks Otorisasi RBAC Terpadu (*Single Source of Truth*)

Seluruh subsistem aplikasi wajib mematuhi matriks hak akses berikut yang didefinisikan secara tersentralisasi pada `src/lib/rbac.ts`:

| Rute / Modul / Endpoint | Deskripsi Akses | Hak Akses Peran yang Diizinkan | Tindakan Jika Tidak Memiliki Izin |
| :--- | :--- | :--- | :--- |
| `/` | Beranda Komando | `PETUGAS_LAPANGAN`, `PEGAWAI`, `MANAGER`, `SUPER_ADMIN` | Tamu belum login $\rightarrow$ Langsung redirect ke `/login` |
| `/login` | Formulir Masuk Sesi | Khusus `GUEST` (belum terautentikasi) | Jika sudah login, redirect ke dasbor peran terkait |
| `/unauthorized` | Halaman Peringatan 403 | Terbuka untuk seluruh peran | Memberikan info peran yang dibutuhkan |
| `/intake` | Entri Eviden Lapangan | `PETUGAS_LAPANGAN`, `SUPER_ADMIN` | Tamu $\rightarrow$ `/login`, Non-izin $\rightarrow$ `/unauthorized` |
| `/operator/triage` (`/triage`) | Dasbor Triase Ulasan Kuning | `PEGAWAI`, `SUPER_ADMIN` | Tamu $\rightarrow$ `/login`, Non-izin $\rightarrow$ `/unauthorized` |
| `/manager/reports` (`/reports`) | Laporan Eksekutif & KPI | `MANAGER`, `SUPER_ADMIN` | Tamu $\rightarrow$ `/login`, Non-izin $\rightarrow$ `/unauthorized` |
| `/admin/*` (`users`, `migration`, `audit-logs`) | Administrasi Sistem | `SUPER_ADMIN` (Eksklusif) | Tamu $\rightarrow$ `/login`, Non-izin $\rightarrow$ `/unauthorized` |
| `POST /api/upload` | Unggah Berkas Eviden/Migrasi | `PETUGAS_LAPANGAN`, `SUPER_ADMIN` | `HTTP 401 Unauthorized` / `HTTP 403 Forbidden` |
| `GET /api/export/excel` | Ekspor Spreadsheet Laporan | `MANAGER`, `SUPER_ADMIN` | `HTTP 401 Unauthorized` / `HTTP 403 Forbidden` |
| `GET /api/export/pdf` | Ekspor Dokumen Cetak Laporan | `MANAGER`, `SUPER_ADMIN` | `HTTP 401 Unauthorized` / `HTTP 403 Forbidden` |
| `GET /api/uploads/[...path]` | Penyajian Gambar Bukti Eviden | Sesi Terautentikasi (Semua Peran) | `HTTP 401 Unauthorized` (Blok scraper luar) |

---

## 3. Struktur Sub-Task Hierarkis

* **Task 10.1:** Modul Definisi Matriks RBAC Tunggal & Helper Autentikasi Server (`src/lib/rbac.ts`, `src/lib/server-auth.ts`)
* **Task 10.1:** Modul Definisi Matriks RBAC Tunggal & Helper Autentikasi Server (`src/lib/rbac.ts`, `src/lib/server-auth.ts`)
* **Task 10.2:** Implementasi Next.js Edge Proxy Terpadu (`src/proxy.ts`)
* **Task 10.3:** Penegakan Pertahanan Berlapis pada Server Layouts & Root Page Guard (`src/app/page.tsx`, `(field)`, `(operator)`, `(manager)`, `(admin)`)
* **Task 10.4:** Pengamanan Mandiri HTTP Route Handlers (`upload`, `export/excel`, `export/pdf`, `uploads`)
* **Task 10.5:** Pembersihan & Penyelarasan Navigasi Bilah Samping (`GlobalSidebar.tsx`, `MobileNavDrawer.tsx`, `page.tsx`)
* **Task 10.6:** Otomasi Pengujian Penetrasi Matriks RBAC Komprehensif (Integration & Unit Test Suite)

---

## 4. Instruksi Teknis Rinci

### 4.1 Task 10.1: Definisi Matriks RBAC Tunggal & Server Auth Helper
1. **Target File:**
   * `src/lib/rbac.ts`
   * `src/lib/server-auth.ts`
2. **Spesifikasi Teknis:**
   * Buat konstanta `ROUTE_PERMISSIONS` yang memetakan pola rute regex/awalan ke array `Role[]`:
     * Pola rute `/` dipetakan ke seluruh peran terautentikasi: `[Role.PETUGAS_LAPANGAN, Role.PEGAWAI, Role.MANAGER, Role.SUPER_ADMIN]`.
     * Tamu (`GUEST` / `null`) ditolak dari rute `/`.
   * Sediakan fungsi `isRouteAllowed(pathname: string, userRole?: Role | null): boolean`.
   * Sediakan fungsi `getRequiredRoleForRoute(pathname: string): Role | null`.
   * Buat helper server-side `requireServerAuth(allowedRoles?: Role[])` yang membaca cookie sesi via `next/headers`, memverifikasi payload JWT, dan memanggil `redirect("/login")` secara instan jika unauthenticated, atau `redirect("/unauthorized?required=...")` jika peran tidak mencukupi.

---

### 4.2 Task 10.2: Implementasi Next.js Edge Proxy Terpadu (`src/proxy.ts`)
1. **Target File:**
   * `src/proxy.ts` (Implementasi utama modern Next.js Edge Proxy)
2. **Spesifikasi Teknis:**
   * **Implementasi Utama (`src/proxy.ts`):**
     * Ekspor fungsi `export async function proxy(request: NextRequest): Promise<NextResponse>`.
     * Ekspor konstanta `export const config = { matcher: [...] }`.
     * Bertindak sebagai *boundary reverse proxy*:
       1. Mengabaikan aset statis (`/_next`, favicon, gambar).
       2. Membaca cookie sesi `goro_session` dan memverifikasi token JWT di edge.
       3. Membersihkan header internal (`x-user-*`) dari request klien untuk mencegah injeksi header (spoofing).
       4. Mengalihkan pengguna terautentikasi yang mengakses `/login` ke dasbor peran masing-masing.
       5. Mengizinkan rute terbuka HANYA `/unauthorized` dan `/login`.
       6. **Penguncian Rute `/`:** Jika pengguna belum login (tidak ada cookie atau token tidak valid) dan mengakses `/`, Edge Proxy langsung mengalihkan (*redirect 307*) ke `/login`.
       7. Untuk rute terproteksi lainnya: mengalihkan tamu ke `/login?redirect=...` dan pengguna tanpa hak akses ke `/unauthorized?required=...`.
       8. Menjalankan *declarative URL rewriting* (`REWRITE_MAP`) untuk rute operasional (`/operator/triage` $\rightarrow$ `/triage`, `/manager/reports` $\rightarrow$ `/reports`, `/admin/users` $\rightarrow$ `/users`, dll).
       9. Melakukan *header enrichment* (`x-user-role`, `x-user-id`) untuk mempercepat konsumsi downstream di Server Components.

---

### 4.3 Task 10.3: Pertahanan Berlapis pada Server Layouts & Root Page Guard
1. **Target File:**
   * `src/app/page.tsx` (Beranda Komando Server Component)
   * `src/app/(field)/layout.tsx`
   * `src/app/(operator)/layout.tsx`
   * `src/app/(manager)/layout.tsx`
   * `src/app/(admin)/layout.tsx`
2. **Spesifikasi Teknis:**
   * Sesuai prinsip *Defense-in-Depth*, Edge Proxy hanya menangani *optimistic routing*. Otorisasi hakiki wajib ditegakkan di Server Components / Data Access Layer.
   * **Di `src/app/page.tsx`:** Tambahkan pemanggilan `await requireServerAuth()` di baris paling awal komponen server. Jika tidak ada sesi aktif, langsung alihkan ke `/login`. Ini menjamin data Beranda Komando tidak dapat bocor bahkan jika request melewati proxy.
   * **Di Server Layouts:**
     * Panggil `await requireServerAuth([Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN])` di `FieldLayout`.
     * Panggil `await requireServerAuth([Role.PEGAWAI, Role.SUPER_ADMIN])` di `OperatorLayout`.
     * Panggil `await requireServerAuth([Role.MANAGER, Role.SUPER_ADMIN])` di `ManagerLayout`.
     * Panggil `await requireServerAuth([Role.SUPER_ADMIN])` di `AdminLayout`.

---

### 4.4 Task 10.4: Pengamanan Mandiri HTTP Route Handlers
1. **Target File:**
   * `src/app/api/upload/route.ts`
   * `src/app/api/export/excel/route.ts`
   * `src/app/api/export/pdf/route.ts`
   * `src/app/api/uploads/[...path]/route.ts`
2. **Spesifikasi Teknis:**
   * Ganti pengecekan header manual `x-user-id` atau cookie tidak terverifikasi dengan verifikasi token JWT resmi (`verifyToken(sessionCookie)`).
   * Tolak permintaan tanpa token dengan `NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 })`.
   * Tolak permintaan yang perannya tidak sesuai matriks dengan `NextResponse.json({ error: "Akses ditolak." }, { status: 403 })`.

---

### 4.5 Task 10.5: Penyelarasan Navigasi Antarmuka Pengguna
1. **Target File:**
   * `src/components/layout/GlobalSidebar.tsx`
   * `src/components/layout/MobileNavDrawer.tsx`
   * `src/app/page.tsx`
2. **Spesifikasi Teknis:**
   * Bersihkan `roles` pada `NAV_ITEMS`:
     * Hapus peran `"GUEST"` dari seluruh menu navigasi.
     * Karena pengguna belum login langsung dialihkan ke `/login`, tamu tidak akan pernah melihat bilah navigasi maupun beranda.
     * Pengguna terautentikasi hanya melihat menu yang perannya tercantum dalam `item.roles`.
   * Di `src/app/page.tsx`, sesuaikan kartu pintasan operasional berdasarkan peran pengguna yang sedang aktif.

---

### 4.6 Task 10.6: Suite Pengujian Penetrasi Matriks RBAC Komprehensif
1. **Target File:**
   * `tests/integration/comprehensiveRbacMatrix.test.ts`
2. **Cakupan Skenario Pengujian:**
   * **Pengujian 1 (Guest Matrix):** Menguji akses tamu ke seluruh rute (halaman `/`, `/intake`, `/operator/triage`, `/manager/reports`, `/admin/*`, API export, API upload). Memverifikasi bahwa akses tamu ke `/` dan rute internal LANGSUNG menghasilkan redirect status 307 ke `/login`, serta penolakan status 401 pada endpoint API.
   * **Pengujian 2 (Petugas Lapangan Matrix):** Memverifikasi akses sukses ke `/` dan `/intake`, serta penolakan saat mencoba membuka `/triage`, `/reports`, `/users`, atau API ekspor.
   * **Pengujian 3 (Pegawai Triase Matrix):** Memverifikasi akses sukses ke `/` dan `/operator/triage`, serta penolakan pada modul lapangan, manajerial, dan admin.
   * **Pengujian 4 (Manager Matrix):** Memverifikasi akses sukses ke `/`, `/manager/reports`, dan endpoint ekspor Excel/PDF, serta penolakan pada modul admin dan entri lapangan.
   * **Pengujian 5 (Super Admin Matrix):** Memverifikasi akses penuh tanpa hambatan ke seluruh rute sistem.
   * **Pengujian 6 (Edge Proxy & Server Layout Guard):** Memverifikasi fungsi `proxy()` dan Server Component layout menghentikan rendering jika cookie sesi tidak valid.

---

## 5. Kriteria Keberhasilan & Verifikasi Penerimaan

* [x] Rute `/` (Beranda Komando) terkunci mutlak dari akses publik: seluruh pengguna yang belum terautentikasi langsung dialihkan ke `/login`.
* [x] Modul `src/lib/rbac.ts` dan `src/lib/server-auth.ts` terimplementasi sebagai sumber kebenaran tunggal (*Single Source of Truth*).
* [x] Edge Proxy modern terimplementasi di `src/proxy.ts` secara mandiri tanpa ketergantungan pada `src/middleware.ts`.
* [x] Seluruh Server Layouts (`(field)`, `(operator)`, `(manager)`, `(admin)`) dan `src/app/page.tsx` menerapkan pertahanan berlapis dengan verifikasi sesi mandiri.
* [x] Seluruh Route Handlers (`upload`, `export/excel`, `export/pdf`, `uploads`) terkunci mutlak dengan verifikasi JWT dan penolakan 401/403.
* [x] Bilah samping navigasi (`GlobalSidebar`) bersih tanpa kebocoran tautan modul terlarang pada mode tamu atau antar-peran.
* [x] Seluruh skenario pengujian penetrasi matriks RBAC lulus 100% tanpa regresi.
