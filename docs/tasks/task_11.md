# Task 11: Migrasi & Implementasi Better Auth dengan Prisma Adapter, Redis Secondary Storage, dan Username Plugin

> **Status:** Drafted / Ready for Execution 📋  
> **Fase:** 3 (Arsitektur Autentikasi Modern, Manajemen Sesi Terdistribusi & Keamanan Kredensial)  
> **Target Audiens:** Lead Architect, Security Engineer, Backend Lead, Full-Stack Engineer, QA Automation Engineer  
> **Referensi Wajib:**
> - [`.agents/skills/better-auth-best-practices/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/better-auth-best-practices/SKILL.md) (Konfigurasi Core, Adapter, Session, Secondary Storage & Plugin)
> - [`.agents/skills/email-and-password-best-practices/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/email-and-password-best-practices/SKILL.md) (Password Hashing, Security Policies & Session Invalidation)
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 5: Keamanan, Autentikasi & Masa Berlaku Sesi Berjenjang)
> - [`docs/tasks/task_10.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_10.md) (Arsitektur Pertahanan Berlapis 5-Layer Defense-in-Depth & Edge Proxy)
> - [`.agents/skills/nextjs-best-practices/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/nextjs-best-practices/)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md)
> - [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/)

---

## 1. Ringkasan & Tujuan Task

Mengganti sistem autentikasi custom JWT manual berbasis `jose` dengan **Better Auth** (`better-auth`) sebagai fondasi autentikasi standar industri modern pada aplikasi GORO S2JB. 

Sistem ini dirancang untuk mempertahankan seluruh aturan bisnis operasional PLN yang telah berjalan tanpa *breaking changes*:
1. **Autentikasi Berbasis Username:** Mengintegrasikan `@better-auth/plugins/username` agar pengguna operasional tetap dapat masuk menggunakan kredensial `username` (misalnya: `petugas_rivai`, `pegawai_operator`, `manager_s2jb`, `superadmin`).
2. **Kesesuaian Skema Database Eksisting (Prisma 7):** Memperluas skema Prisma untuk menambahkan tabel standar Better Auth (`Session`, `Account`, `Verification`) sekaligus menjaga seluruh relasi bisnis tabel `User` (`up3Id`, `ulpId`, `role`, `RatingReview`, `AuditLog`, `MigrationBatch`).
3. **Dukungan Hashing Hybrid (Seamless Credential Migration):** Mengimplementasikan custom password verifier pada konfigurasi Better Auth agar password terenkripsi yang sudah ada di database (baik bcrypt maupun legacy SHA-256) tetap dapat diverifikasi secara instan tanpa memaksa pengguna melakukan reset sandi.
4. **Penyimpanan Sesi Kinerja Tinggi (Redis Secondary Storage):** Memanfaatkan koneksi Redis eksisting (`src/lib/redis.ts`) sebagai `secondaryStorage` Better Auth untuk lookup sesi super-cepat (<2ms) dan perlindungan terhadap *database query storm*.
5. **Masa Berlaku Sesi Berjenjang Sesuai PRD:**
   * **Petugas Lapangan:** 7 hari (604.800 detik) untuk kemudahan operasional mobile di lapangan.
   * **Pegawai, Manajer, Super Admin:** 24 jam (86.400 detik) untuk proteksi keamanan eksekutif dan administratif.
6. **Harmonisasi Penuh dengan Arsitektur Pertahanan Berlapis (Task 10):**
   * Mengintegrasikan sesi Better Auth ke dalam **Layer 1: Edge Proxy (`src/proxy.ts`)**, **Layer 2: Server Layouts (`src/lib/server-auth.ts`)**, **Layer 3: HTTP Route Handlers (`/api/upload`, `/api/export/*`)**, **Layer 4: tRPC Context (`src/server/context.ts`)**, dan **Layer 5: Client UI**.

---

## 2. Arsitektur Integrasi Better Auth (5-Layer Defense-in-Depth)

```
[Layer 1: Edge Proxy (src/proxy.ts)]
   │ Membaca signed cookie 'better-auth.session_token', redirect tamu dari '/' ke '/login'
   ▼
[Layer 2: Server Layouts & Root Guard (src/lib/server-auth.ts)]
   │ auth.api.getSession({ headers: await headers() }) sebelum Server Component dirender
   ▼
[Layer 3: HTTP Route Handlers (/api/upload, /api/export/*, /api/uploads/*)]
   │ auth.api.getSession() mandiri, validasi otorisasi peran ketat 401/403
   ▼
[Layer 4: tRPC Context & Router Procedures (src/server/context.ts)]
   │ Populasikan ctx.user dari Better Auth session untuk seluruh prosedur internal
   ▼
[Layer 5: Client Interface (LoginForm.tsx, GlobalSidebar.tsx)]
   │ authClient.signIn.username() & authClient.useSession()
```

