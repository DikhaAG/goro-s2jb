# Task 12: Pengujian Penetrasi & Verifikasi Menyeluruh Matriks RBAC Multi-Layer pada Seluruh Rute Sistem

> **Status:** Completed ✅  
> **Fase:** 3 (Jaminan Mutu Keamanan, Verifikasi Pertahanan Berlapis & Otomasi Pengujian E2E)  
> **Target Audiens:** Security Engineer, QA Automation Engineer, Full-Stack Lead, Backend Architect  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 4: Arsitektur Modul, Bagian 5: Keamanan & Hak Akses RBAC)
> - [`docs/tasks/task_10.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_10.md) (Arsitektur Pertahanan Berlapis 5-Layer Defense-in-Depth)
> - [`src/lib/rbac.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/rbac.ts) (Single Source of Truth Matriks RBAC)
> - [`src/proxy.ts`](file:///Users/a69/Desktop/goro-s2jb/src/proxy.ts) (Layer 1: Edge Network Proxy)
> - [`src/lib/server-auth.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/server-auth.ts) (Layer 2: Server Layouts Guard)
> - [`.agents/skills/tdd/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/SKILL.md)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md)

---

## 1. Ringkasan & Tujuan Task

Membangun dan mengeksekusi **Rangkaian Pengujian Penetrasi Matriks RBAC Komprehensif** untuk menguji ketahanan setiap rute aplikasi kanonikal yang ada pada `src/app` (halaman frontend, HTTP Route Handlers, dan prosedur tRPC backend). 

Pengujian ini memastikan tidak ada celah keamanan (*privilege escalation*), kebocoran data antar-wilayah, atau kegagalan isolasi peran di seluruh 5 lapisan pertahanan:
1. **Layer 1 (Network Edge Proxy - `src/proxy.ts`):** Menguji intersepsi perimeter, redirect instan bagi tamu unauthenticated dari rute `/` dan seluruh rute terproteksi, serta redirect pasca-login berdasarkan peran.
2. **Layer 2 (Server Component Layout Guards - `src/lib/server-auth.ts`):** Menguji verifikasi sesi di tingkat layout React Server Components (`(field)`, `(operator)`, `(manager)`, `(admin)`) guna memastikan perlindungan tetap aktif bahkan jika proxy di-bypass.
3. **Layer 3 (HTTP Route Handlers - `/api/*`):** Menguji proteksi mandiri endpoint upload gambar, pengunduhan file evidensi (`/api/uploads/*`), dan ekspor data (`/api/export/excel`, `/api/export/pdf`).
4. **Layer 4 (tRPC Procedure Guards - `src/server/trpc.ts`):** Menguji prosedur tRPC (`fieldProcedure`, `operatorProcedure`, `executiveProcedure`, `adminProcedure`) agar menolak pemanggilan tanpa izin dengan status `UNAUTHORIZED` (401) atau `FORBIDDEN` (403).
5. **Layer 5 (Client Navigation & App Shell - `GlobalSidebar.tsx`, `HomePageClient.tsx`):** Menguji bahwa item navigasi dan tautan modul yang tampil secara eksklusif hanya sesuai dengan peran pengguna aktif.

---

## 2. Matriks Uji Kanonikal: 5 Peran vs Seluruh Rute Aplikasi

Matriks berikut menguraikan ekspektasi perilaku sistem untuk setiap kombinasi peran dan rute kanonikal (Total: 5 peran $\times$ 16 target rute/endpoint kanonikal = 80 titik uji penetrasi):

