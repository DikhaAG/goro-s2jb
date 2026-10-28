# Task 6: Sistem Keamanan, Autentikasi & Otorisasi RBAC Terpadu

> **Status:** Draft / Ready for Engineering Execution  
> **Fase:** 2 (Lapisan Keamanan & Tata Kelola Pengguna - Modul 5 PRD)  
> **Target Audiens:** Security Engineer, Backend Engineer, Full-Stack Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 5: Keamanan & Hak Akses / RBAC, Bagian 1.1: Alur Kerja Multi-Peran)
> - [`docs/GORO S2JB 2026 (Jawaban).xlsx`](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx) (Struktur Organisasi Unit UP3 & ULP Penugasan)
> - [`.agents/skills/frontend-design/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-design/)
> - [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/)

---

## 1. Ringkasan & Tujuan Task

Membangun fondasi keamanan, autentikasi identitas, dan matriks otorisasi berbasis peran (**Role-Based Access Control / RBAC**) yang membatasi hak akses secara ketat berdasarkan spesifikasi **PRD Bagian 5**.

Sistem GORO beroperasi dengan memisahkan 3 entitas pengguna operasional nyata:
1. **PETUGAS LAPANGAN:** Dibatasi secara mutlak hanya pada formulir entri data ulasan & unggah foto eviden (`/intake`). Tidak memiliki izin membuka antrean triase maupun modul pelaporan.
2. **PEGAWAI (Operator / Verifikator):** Diberikan hak akses ke dasbor triase Zona Kuning (`/operator/triage`) untuk melakukan verifikasi bukti yang ditahan AI, tanpa hak akses ke modul laporan eksekutif.
3. **MANAGER (Komandan / Eksekutif):** Diberikan hak akses eksklusif ke pusat agregasi laporan performa (`/manager/reports`), pemantauan tren, dan ekspor resmi tanpa terdistraksi oleh proses validasi data mentah.
4. **SUPER_ADMIN:** Administrator sistem untuk tata kelola akun pengguna, master data unit, dan audit keamanan.

Selain proteksi hak akses, modul ini mengimplementasikan mekanisme pertahanan keamanan infrastruktur: *rate-limiting* berbasis Redis untuk mencegah *brute-force* dan *spamming*, enkripsi password menggunakan *Argon2/Bcrypt*, pengamanan sesi via *HTTP-only SameSite cookies*, dan pencatatan jejak audit (*Audit Trail*).

---

## 2. Struktur Sub-Task Hierarkis

* **Task 6.1:** Mesin Autentikasi Sesi & Antarmuka Login Terpadu (`/login`)
* **Task 6.2:** Middleware Proteksi Rute (Next.js Middleware & tRPC RBAC Guards)
* **Task 6.3:** Modul Manajemen Pengguna & Penugasan Wilayah Kerja (`/admin/users`)
* **Task 6.4:** Pengamanan Infrastruktur (Rate Limiting Redis, Brute-Force Shield, dan Audit Logging)

---

## 3. Instruksi Teknis Rinci

### 3.1 Task 6.1: Mesin Autentikasi Sesi & Antarmuka Login Terpadu
1. **Target File:**
   * `src/app/(auth)/login/page.tsx`
   * `src/lib/auth.ts`
   * `src/server/routers/auth.ts`
2. **Mekanisme Penyimpanan Sesi (Session Architecture):**
   * Gunakan sesi terenkripsi berbasis JWT / Session Token yang disimpan di dalam cookie peramban dengan atribut ketat:
     - `httpOnly: true` (mencegah pencurian token via serangan XSS).
     - `secure: true` pada environment produksi.
     - `sameSite: "lax"` (mencegah serangan CSRF).
     - Durasi masa aktif (*maxAge*): 7 hari untuk petugas lapangan, 24 jam untuk pegawai dan manajer.
3. **Antarmuka Login Taktis (Mengacu `.agents/skills/frontend-design/`):**
   * Desain visual korporat PLN Mobile Command Center: logo PLN, tema latar belakang deep slate, form terpusat dengan tipografi bersih.
   * Input identitas:
     - Username / NIP / Email.
     - Password (dengan toggle tampil/sembunyi password).
   * Alur Pasca-Login Reaktif:
     - Pengguna yang berhasil login secara otomatis dialihkan (*redirect*) ke antarmuka utama sesuai perannya:
       - Role `PETUGAS_LAPANGAN` $\rightarrow$ langsung ke `/intake`.
       - Role `PEGAWAI` $\rightarrow$ langsung ke `/operator/triage`.
       - Role `MANAGER` $\rightarrow$ langsung ke `/manager/reports`.
       - Role `SUPER_ADMIN` $\rightarrow$ ke `/admin/users` atau dasbor overview.

---

### 3.2 Task 6.2: Middleware Proteksi Rute & tRPC Procedure Guards
1. **Target File:**
   * `src/middleware.ts`
   * `src/server/trpc.ts`
2. **Next.js Edge Middleware (`src/middleware.ts`):**
   * Mencegat seluruh request peramban sebelum halaman di-render:
     ```typescript
     // Aturan Matriks Rute:
     if (pathname.startsWith('/intake') && role !== 'PETUGAS_LAPANGAN' && role !== 'SUPER_ADMIN') {
       return NextResponse.redirect(new URL('/unauthorized', req.url));
     }
     if (pathname.startsWith('/operator') && role !== 'PEGAWAI' && role !== 'SUPER_ADMIN') {
       return NextResponse.redirect(new URL('/unauthorized', req.url));
     }
     if (pathname.startsWith('/manager') && role !== 'MANAGER' && role !== 'SUPER_ADMIN') {
       return NextResponse.redirect(new URL('/unauthorized', req.url));
     }
     if (pathname.startsWith('/admin') && role !== 'SUPER_ADMIN') {
       return NextResponse.redirect(new URL('/unauthorized', req.url));
     }
     ```
3. **Lapisan Keamanan tRPC (Backend Procedures Guard):**
   * Pada `src/server/trpc.ts`, bangun middleware prosedur berjenjang:
     - `publicProcedure`: Dapat diakses tanpa login (misal: `health.ping`, `auth.login`).
     - `protectedProcedure`: Memastikan session valid dan menyuntikkan data user aktif ke context.
     - `fieldProcedure`: Memverifikasi `ctx.user.role === 'PETUGAS_LAPANGAN' || 'SUPER_ADMIN'`.
     - `operatorProcedure`: Memverifikasi `ctx.user.role === 'PEGAWAI' || 'SUPER_ADMIN'`.
     - `executiveProcedure`: Memverifikasi `ctx.user.role === 'MANAGER' || 'SUPER_ADMIN'`.
     - `adminProcedure`: Memverifikasi `ctx.user.role === 'SUPER_ADMIN'`.
   * Prosedur yang melanggar aturan akan melempar `TRPCError({ code: 'FORBIDDEN', message: 'Akses ditolak.' })`.

---

### 3.3 Task 6.3: Modul Manajemen Pengguna & Penugasan Wilayah Kerja
1. **Target File:**
   * `src/app/(admin)/users/page.tsx`
   * `src/components/admin/UserManagementTable.tsx`
   * `src/components/admin/UserFormDialog.tsx`
   * `src/server/routers/user.ts`
2. **Fitur Tata Kelola Akun:**
   * Tambah, perbarui, dan nonaktifkan (*deactivate*) akun pengguna.
   * Penugasan Unit Kerja:
     - Setiap akun Petugas Lapangan wajib ditautkan ke UP3 dan ULP penugasan spesifik agar input ulasan otomatis terasosiasi dengan unit asalnya.
     - Akun Pegawai dapat ditautkan ke UP3 tertentu atau tingkat Wilayah (S2JB).
     - Akun Manager memiliki cakupan pemantauan seluruh unit kerja se-UID S2JB.
   * Tombol `Reset Password`: menghasilkan password sementara yang mewajibkan pengguna mengganti password saat login berikutnya.

---

### 3.4 Task 6.4: Pengamanan Infrastruktur (Rate Limiting & Audit Logging)
1. **Target File:**
   * `src/lib/rateLimit.ts`
   * `src/server/services/auditService.ts`
   * `prisma/schema.prisma` (Model `AuditLog`)
2. **Rate Limiting Berbasis Redis (Token Bucket Algorithm):**
   * **Endpoint Login:** Maksimal 5 kali kegagalan login per 15 menit per alamat IP. Jika terlampaui, kunci akses sementara (*temporary lockout*) dan berikan notifikasi peringatan.
   * **Endpoint Upload Eviden:** Maksimal 60 pengiriman berkas per menit per ID petugas lapangan untuk mencegah skrip bot pengunggah berkas sampah (*file flooding*).
3. **Pencatatan Jejak Audit (Audit Logging):**
   * Buat tabel `AuditLog` di PostgreSQL via Prisma:
     - `id`: CUID Primary Key
     - `userId`: Relasi ke User
     - `action`: String (misal: `"AUTH_LOGIN"`, `"TRIAGE_APPROVE"`, `"TRIAGE_REJECT"`, `"REPORT_EXPORT_EXCEL"`, `"USER_CREATE"`)
     - `entityType`: String (misal: `"RatingReview"`, `"User"`, `"Report"`)
     - `entityId`: String? (ID record yang dipengaruhi)
     - `ipAddress`: String?
     - `userAgent`: String?
     - `metadata`: JSON? (Detail alasan reject, parameter filter ekspor, dll.)
     - `createdAt`: DateTime (default: `now()`)

---

## 4. Kriteria Penerimaan (Acceptance Criteria)

- [ ] **AC-1 (Secure Authentication):** Pengguna dapat login menggunakan kredensial yang sah, password diverifikasi menggunakan hashing satu arah (Bcrypt/Argon2), dan sesi tersimpan di cookie HTTP-only yang aman.
- [ ] **AC-2 (Role-Based Redirection):** Setelah login sukses, sistem secara otonom mengarahkan pengguna ke dasbor spesifik peran masing-masing (Lapangan $\rightarrow$ `/intake`, Pegawai $\rightarrow$ `/operator/triage`, Manager $\rightarrow$ `/manager/reports`).
- [ ] **AC-3 (Impenetrable Route Middleware):** Upaya mengakses URL rute di luar wewenang peran (misal: petugas lapangan mencoba membuka `/manager/reports` atau `/operator/triage`) langsung diblokir oleh Next.js Middleware dan dialihkan dengan notifikasi penolakan.
- [ ] **AC-4 (Backend Procedure Shielding):** Upaya pemanggilan mutasi atau query tRPC tanpa role yang berhak secara konsisten menghasilkan respon error `FORBIDDEN` (HTTP 403).
- [ ] **AC-5 (User Management CRUD):** Administrator dapat membuat akun pengguna baru, menentukan peran RBAC, serta mengaitkan petugas lapangan ke UP3 dan ULP penugasan.
- [ ] **AC-6 (Anti Brute-Force Rate Limiting):** Percobaan login dengan password salah sebanyak 5 kali berturut-turut memicu penguncian akun sementara selama 15 menit via Redis rate limiter.
- [ ] **AC-7 (Tamper-Proof Audit Logging):** Setiap peristiwa krusial (login, verifikasi ulasan, ekspor laporan, pembuatan akun) tercatat secara persisten ke tabel `AuditLog` dengan metadata IP dan timestamp.

---

## 5. Matriks Berkas yang Dibuat / Diubah

| Jalur Berkas | Aksi | Deskripsi Perubahan |
| :--- | :--- | :--- |
| `src/app/(auth)/login/page.tsx` | Dibuat | Halaman antarmuka login taktis korporat PLN |
| `src/app/(auth)/unauthorized/page.tsx`| Dibuat | Halaman peringatan akses ditolak jika melanggar RBAC |
| `src/components/auth/LoginForm.tsx` | Dibuat | Komponen formulir login dengan validasi Zod dan feedback error |
| `src/lib/auth.ts` | Dibuat | Utilitas hashing password, sign JWT, dan enkripsi cookie sesi |
| `src/lib/rateLimit.ts` | Dibuat | Implementasi Redis rate limiter (Token Bucket) |
| `src/middleware.ts` | Dibuat | Next.js Edge Middleware untuk inspeksi sesi dan proteksi rute RBAC |
| `src/server/routers/auth.ts` | Dibuat | Prosedur tRPC untuk login, logout, dan query status sesi |
| `src/server/routers/user.ts` | Dibuat | Prosedur tRPC untuk tata kelola akun pengguna oleh admin |
| `src/server/services/auditService.ts`| Dibuat | Layanan pencatatan jejak audit sistem ke basis data |
| `src/app/(admin)/users/page.tsx` | Dibuat | Halaman dasbor manajemen pengguna untuk Super Admin |
| `src/components/admin/UserManagementTable.tsx`| Dibuat | Tabel daftar pengguna dengan filter peran dan status aktif |
| `prisma/schema.prisma` | Diubah | Penambahan model `AuditLog` dan relasi ke `User` |
| `src/server/routers/_app.ts` | Diubah | Pendaftaran sub-router `auth` dan `user` ke AppRouter |
| `tests/unit/authPassword.test.ts` | Dibuat | Pengujian unit ketahanan hashing dan verifikasi password |
| `tests/integration/rbacMiddleware.test.ts`| Dibuat | Pengujian integrasi pemblokiran rute terproteksi lintas 3 peran |
| `tests/integration/rateLimiter.test.ts`| Dibuat | Pengujian pemblokiran rate limit pada percobaan brute force |

---

## 6. Titik Uji & Pengujian (TDD Seams)

1. **Password Hashing Seam:** Uji fungsi `hashPassword` dan `verifyPassword` untuk memastikan salt acak bekerja, dan password identik menghasilkan hash yang berbeda namun tetap dapat diverifikasi.
2. **RBAC Middleware Seam:** Simulasikan HTTP request ke rute `/operator/triage` dan `/manager/reports` dengan header cookie dari masing-masing role (`PETUGAS_LAPANGAN`, `PEGAWAI`, `MANAGER`), pastikan respon redirect / 403 terjadi tepat sasaran.
3. **tRPC Procedure Guard Seam:** Uji pemanggilan prosedur `trpc.report.getDailyReport` menggunakan konteks pengguna dengan role `PEGAWAI` dan pastikan memicu `TRPCError` dengan kode `FORBIDDEN`.
4. **Rate Limiting Seam:** Kirim 6 request beruntun ke fungsi validasi login dengan IP simulasi yang sama, verifikasi bahwa request ke-6 ditolak dengan status rate limit exceeded.