---

## 3. Matriks Perubahan & Spesifikasi Teknis Sub-Task

### Task 11.1: Penyesuaian Skema Prisma & Migrasi Data Akun
1. **Target File:**
   * `prisma/schema.prisma`
   * `prisma/migrations/*`
   * `scripts/migrate-passwords-to-better-auth.ts`
2. **Spesifikasi Teknis:**
   * Tambahkan model Better Auth pada `prisma/schema.prisma`:
     ```prisma
     model User {
       id              String    @id @default(cuid())
       name            String
       email           String    @unique
       emailVerified   Boolean   @default(false)
       image           String?
       username        String    @unique
       displayUsername String?
       role            Role      @default(PETUGAS_LAPANGAN)
       isActive        Boolean   @default(true)
       up3Id           String?
       ulpId           String?
       up3             UP3?      @relation(fields: [up3Id], references: [id])
       ulp             ULP?      @relation(fields: [ulpId], references: [id])
       
       sessions        Session[]
       accounts        Account[]
       submittedReviews RatingReview[] @relation("SubmittedReviews")
       verifiedReviews  RatingReview[] @relation("VerifiedReviews")
       migrations       MigrationBatch[]
       auditLogs        AuditLog[]
       
       createdAt       DateTime  @default(now())
       updatedAt       DateTime  @updatedAt

       @@map("user")
     }

     model Session {
       id        String   @id @default(cuid())
       userId    String
       token     String   @unique
       expiresAt DateTime
       ipAddress String?
       userAgent String?
       user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
       createdAt DateTime @default(now())
       updatedAt DateTime @updatedAt

       @@map("session")
     }

     model Account {
       id                    String    @id @default(cuid())
       userId                String
       accountId             String
       providerId            String
       password              String?
       accessToken           String?
       refreshToken          String?
       idToken               String?
       accessTokenExpiresAt  DateTime?
       refreshTokenExpiresAt DateTime?
       scope                 String?
       user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
       createdAt             DateTime  @default(now())
       updatedAt             DateTime  @updatedAt

       @@map("account")
     }

     model Verification {
       id         String   @id @default(cuid())
       identifier String
       value      String
       expiresAt  DateTime
       createdAt  DateTime @default(now())
       updatedAt  DateTime @updatedAt

       @@map("verification")
     }
     ```
   * Buat skrip migrasi data otomatis (`scripts/migrate-passwords-to-better-auth.ts`) untuk:
     1. Menetapkan email default jika kosong: `${user.username}@goro.pln.co.id`.
     2. Memindahkan atau menduplikasi `passwordHash` eksisting ke dalam tabel `Account` dengan `providerId: "credential"`, sehingga akun yang sudah ada langsung dapat login tanpa hambatan.

---

### Task 11.2: Konfigurasi Server Core Better Auth (`src/lib/auth.ts`)
1. **Target File:**
   * `src/lib/auth.ts`
   * `src/lib/auth-constants.ts`
   * `.env` / `.env.example`
2. **Spesifikasi Teknis:**
   * Install dependensi: `better-auth`.
   * Konfigurasikan instance `auth`:
     ```typescript
     import { betterAuth } from "better-auth";
     import { prismaAdapter } from "better-auth/adapters/prisma";
     import { username } from "better-auth/plugins/username";
     import prisma from "@/lib/prisma";
     import redis from "@/lib/redis";
     import { verifyPassword, hashPassword } from "./password-utils";

     export const auth = betterAuth({
       appName: "GORO S2JB Command Center",
       database: prismaAdapter(prisma, {
         provider: "postgresql",
       }),
       secondaryStorage: {
         get: async (key) => {
           const val = await redis.get(key);
           return val ? JSON.parse(val) : null;
         },
         set: async (key, value, ttl) => {
           if (ttl) {
             await redis.set(key, JSON.stringify(value), "EX", ttl);
           } else {
             await redis.set(key, JSON.stringify(value));
           }
         },
         delete: async (key) => {
           await redis.del(key);
         },
       },
       user: {
         additionalFields: {
           role: {
             type: "string",
             required: true,
             defaultValue: "PETUGAS_LAPANGAN",
           },
           up3Id: {
             type: "string",
             required: false,
           },
           ulpId: {
             type: "string",
             required: false,
           },
           isActive: {
             type: "boolean",
             required: true,
             defaultValue: true,
           },
         },
       },
       emailAndPassword: {
         enabled: true,
         password: {
           hash: (pwd) => hashPassword(pwd),
           verify: ({ password, hash }) => verifyPassword(password, hash),
         },
       },
       plugins: [
         username({
           minUsernameLength: 3,
           maxUsernameLength: 32,
         }),
       ],
       session: {
         expiresIn: 7 * 24 * 60 * 60, // Default 7 hari
         updateAge: 24 * 60 * 60,
         cookieCache: {
           enabled: true,
           maxAge: 5 * 60, // 5 menit cache cookie untuk edge proxy
         },
       },
       advanced: {
         useSecureCookies: process.env.NODE_ENV === "production",
       },
     });
     ```
   * Pastikan env `BETTER_AUTH_SECRET` (min 32 karakter) dan `BETTER_AUTH_URL` terdokumentasi dan terisi.