| No | Target Rute / Endpoint | Tamu (`GUEST`) | Petugas Lapangan (`PETUGAS_LAPANGAN`) | Pegawai Triase (`PEGAWAI`) | Manager UID (`MANAGER`) | Super Admin (`SUPER_ADMIN`) |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **A** | **Halaman Antarmuka (Pages)** | | | | | |
| 1 | `/` (Beranda Komando) | 307 $\rightarrow$ `/login` | 200 OK | 200 OK | 200 OK | 200 OK |
| 2 | `/login` (Autentikasi Publik) | 200 OK | 307 $\rightarrow$ `/intake` | 307 $\rightarrow$ `/triage` | 307 $\rightarrow$ `/reports` | 307 $\rightarrow$ `/users` |
| 3 | `/unauthorized` (Halaman 403) | 200 OK | 200 OK | 200 OK | 200 OK | 200 OK |
| 4 | `/intake` (Entri Eviden) | 307 $\rightarrow$ `/login` | 200 OK | 307 $\rightarrow$ 403 | 307 $\rightarrow$ 403 | 200 OK |
| 5 | `/triage` (Dasbor Triase) | 307 $\rightarrow$ `/login` | 307 $\rightarrow$ 403 | 200 OK | 307 $\rightarrow$ 403 | 200 OK |
| 6 | `/reports` (Laporan Eksekutif) | 307 $\rightarrow$ `/login` | 307 $\rightarrow$ 403 | 307 $\rightarrow$ 403 | 200 OK | 200 OK |
| 7 | `/users` (Manajemen Pengguna) | 307 $\rightarrow$ `/login` | 307 $\rightarrow$ 403 | 307 $\rightarrow$ 403 | 307 $\rightarrow$ 403 | 200 OK |
| 8 | `/migration` (Migrasi Data) | 307 $\rightarrow$ `/login` | 307 $\rightarrow$ 403 | 307 $\rightarrow$ 403 | 307 $\rightarrow$ 403 | 200 OK |
| 9 | `/audit-logs` (Audit Trail) | 307 $\rightarrow$ `/login` | 307 $\rightarrow$ 403 | 307 $\rightarrow$ 403 | 307 $\rightarrow$ 403 | 200 OK |
| **B** | **HTTP Route Handlers (/api/*)** | | | | | |
| 10 | `POST /api/upload` | 401 Unauthorized | 200 / 400 (Allowed) | 403 Forbidden | 403 Forbidden | 200 / 400 (Allowed) |
| 11 | `GET /api/uploads/[...path]` | 401 Unauthorized | 200 OK (Served) | 200 OK (Served) | 200 OK (Served) | 200 OK (Served) |
| 12 | `GET /api/export/excel` | 401 Unauthorized | 403 Forbidden | 403 Forbidden | 200 OK (Spreadsheet) | 200 OK (Spreadsheet) |
| 13 | `GET /api/export/pdf` | 401 Unauthorized | 403 Forbidden | 403 Forbidden | 200 OK (PDF Stream) | 200 OK (PDF Stream) |
| 14 | `GET /api/health` | 200 OK (Public) | 200 OK | 200 OK | 200 OK | 200 OK |
| 15 | `POST /api/auth/login` | Rate-limited auth | Rate-limited auth | Rate-limited auth | Rate-limited auth | Rate-limited auth |
| 16 | `POST /api/auth/logout` | 200 OK (Session cleared) | 200 OK (Session cleared) | 200 OK (Session cleared) | 200 OK (Session cleared) | 200 OK (Session cleared) |

---

## 3. Struktur Sub-Task Hierarkis

* **Task 12.1:** Otomasi Pengujian Penetrasi Rute Halaman pada Edge Proxy (`tests/integration/routeProxyPenetration.test.ts`)
* **Task 12.2:** Pengujian Keamanan Mandiri HTTP Route Handlers (`tests/integration/routeHandlersSecurity.test.ts`)
* **Task 12.3:** Pengujian Isolasi Server Component Layouts (`tests/integration/serverLayoutGuards.test.ts`)
* **Task 12.4:** Verifikasi Matriks RBAC pada tRPC Backend Router (`tests/integration/trpcRbacFullMatrix.test.ts`)
* **Task 12.5:** Verifikasi Visual & Filter Navigasi UI Bebas Kebocoran (`tests/unit/navigationRbacFilter.test.ts`)
* **Task 12.6:** Integrasi CI Pipeline & Laporan Penetrasi Otomatis (`scripts/verify-rbac-matrix.sh`)

---

## 4. Instruksi Teknis Rinci

### 4.1 Task 12.1: Otomasi Pengujian Penetrasi Rute Halaman pada Edge Proxy
1. **Target File:**
   * `tests/integration/routeProxyPenetration.test.ts`
2. **Spesifikasi Pengujian:**
   * Buat helper pembuatan mock request dengan header cookie sesi untuk masing-masing peran:
     - `GUEST` (tanpa cookie).
     - `PETUGAS_LAPANGAN` (`petugas_rivai`).
     - `PEGAWAI` (`pegawai_operator`).
     - `MANAGER` (`manager_s2jb`).
     - `SUPER_ADMIN` (`superadmin`).
   * **Pengujian 1 (Perlindungan Rute `/`):**
     - Tamu tanpa sesi mengakses `/` wajib mendapatkan status `307` mengarah ke `http://localhost:3000/login` tanpa parameter redirect.
     - Setiap pengguna terautentikasi mengakses `/` wajib mendapatkan status `200` dan header `x-user-role` terinjeksi.
   * **Pengujian 2 (Pengalihan Halaman Login `/login`):**
     - Pengguna yang sudah login mengakses `/login` wajib dialihkan langsung ke rute kanonikal perannya:
       - Petugas Lapangan $\rightarrow$ `/intake`
       - Pegawai Triase $\rightarrow$ `/triage`
       - Manager UID $\rightarrow$ `/reports`
       - Super Admin $\rightarrow$ `/users`
   * **Pengujian 3 (Matriks Penolakan & Pengalihan Unauthorized):**
     - Saat peran mencoba mengakses modul terlarang, proxy harus mengalihkan ke `/unauthorized?required=<ROLE>` dengan status 307.
   * **Pengujian 4 (Akses Penuh Super Admin):**
     - Memverifikasi bahwa Super Admin dapat membuka seluruh rute (`/`, `/intake`, `/triage`, `/reports`, `/users`, `/migration`, `/audit-logs`) dengan status 200.

---

### 4.2 Task 12.2: Pengujian Keamanan Mandiri HTTP Route Handlers
1. **Target File:**
   * `tests/integration/routeHandlersSecurity.test.ts`
2. **Spesifikasi Pengujian:**
   * Menguji pemanggilan langsung HTTP handlers tanpa bergantung pada proxy (Layer 3 Defense-in-Depth):
     * **`POST /api/upload`:**
       - Tamu $\rightarrow$ `401 Unauthorized`.
       - Pegawai Triase & Manager $\rightarrow$ `403 Forbidden`.
       - Petugas Lapangan & Super Admin $\rightarrow$ Lolos autentikasi (mengembalikan 400 Bad Request jika form kosong, bukan 401/403).
     * **`GET /api/uploads/[...path]`:**
       - Tamu $\rightarrow$ `401 Unauthorized`.
       - Seluruh pengguna terautentikasi $\rightarrow$ Lolos guard autentikasi (mengembalikan file atau 404 jika file tidak ditemukan).
     * **`GET /api/export/excel`:**
       - Tamu $\rightarrow$ `401 Unauthorized`.
       - Petugas Lapangan & Pegawai Triase $\rightarrow$ `403 Forbidden`.
       - Manager & Super Admin $\rightarrow$ `200 OK` dengan header `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
     * **`GET /api/export/pdf`:**
       - Tamu $\rightarrow$ `401 Unauthorized`.
       - Petugas Lapangan & Pegawai Triase $\rightarrow$ `403 Forbidden`.
       - Manager & Super Admin $\rightarrow$ `200 OK` dengan header `application/pdf`.

---

### 4.3 Task 12.3: Pengujian Isolasi Server Component Layouts
1. **Target File:**
   * `tests/integration/serverLayoutGuards.test.ts`
2. **Spesifikasi Pengujian:**
   * Menstimulasikan eksekusi Server Layouts dengan mock `next/headers` cookies:
     - `src/app/(field)/layout.tsx` $\rightarrow$ memanggil `requireServerAuth([Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN])`.
     - `src/app/(operator)/layout.tsx` $\rightarrow$ memanggil `requireServerAuth([Role.PEGAWAI, Role.SUPER_ADMIN])`.
     - `src/app/(manager)/layout.tsx` $\rightarrow$ memanggil `requireServerAuth([Role.MANAGER, Role.SUPER_ADMIN])`.
     - `src/app/(admin)/layout.tsx` $\rightarrow$ memanggil `requireServerAuth([Role.SUPER_ADMIN])`.
   * Verifikasi pemanggilan `redirect("/login")` saat sesi kosong dan `redirect("/unauthorized?required=...")` saat peran tidak cocok.

---

### 4.4 Task 12.4: Verifikasi Matriks RBAC pada tRPC Backend Router
1. **Target File:**
   * `tests/integration/trpcRbacFullMatrix.test.ts`
2. **Spesifikasi Pengujian:**
   * Menjalankan caller tRPC untuk setiap domain prosedur menggunakan context mock:
     - Prosedur Lapangan (`intake.submit`, `intake.getMyHistory`): menolak Pegawai dan Manager dengan error code `FORBIDDEN`.
     - Prosedur Triase (`triage.getPending`, `triage.verify`): menolak Petugas Lapangan dan Manager dengan error code `FORBIDDEN`.
     - Prosedur Manajerial (`report.getSummary`, `report.getDetailedGrid`): menolak Petugas Lapangan dan Pegawai dengan error code `FORBIDDEN`.
     - Prosedur Administratif (`user.listUsers`, `user.createUser`, `migration.getBatches`, `auditLog.getAuditLogs`): menolak Petugas, Pegawai, dan Manager dengan error code `FORBIDDEN`.
     - Super Admin: Berhasil memanggil seluruh prosedur tanpa pengecualian.

---

### 4.5 Task 12.5: Verifikasi Visual & Filter Navigasi UI Bebas Kebocoran
1. **Target File:**
   * `tests/unit/navigationRbacFilter.test.ts`
2. **Spesifikasi Pengujian:**
   * Menguji fungsi filter navigasi pada `GlobalSidebar.tsx`:
     - Tamu: Menu navigasi tidak dirender sama sekali.
     - Petugas Lapangan: Hanya melihat `["/", "/intake"]`.
     - Pegawai Triase: Hanya melihat `["/", "/triage"]`.
     - Manager UID: Hanya melihat `["/", "/reports"]`.
     - Super Admin: Melihat seluruh 7 item menu (`["/", "/intake", "/triage", "/reports", "/users", "/migration", "/audit-logs"]`).
   * Memastikan tidak ada URL yang bocor ke DOM untuk pengguna yang tidak memiliki hak akses.

---

### 4.6 Task 12.6: Integrasi CI Pipeline & Laporan Penetrasi Otomatis
1. **Target File:**
   * `scripts/verify-rbac-matrix.sh`
   * `package.json` (tambahkan script `npm run test:rbac`)
2. **Spesifikasi Teknis:**
   * Bangun skrip verifikasi otomatis yang menjalankan seluruh test suite RBAC:
     ```bash
     #!/usr/bin/env bash
     set -e
     echo "🔒 Menjalankan Verifikasi Matriks Penetrasi RBAC Penuh..."
     npx vitest run tests/integration/routeProxyPenetration.test.ts \
                    tests/integration/routeHandlersSecurity.test.ts \
                    tests/integration/serverLayoutGuards.test.ts \
                    tests/integration/trpcRbacFullMatrix.test.ts \
                    tests/unit/navigationRbacFilter.test.ts
     echo "✅ Seluruh 80 Titik Uji Penetrasi RBAC Kanonikal Lulus 100%!"
     ```
   * Daftarkan perintah ke `package.json`: `"test:rbac": "bash scripts/verify-rbac-matrix.sh"`.

---

## 5. Rencana Eksekusi Bertahap

```
Langkah 1: Setup Test Fixtures & Utilities
├── Buat mock auth token generator untuk seluruh 5 peran (GUEST, FIELD, OPERATOR, MANAGER, ADMIN)
└── Setup helper mock request NextRequest dengan header cookie & sanitasi

Langkah 2: Implementasi Pengujian Edge Proxy (Layer 1)
├── Buat tests/integration/routeProxyPenetration.test.ts
└── Jalankan verifikasi 307 redirect dan 200 pass-through pada rute kanonikal

Langkah 3: Implementasi Pengujian HTTP Route Handlers (Layer 3)
├── Buat tests/integration/routeHandlersSecurity.test.ts
└── Jalankan verifikasi 401 unauthorized & 403 forbidden pada upload, uploads, excel, pdf

Langkah 4: Implementasi Pengujian Server Layouts & tRPC (Layer 2 & 4)
├── Buat tests/integration/serverLayoutGuards.test.ts
├── Buat tests/integration/trpcRbacFullMatrix.test.ts
└── Jalankan verifikasi penolakan tRPC procedures dan layout redirect

Langkah 5: Implementasi Pengujian Navigasi UI (Layer 5)
├── Buat tests/unit/navigationRbacFilter.test.ts
└── Jalankan verifikasi kebersihan DOM navigasi bilah samping

Langkah 6: Registrasi Skrip & Verifikasi Penuh
├── Buat scripts/verify-rbac-matrix.sh & daftarkan "test:rbac" di package.json
├── Jalankan npm run typecheck
└── Jalankan npm run test:rbac untuk konfirmasi 100% kelulusan
```

---

## 6. Kriteria Keberhasilan & Verifikasi Penerimaan

* [x] Seluruh 80 titik uji penetrasi (5 peran $\times$ 16 target rute/endpoint kanonikal) teruji otomatis dalam suite pengujian.
* [x] Rute `/` terverifikasi 100% terkunci dari akses publik (tamu unauthenticated dialihkan ke `/login`).
* [x] Rute `/login` terverifikasi mengalihkan pengguna yang sudah terautentikasi ke dasbor kanonikal perannya (`/intake`, `/triage`, `/reports`, `/users`).
* [x] Seluruh rute kanonikal (`/intake`, `/triage`, `/reports`, `/users`, `/migration`, `/audit-logs`) terverifikasi terlindungi sesuai matriks RBAC.
* [x] Seluruh HTTP Route Handlers (`upload`, `uploads`, `export/excel`, `export/pdf`) menolak akses tidak berizin dengan status HTTP 401 atau 403 yang tepat.
* [x] Seluruh prosedur tRPC menolak pemanggilan peran yang tidak berwenang dengan error code `FORBIDDEN`.
* [x] Bilah samping navigasi (`GlobalSidebar`) bersih tanpa kebocoran tautan modul terlarang pada mode tamu atau antar-peran.
* [x] Perintah `npm run test:rbac` berhasil dieksekusi dengan tingkat kelulusan 100% tanpa regresi.