---

### Task 11.3: HTTP Route Handler & React Client SDK
1. **Target File:**
   * `src/app/api/auth/[...all]/route.ts`
   * `src/lib/auth-client.ts`
2. **Spesifikasi Teknis:**
   * Bangun Route Handler Next.js di `src/app/api/auth/[...all]/route.ts`:
     ```typescript
     import { auth } from "@/lib/auth";
     import { toNextJsHandler } from "better-auth/next-js";

     export const { GET, POST } = toNextJsHandler(auth.handler);
     ```
   * Buat React Client SDK di `src/lib/auth-client.ts`:
     ```typescript
     import { createAuthClient } from "better-auth/react";
     import { usernameClient } from "better-auth/client/plugins";

     export const authClient = createAuthClient({
       plugins: [usernameClient()],
     });

     export const { signIn, signOut, useSession, getSession } = authClient;
     ```

---

### Task 11.4: Refaktorisasi Pertahanan Berlapis (Layer 1 - Layer 4)
1. **Target File:**
   * `src/proxy.ts` (Layer 1)
   * `src/lib/server-auth.ts` (Layer 2)
   * `src/server/context.ts` (Layer 4)
   * `src/app/api/upload/route.ts`, `src/app/api/export/excel/route.ts`, `src/app/api/export/pdf/route.ts`, `src/app/api/uploads/[...path]/route.ts` (Layer 3)
2. **Spesifikasi Teknis:**
   * **`src/proxy.ts` (Layer 1):**
     * Membaca cookie sesi Better Auth (`better-auth.session_token`).
     * Memverifikasi keberadaan token sesi secara efisien di edge boundary.
     * Mengalihkan pengunjung tanpa token dari rute `/` dan seluruh rute internal ke `/login`.
     * Mengalihkan pengguna terautentikasi dari `/login` ke dasbor peran masing-masing.
   * **`src/lib/server-auth.ts` (Layer 2):**
     * Mengambil sesi server resmi menggunakan `await auth.api.getSession({ headers: await headers() })`.
     * Jika sesi kosong, langsung panggil `redirect("/login")`.
     * Jika peran tidak memenuhi `allowedRoles`, panggil `redirect("/unauthorized?required=...")`.
   * **`src/server/context.ts` (Layer 4):**
     * Mengganti pembacaan token lama dengan pemanggilan `auth.api.getSession({ headers: req.headers })`.
     * Mengisi `ctx.user` dengan objek `SessionUser` terstandardisasi.
   * **HTTP Route Handlers (Layer 3):**
     * Mengganti pengecekan manual dengan `auth.api.getSession({ headers: req.headers })` untuk keamanan mutlak 401 dan 403.

---

### Task 11.5: Modernisasi Komponen Antarmuka Pengguna
1. **Target File:**
   * `src/components/auth/LoginForm.tsx`
   * `src/components/layout/GlobalSidebar.tsx`
   * `src/components/admin/UserFormDialog.tsx`
2. **Spesifikasi Teknis:**
   * **`LoginForm.tsx`:**
     * Ganti mutasi tRPC `auth.login` dengan pemanggilan SDK `authClient.signIn.username({ username, password })`.
     * Tampilkan pesan kesalahan autentikasi yang ramah dan taktis sesuai standar copywriting anti-slop.
     * Tangani pengalihan pasca-login secara instan menggunakan rute default peran atau query `redirect`.
   * **`GlobalSidebar.tsx`:**
     * Gunakan hook `useSession()` dari Better Auth React Client atau tRPC session.
     * Sediakan fungsi `handleLogout` menggunakan `await authClient.signOut()` dengan navigasi mulus ke `/login`.
   * **`UserFormDialog.tsx`:**
     * Pada saat Super Admin membuat user baru, buat user via `auth.api.createUser` atau prosedur tRPC yang terintegrasi dengan tabel `User` dan `Account` Better Auth.

---

### Task 11.6: Suite Pengujian Otomasi & Verifikasi Matriks Penetrasi
1. **Target File:**
   * `tests/integration/betterAuthRbac.test.ts`
   * Pembaruan `tests/integration/comprehensiveRbacMatrix.test.ts`
2. **Cakupan Pengujian:**
   * **Uji 1:** Otentikasi username & password sukses menggunakan kredensial seed eksisting (`petugas_rivai`, `pegawai_operator`, `manager_s2jb`, `superadmin`).
   * **Uji 2:** Penolakan sandi salah dengan batas rate limiting yang aman.
   * **Uji 3:** Verifikasi pembuatan sesi di database PostgreSQL dan penyimpanan di Redis `secondaryStorage`.
   * **Uji 4:** Pengujian pertahanan berlapis: Edge Proxy, Server Layouts, Route Handlers (Upload & Export), dan tRPC Procedures dengan token sesi Better Auth.
   * **Uji 5:** Pengujian logout dan pencabutan sesi (*session revocation*).
   * **Uji 6:** Menjalankan seluruh test suite repositori (28+ suites) dengan target kelulusan 100%.

---

## 4. Rencana Eksekusi Bertahap

```
Fase 1: Persiapan Skema & Dependensi
├── 1. Install `better-auth`
├── 2. Update `prisma/schema.prisma` (User, Session, Account, Verification)
├── 3. Generate Prisma client & jalankan migrasi database
└── 4. Jalankan script migrasi akun untuk memetakan password hash ke Account

Fase 2: Konfigurasi Server & Client
├── 1. Buat helper hashing password (`src/lib/password-utils.ts`)
├── 2. Konfigurasi Better Auth Core (`src/lib/auth.ts`) dengan Prisma + Redis + Username Plugin
├── 3. Buat API Route Handler (`src/app/api/auth/[...all]/route.ts`)
└── 4. Buat React Client SDK (`src/lib/auth-client.ts`)

Fase 3: Refaktorisasi Lapisan Keamanan (Defense-in-Depth)
├── 1. Perbarui Edge Proxy (`src/proxy.ts`) untuk sesi Better Auth
├── 2. Perbarui Server Guard (`src/lib/server-auth.ts`)
├── 3. Perbarui tRPC Context (`src/server/context.ts`)
└── 4. Perbarui HTTP Route Handlers (`upload`, `export/excel`, `export/pdf`, `uploads`)

Fase 4: Penyesuaian UI & Form
├── 1. Refaktor `LoginForm.tsx` menggunakan `authClient.signIn.username`
├── 2. Refaktor `GlobalSidebar.tsx` untuk logout via `authClient.signOut`
└── 3. Refaktor `UserFormDialog.tsx` & router `user.ts`

Fase 5: Pengujian Penetrasi & Verifikasi Mutu
├── 1. Buat `tests/integration/betterAuthRbac.test.ts`
├── 2. Jalankan `npm run typecheck`
└── 3. Jalankan `npm run test` untuk memastikan 100% test lulus tanpa regresi
```

---

## 5. Kriteria Keberhasilan & Verifikasi Penerimaan

* [ ] Dependensi `better-auth` terpasang dan terkonfigurasi dengan Prisma 7 Adapter dan Redis Secondary Storage.
* [ ] Seluruh akun eksisting (`petugas_rivai`, `pegawai_operator`, `manager_s2jb`, `superadmin`) dapat login langsung via `username` dan sandi lama tanpa kendala (*zero credential breaking changes*).
* [ ] Sesi login tersimpan di database dan terindeks di Redis untuk verifikasi berkecepatan tinggi.
* [ ] Rute `/api/auth/ok` mengembalikan status `{ status: "ok" }`.
* [ ] Arsitektur 5-Layer Defense-in-Depth (Proxy, Server Layout, Route Handlers, tRPC, UI) terintegrasi mulus dengan sesi Better Auth.
* [ ] Fitur logout mencabut sesi di database dan Redis secara konsisten.
* [ ] Seluruh skenario pengujian unit dan integrasi lulus 100% tanpa regresi.
