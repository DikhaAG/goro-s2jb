# Task 17: Pusat Kontrol & Manajemen Proses Latar Belakang Sistem Lokal (Local Background Process & Service Orchestration Center) untuk Super Admin

> **Status:** Completed ✅  
> **Fase:** 3 (Observabilitas Sistem, Manajemen Orkestrasi Layanan Lokal, Pengendalian Worker & Diagnostik Super Admin)  
> **Target Audiens:** Super Admin, Fullstack Next.js Engineer, System Observability Specialist, Security & QA Automation Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Modul 5: Keamanan, Audit Log, dan Administrasi Sistem Global)
> - [`scripts/start-mac.sh`](file:///Users/a69/Desktop/goro-s2jb/scripts/start-mac.sh) (Arsitektur Orkestrasi Daemon Lokal: Python OCR, BullMQ Workers, PostgreSQL, Redis, Next.js)
> - [`src/app/api/health/route.ts`](file:///Users/a69/Desktop/goro-s2jb/src/app/api/health/route.ts) (Subsistem Health-Check & Telemetri Konektivitas)
> - [`docs/tasks/task_16.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_16.md) (Arsitektur Migrasi Data Masif, Worker Ingestion, & Monitoring RBAC)
> - [`.agents/skills/frontend-ui-engineering/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-ui-engineering/SKILL.md) (Standar Arsitektur UI Produksi, Aksesibilitas WCAG, & State Management)
> - [`.agents/skills/apple-design/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/apple-design/SKILL.md) (Standar Interaksi, Transisi Halus, Kedalaman Material, & Tipografi Apple)
> - [`.agents/skills/tdd/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/SKILL.md) (Test-Driven Development & Pengujian Menyeluruh)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Core Anti-Slop Filter & Larangan Karakter Em Dash)

---

## 1. Latar Belakang Masalah & Urgensi Bisnis

### 1.1 Kebutuhan Visibilitas Proses Lokal bagi Super Admin
Dalam lingkungan operasional lokal GORO S2JB, aplikasi bergantung pada serangkaian layanan dan proses latar belakang yang berjalan secara simultan:
1. **Basis Data Relasional:** PostgreSQL daemon (Port 5432).
2. **In-Memory Cache & Message Broker:** Redis server (Port 6379).
3. **Microservice AI/ML:** Python OCR FastAPI/Uvicorn (Port 8001).
4. **Daemon Worker Antrean BullMQ:**
   - Worker Ekstraksi OCR: `npm run worker:ocr` (`src/server/workers/ocrWorker.ts`).
   - Worker Ingesti Cepat Impor: `npm run worker:import` (`src/server/workers/importWorker.ts`).
5. **Server Web Utama:** Next.js development / production runtime (Port 3000).
6. **Perintah Ad-Hoc / Skrip CLI:** Skrip inspeksi one-liner, migrasi data, atau pemrosesan batch lokal.

Saat ini, status dari proses-proses tersebut hanya dapat dipantau oleh pengembang melalui terminal command-line (CLI) menggunakan perintah seperti `ps`, `lsof`, `kill`, atau membaca berkas log secara manual. 

Super Admin yang mengoperasikan sistem dari antarmuka web tidak memiliki sarana terpusat untuk:
- Memeriksa apakah worker latar belakang dan microservice sedang berjalan normal (*Running*), mati (*Stopped*), atau mengalami gangguan (*Degraded*).
- Mengetahui Process ID (PID), penggunaan memori RAM (RSS/Heap), konsumsi CPU (%), serta waktu aktif (*uptime*) dari setiap proses.
- Membaca rekaman log aktivitas terbaru (*tail logs*) secara real-time dari direktori `logs/` untuk mendiagnosis kendala operasional tanpa membuka terminal OS.
- Mengambil tindakan kuratif langsung dari UI: menghentikan proses yang macet/menggantung (*kill hanging/zombie process*), menyalakan kembali layanan (*restart/spawn worker*), atau membersihkan port yang tertahan.

---

### 1.2 Bahaya Proses Menggantung (*Hanging / Zombie Processes*)
Sebagaimana teridentifikasi pada kasus pengujian sebelumnya:
- Sebuah skrip Node.js yang membuka koneksi TCP persisten ke Redis (`ioredis`) tanpa memanggil `process.exit(0)` atau `redis.disconnect()` akan terus menahan *event loop* runtime.
- Proses tersebut tetap berstatus berjalan di latar belakang sistem operasi (*hanging background task*), mengonsumsi memori, dan mengunci soket koneksi.
- Pada kasus lain, proses worker atau microservice Python dapat mengalami kegagalan fatal yang tidak terdeteksi oleh peramban, menyebabkan antrean job tertahan berjam-jam tanpa adanya peringatan visual pada antarmuka web.
- Konflik port (*Port Conflict / EADDRINUSE*) dapat terjadi jika proses zombie sebelumnya masih mengunci port 3000, 8001, atau 6379 saat pengembang atau admin mencoba menjalankan sistem.

Oleh karena itu, diperlukan sebuah **Pusat Kontrol & Manajemen Proses Latar Belakang Sistem Lokal** yang aman, responsif, dan komprehensif pada halaman Super Admin.

---

## 2. Arsitektur Solusi & Prinsip Keamanan

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   ANTARMUKA SUPER ADMIN: /system-processes                             │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌───────────────────────────┐  │
│  │ Service Status Grid   │  │ Running Process Table  │  │ Real-Time Log Viewer      │  │
│  │ (Status, Port, Uptime)│  │ (PID, CPU, RAM, State) │  │ (Tail Reader logs/*.log)  │  │
│  └───────────┬───────────┘  └───────────┬────────────┘  └─────────────┬─────────────┘  │
│              │                          │                             │                │
│              ▼                          ▼                             ▼                │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Modal Kontrol Tindakan (Restart, Graceful Kill, Force Terminate, Clean Zombie)   │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
└─────────────────────────────────────────┼──────────────────────────────────────────────┘
                                          │ tRPC Mutations & Queries
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND ENGINE: src/server/routers/systemProcesses.ts               │
│                                                                                        │
│  1. LAYER OTORISASI: requireServerAuth([Role.SUPER_ADMIN])                             │
│  2. SANDBOX KEAMANAN: Whitelist PID & Validasi Jalur Proyek                            │
│  3. PROCESS MANAGER SERVICE: src/lib/processManager.ts                                 │
│     ├─ Pemindaian Layanan Port (3000, 5432, 6379, 8001) via net socket / lsof          │
│     ├─ Inspeksi Proses OS (ps -axo pid,ppid,pcpu,pmem,rss,command)                      │
│     ├─ Log Streamer & Tail Reader (logs/worker_import.log, logs/ocr_service.log, dll.)  │
│     └─ Lifecycle Controller (SIGTERM, SIGKILL, Spawn Child Process)                    │
│  4. IMMUTABLE AUDIT LOGGER: Pencatatan ke tabel AuditLog dengan Super Admin Actor ID   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Prinsip Keamanan Ketat (*Security Sandbox*)
Memberikan wewenang kepada aplikasi web untuk memanipulasi proses sistem operasi lokal memiliki risiko keamanan tinggi apabila tidak dibatasi secara ketat:
1. **Otorisasi Absolut:** Halaman dan seluruh prosedur API hanya dapat diakses oleh pengguna dengan role `SUPER_ADMIN`. Setiap permintaan dari role lain (`PEGAWAI`, `PETUGAS_LAPANGAN`, `MANAGER`, atau `GUEST`) langsung ditolak dengan kode `FORBIDDEN` (HTTP 403).
2. **Whitelist Verifikasi PID & Jalur Direktori:**
   - Tindakan penghentian (*kill*) atau pemulaian ulang (*restart*) **DILARANG KERAS** menyentuh PID di luar lingkup aplikasi GORO S2JB.
   - Sistem memverifikasi bahwa command line dari proses target mengandung kata kunci path proyek (`goro-s2jb`), berkas script worker (`src/server/workers`), lingkungan virtual Python (`python-services/ocr`), atau menduduki port khusus aplikasi (`3000`, `8001`, `6379`, `5432`).
   - Sistem memblokir eksekusi terhadap PID sistem operasi esensial (seperti PID <= 100, `launchd`, `systemd`, `kernel_task`, dsb.).
3. **Pencatatan Audit Log Kekal:**
   - Setiap tindakan administratif (menghentikan proses, memulai proses, atau membersihkan proses zombie) secara otomatis dicatat ke tabel `AuditLog` dengan field:
     * `actorId`: ID Super Admin yang melakukan tindakan.
     * `action`: Contoh `PROCESS_TERMINATED`, `SERVICE_RESTARTED`, `ORPHAN_CLEANED`.
     * `targetId`: PID dan nama layanan terkait.
     * `details`: Alasan tindakan, sinyal yang dikirim (`SIGTERM`/`SIGKILL`), dan hasil eksekusi.
4. **Konfirmasi Ganda untuk Aksi Destruktif:**
   - Tombol penghentian proses (*Kill Process*) memunculkan modal dialog konfirmasi eksplisit dengan ringkasan dampak dan jeda waktu (*safety delay countdown*) sebelum tombol konfirmasi aktif.

---

## 3. Struktur Modul & Berkas yang Akan Dibuat / Dimodifikasi

```
src/
├── app/
│   └── (admin)/
│       └── system-processes/
│           └── page.tsx                         # Halaman utama Pusat Manajemen Proses Lokal
├── components/
│   ├── admin/
│   │   └── system/
│   │       ├── ServiceStatusGrid.tsx            # Kartu status 5 layanan inti (Port, Latency, PID)
│   │       ├── RunningProcessTable.tsx          # Tabel proses OS lokal dengan filter & aksi kontrol
│   │       ├── LiveLogViewer.tsx                # Terminal log viewer dengan tailing real-time
│   │       ├── KillProcessConfirmModal.tsx      # Modal konfirmasi aman untuk terminasi proses
│   │       └── SystemResourceGauge.tsx          # Visualisasi penggunaan CPU & Memori sistem
│   └── layout/
│       └── GlobalSidebar.tsx                    # Penambahan menu 'Layanan & Proses Sistem' (SUPER_ADMIN)
├── lib/
│   └── processManager.ts                        # Modul utilitas OS: deteksi port, ps inspect, log tailing
├── server/
│   └── routers/
│       ├── _app.ts                              # Pendaftaran sub-router systemProcesses
│       └── systemProcesses.ts                   # Router tRPC untuk telemetri proses & kontrol worker
└── tests/
    ├── unit/
    │   ├── processManager.test.ts               # Pengujian utilitas deteksi proses & validasi whitelist
    │   └── systemProcessesRouter.test.ts        # Pengujian tRPC router & pengamanan RBAC SUPER_ADMIN
    └── integration/
        └── adminProcessManagement.test.ts       # Pengujian alur penghentian proses & pencatatan AuditLog
```

---

## 4. Rincian Teknis Implementasi

### 4.1 Modul Utilitas Proses Lokal (`src/lib/processManager.ts`)
Modul ini bertindak sebagai jembatan aman antara runtime Node.js dan sistem operasi host:

1. **`detectServicePorts()`:**
   - Memeriksa ketersediaan koneksi TCP pada port:
     * `5432`: PostgreSQL
     * `6379`: Redis
     * `8001`: Python OCR
     * `3000`: Next.js Web App
   - Mengukur latensi koneksi (*ping latency*) dalam satuan milidetik.
   - Menemukan PID yang sedang mengikat (*binding*) port tersebut menggunakan perintah `lsof -ti :<port>`.

2. **`listAppProcesses()`:**
   - Menjalankan perintah non-blocking `ps -axo pid,ppid,pcpu,pmem,rss,stat,etime,command`.
   - Melakukan filter ketat pada daftar proses yang berkaitan dengan aplikasi:
     * Mengandung kata `goro-s2jb`
     * Mengandung kata `ocrWorker.ts` atau `importWorker.ts`
     * Mengandung kata `uvicorn main:app`
     * Mengandung kata `redis-server` atau `postgres`
   - Mengurai baris menjadi objek terstruktur:
     ```typescript
     export interface ManagedProcess {
       pid: number;
       ppid: number;
       cpuPercent: number;
       memPercent: number;
       rssKb: number;
       status: string;
       elapsedTime: string;
       command: string;
       serviceType: "IMPORT_WORKER" | "OCR_WORKER" | "PYTHON_OCR" | "REDIS" | "POSTGRES" | "WEB_SERVER" | "CLI_TASK" | "OTHER";
       isSafeToKill: boolean;
     }
     ```

3. **`tailLogFile(fileName: string, lineCount: number = 100)`:**
   - Membaca baris-baris terakhir dari berkas di direktori `logs/`:
     * `logs/worker_import.log`
     * `logs/worker_ocr.log`
     * `logs/ocr_service.log`
   - Melakukan sanitasi path untuk mencegah *Path Traversal Vulnerability* (`path.basename` dan validasi keberadaan berkas dalam direktori `logs/`).
   - Mengembalikan array string baris log beserta metadata ukuran berkas dan waktu modifikasi terakhir.

4. **`terminateProcess(pid: number, force: boolean = false)`:**
   - Melakukan validasi keamanan whitelist PID:
     * Memastikan PID bukan proses root/OS vital.
     * Memverifikasi bahwa PID terdaftar dalam hasil `listAppProcesses()`.
   - Mengirimkan sinyal pemutusan:
     * `force === false`: Mengirimkan sinyal `SIGTERM` (memungkinkan proses menutup koneksi socket secara bersih).
     * `force === true`: Mengirimkan sinyal `SIGKILL` (untuk proses yang macet total/unresponsive).
   - Mengembalikan status keberhasilan atau galat.

---

### 4.2 Router API tRPC (`src/server/routers/systemProcesses.ts`)
Router khusus Super Admin dengan prosedur berikut:

1. **`getSystemOverview` (Query):**
   - Mengembalikan ringkasan status 5 layanan inti: PostgreSQL, Redis, Python OCR, Worker Import, Worker OCR.
   - Metrik CPU & Memori sistem host (`os.cpus()`, `os.totalmem()`, `os.freemem()`, `process.memoryUsage()`).

2. **`getRunningProcesses` (Query):**
   - Mengembalikan daftar seluruh proses latar belakang aplikasi yang sedang berjalan beserta status `isSafeToKill`.

3. **`getServiceLogs` (Query):**
   - Input: `{ logType: z.enum(["import", "ocr", "python", "system"]), lines: z.number().min(10).max(500).default(100) }`
   - Mengembalikan isi log terbaru untuk ditampilkan pada terminal viewer di antarmuka.

4. **`terminateProcess` (Mutation):**
   - Input: `{ pid: z.number(), reason: z.string().min(5), force: z.boolean().default(false) }`
   - Memanggil `processManager.terminateProcess`.
   - Mencatat rekaman audit ke database:
     ```typescript
     await prisma.auditLog.create({
       data: {
         actorId: ctx.user.id,
         action: "KILL_BACKGROUND_PROCESS",
         targetId: String(input.pid),
         details: { reason: input.reason, force: input.force, timestamp: new Date().toISOString() },
       },
     });
     ```

5. **`restartWorker` (Mutation):**
   - Input: `{ workerType: z.enum(["import", "ocr", "python"]) }`
   - Menghentikan instansi worker lama yang berjalan, kemudian memicu spawning proses worker baru di latar belakang.
   - Mencatat rekaman audit ke database.

---

### 4.3 Desain Antarmuka Pengguna (Apple Design & WCAG AAA)
Halaman dirancang pada rute [`src/app/(admin)/system-processes/page.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/app/(admin)/system-processes/page.tsx) dengan estetika premium:

1. **Header & Quick Status Bar:**
   - Judul: **Pusat Kontrol Layanan & Proses Latar Belakang**
   - Deskripsi ringkas: Pemantauan real-time status port, konsumsi sumber daya, log operasional, dan pengendalian proses sistem lokal.
   - Tombol Aksi Cepat: **Muat Ulang Status (*Refresh*)**, **Bersihkan Proses Zombie (*Clean Orphans*)**.

2. **Bagian 1: Grid Status Layanan Inti (*Service Status Grid*):**
   - 5 kartu interaktif untuk masing-masing layanan:
     1. *PostgreSQL Relational DB (Port 5432)*
     2. *Redis In-Memory Broker (Port 6379)*
     3. *Python OCR Microservice (Port 8001)*
     4. *BullMQ Bulk Import Worker*
     5. *BullMQ OCR Extraction Worker*
   - Setiap kartu menampilkan:
     * Badge status: Hijau (*Running / Aktif*), Kuning (*Degraded / Lambat*), Merah (*Offline / Terhenti*).
     * Latensi respons (ms).
     * PID proses terkait.
     * Tombol aksi cepat: *Restart Layanan* dan *Lihat Log*.

3. **Bagian 2: Tabel Proses Latar Belakang OS (*Running Process Table*):**
   - Kolom:
     * **PID / PPID:** Identitas unik proses.
     * **Nama Layanan:** Tag berwarna menunjukkan jenis worker/service.
     * **Perintah (*Command*):** Potongan perintah CLI yang aman.
     * **CPU (%):** Indikator warna jika melebihi batas wajar.
     * **Memori RAM (RSS):** Diformat dalam MB atau GB yang mudah dipahami.
     * **Waktu Berjalan (*Elapsed Time*):** Durasi aktif sejak proses dimulai.
     * **Status:** Aktif (*R/S*), Zombie (*Z*), atau Idle.
     * **Aksi:** Tombol **Hentikan (*Kill*)** dengan ikon peringatan. Tombol dinonaktifkan jika proses tidak memenuhi whitelist keamanan.

4. **Bagian 3: Terminal Penampil Log Real-Time (*Live Log Viewer*):**
   - Area tampilan bergaya *developer terminal* dengan latar gelap (`#0f172a`), tipografi monospaced (*JetBrains Mono* / *SF Mono*).
   - Pemilihan berkas log via segmented tabs:
     * `worker_import.log`
     * `worker_ocr.log`
     * `ocr_service.log`
   - Fitur:
     * Tombol *Auto-Scroll to Bottom*.
     * Tombol *Salin Log ke Clipboard*.
     * Kotak pencarian / filter teks pada log.
     * Tombol pembersihan tampilan (*Clear View*).

5. **Modal Konfirmasi Penghentian Proses (`KillProcessConfirmModal`):**
   - Menampilkan PID target, nama layanan, dan peringatan dampak.
   - Pilihan mode: **Terminasi Standar (SIGTERM)** atau **Paksa Hentikan (SIGKILL)**.
   - Input wajib: Alasan penghentian proses (disimpan ke `AuditLog`).
   - Tombol konfirmasi dengan proteksi klik tidak sengaja.

---

### 4.4 Penambahan Navigasi Global Sidebar
Modifikasi pada [`src/components/layout/GlobalSidebar.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/GlobalSidebar.tsx):
- Tambahkan item menu baru pada daftar `NAV_ITEMS`:
  ```typescript
  {
    label: "Layanan & Proses Sistem",
    href: "/system-processes",
    icon: Terminal, // atau Cpu / Server
    roles: ["SUPER_ADMIN"],
  }
  ```
- Menu ini hanya akan dirender untuk pengguna dengan role `SUPER_ADMIN`.

---

## 5. Kriteria Keberterimaan (*Acceptance Criteria*)

- [x] **AC-1 (Service Status Grid):**
  Halaman Super Admin menampilkan status real-time untuk seluruh 5 layanan inti (PostgreSQL 5432, Redis 6379, Python OCR 8001, Worker Import, Worker OCR) dengan indikator visual warna, nilai latensi respons dalam milidetik, serta port binding.
- [x] **AC-2 (OS Process Inspection):**
  Sistem mampu membaca dan menampilkan daftar proses latar belakang lokal yang berkaitan dengan aplikasi GORO S2JB lengkap dengan PID, PPID, penggunaan CPU (%), pemakaian memori RSS (MB), status eksekusi, dan waktu berjalan.
- [x] **AC-3 (Live Log Tailing Viewer):**
  Tersedia komponen terminal viewer interaktif yang mampu membaca dan menampilkan baris log terkini dari direktori `logs/` (`worker_import.log`, `worker_ocr.log`, `ocr_service.log`) secara responsif dan aman dari ancaman *path traversal*.
- [x] **AC-4 (Safe Process Lifecycle Management):**
  Super Admin dapat mengirimkan perintah penghentian proses (`SIGTERM` atau `SIGKILL`) serta pemulaian ulang (*restart*) worker langsung dari antarmuka web.
- [x] **AC-5 (Strict Security Sandbox & PID Whitelist):**
  Proses sistem operasi di luar cakupan aplikasi GORO S2JB dan proses vital sistem (PID <= 100) dilindungi secara mutlak dan tidak dapat dihentikan oleh aplikasi web. Upaya memanipulasi PID ilegal akan ditolak dengan galat validasi.
- [x] **AC-6 (Immutable Audit Trail):**
  Setiap tindakan penghentian proses atau pemulaian ulang layanan tercatat secara permanen di tabel `AuditLog` dengan menyertakan ID Super Admin, PID target, jenis tindakan, alasan, dan timestamp akurat.
- [x] **AC-7 (Strict RBAC Isolation):**
  Halaman `/system-processes` dan router `systemProcesses` dilindungi secara ketat di layer server layout dan tRPC middleware; hanya role `SUPER_ADMIN` yang dapat mengakses. Pengguna dengan role lain dialihkan (*redirected*) atau ditolak dengan `FORBIDDEN`.
- [x] **AC-8 (Zero Regression & Full TDD Test Coverage):**
  Seluruh pengujian unit dan integrasi baru lulus 100%, serta 44 berkas pengujian eksisting (280 pengujian total) tetap lulus tanpa ada penurunan performa atau regresi fungsional.

---

## 6. Rencana Eksekusi Bertahap

| Tahap | Fokus Pekerjaan | Berkas Terkait |
|---|---|---|
| **Tahap 1** | Implementasi utilitas deteksi proses, port scanner, dan log reader | `src/lib/processManager.ts`, `tests/unit/processManager.test.ts` |
| **Tahap 2** | Pembuatan tRPC Router `systemProcesses` & pencatatan `AuditLog` | `src/server/routers/systemProcesses.ts`, `src/server/routers/_app.ts`, `tests/unit/systemProcessesRouter.test.ts` |
| **Tahap 3** | Pembangunan komponen UI Apple Design (Status Grid, Process Table, Terminal Log, Modal) | `src/components/admin/system/*`, `src/app/(admin)/system-processes/page.tsx` |
| **Tahap 4** | Integrasi navigasi menu Super Admin pada Global Sidebar & verifikasi RBAC | `src/components/layout/GlobalSidebar.tsx`, `tests/integration/adminSystemProcessesRbac.test.ts` |
| **Tahap 5** | Verifikasi menyeluruh: pengujian manual lokal, pengujian regresi penuh (`npm test`), dan typecheck (`npx tsc --noEmit`) | Seluruh suite pengujian |

---

## 7. Sub-Task 17.1: Harmonisasi & Standardisasi Konsistensi UI/UX Sistem Menyeluruh (*Cross-Module UI/UX Consistency & Aesthetic Polish*)

> **Status Sub-Task:** Completed ✅  
> **Target Audiens:** Frontend UI Engineer, UX Architect, Product Designer, QA Accessibility Specialist  
> **Keahlian & Panduan Wajib (.agents/skills/):**
> - [`.agents/skills/ui-ux-pro-max/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/ui-ux-pro-max/SKILL.md) (119 UX Guidelines, Design Intelligence, Token Palettes, & Responsive Spacing)
> - [`.agents/skills/apple-design/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/apple-design/SKILL.md) (Kedalaman Material, Tipografi Optikal, Umpan Balik Haptik Visual, & Restraint Estetika)
> - [`.agents/skills/frontend-design/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-design/SKILL.md) (Aesthetic Direction yang Disengaja, Menolak Tampilan Template Generic AI)
> - [`.agents/skills/frontend-ui-engineering/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-ui-engineering/SKILL.md) (Aksesibilitas WCAG AAA, Status Interaksi Keyboard, & Loading States)
> - [`.agents/skills/antislop-ui/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-ui/SKILL.md) (Eliminasi Warna Generic Red/Blue/Green Slop, Radius Konsisten, & Larangan Karakter Em Dash)
> - [`.agents/skills/antislop-human/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-human/SKILL.md) (Standar Kontras Rasio Minimal 4.5:1 & Target Sentuh Minimal 44x44px)

---

### 7.1 Latar Belakang & Analisis Inkonsistensi Saat Ini
Dengan pesatnya penambahan fitur pada Fase 1 hingga Fase 3 (Entri Eviden, Triase, Laporan Eksekutif, Manajemen Pengguna, Migrasi Data Historis, Monitoring Worker, Catatan Audit Log, dan Pusat Kontrol Layanan Sistem), beberapa modul dibangun pada fase yang berbeda sehingga memunculkan variasi kecil dalam implementasi visual dan interaksi:
1. **Variasi Radius Elemen (Border Radius Drift):**
   - Sebagian komponen menggunakan `rounded-lg` (8px), sebagian `rounded-xl` (12px), dan sebagian kartu utama menggunakan `rounded-2xl` (16px).
   - Diperlukan aturan tegas untuk hierarki radius: `rounded-2xl` untuk Card / Container Utama, `rounded-xl` untuk Form Input / Modal / Dropdown, dan `rounded-lg` untuk Tombol Mikro / Badge.
2. **Harmonisasi Skema Warna Semantik (Eliminasi Raw Color Drifting):**
   - Masih ditemukan percampuran antara warna hex mentah dengan Tailwind utility classes.
   - Seluruh status sistem harus dinormalisasi ke token semantik PLN S2JB:
     * **Identitas Korporat PLN:** Biru PLN Cyan (`#00A3E0`, hover `#0072A3`), Dark Navy (`#0B132B`, `#1C2541`), dan Latar Bersih (`#f8fafc`).
     * **Sukses / Approved:** `emerald-600` (bg `emerald-50`, border `emerald-200/80`).
     * **Peringatan / Need Clarification / Degraded:** `amber-600` (bg `amber-50`, border `amber-200/80`).
     * **Bahaya / Rejected / Failed / Offline:** `rose-600` (bg `rose-50`, border `rose-200/80`).
     * **Netral / Pending:** `slate-600` (bg `slate-50`, border `slate-200/80`).
3. **Standarisasi Hirarki Tipografi Apple (*Typography Cadence*):**
   - Halaman harus memiliki ritme visual yang seragam:
     * Header Halaman: `text-xl font-bold text-slate-900 tracking-tight`
     * Deskripsi Konteks: `text-xs text-slate-500 max-w-2xl mt-1`
     * Judul Seksi (*Section Heading*): `text-sm font-semibold text-slate-800 flex items-center gap-2`
     * Data Teknis / Nilai Angka: `font-mono text-xs text-slate-800`
4. **Target Sentuh & Aksesibilitas Keyboard (*Touch Targets & Focus Rings*):**
   - Memastikan seluruh tombol aksi di tabel dan grid memiliki target klik/sentuh yang memadai (minimal 44x44px padding area) untuk perangkat tablet/layar sentuh operasional lapangan.
   - Memastikan status fokus keyboard (`focus-visible:ring-2 focus-visible:ring-[#00A3E0]/40`) konsisten di semua modal, input teks, dan tombol dropdown.

---

### 7.2 Matriks Standarisasi Komponen Global

| Kategori Komponen | Spesifikasi Baku UI/UX Pro Max & Apple Design | Contoh Penggunaan |
|---|---|---|
| **Primary Button** | `h-9 text-xs px-3.5 rounded-xl bg-[#00A3E0] hover:bg-[#0072A3] text-white font-medium shadow-sm transition-all duration-150 active:scale-[0.98]` | Simpan Data, Mulai Impor, Segarkan Status |
| **Secondary / Outline Button** | `h-9 text-xs px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-all duration-150` | Batalkan, Filter Data, Ekspor CSV |
| **Micro Action Button (Table/Grid)** | `h-7 text-xs px-2.5 rounded-lg font-medium transition-colors` (Border spesifik semantik: `border-rose-200` untuk Hentikan, `border-slate-200` untuk Restart) | Aksi baris tabel proses, detail ulasan |
| **Status Badge / Pill** | `inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border` (Disertai ikon SVG 12x12px, tanpa emoji mentah) | Aktif, Terhenti, Disetujui, Ditolak |
| **Container / Card** | `bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 p-5 md:p-6` | Kartu ringkasan metrik, panel monitoring |
| **Form Input & Select** | `h-9 text-xs px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#00A3E0]/30 transition-all` | Kolom pencarian, input alasan modal |
| **Modal / Dialog** | `bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 max-w-md w-full backdrop-blur-sm bg-slate-900/60 overlay` | Modal konfirmasi terminasi proses, modal triase |
| **Empty State** | `p-12 text-center text-slate-400 flex flex-col items-center justify-center` disertai ikon 24x24px ber-opacity 40% dan teks panduan ramah | Tabel tanpa data, log kosong |

---

### 7.3 Cakupan Modul Audit & Refaktor Konsistensi

Modul-modul aplikasi yang masuk dalam cakupan audit dan penyeragaman konsistensi visual:
1. **Modul Navigasi Global ([src/components/layout/GlobalSidebar.tsx](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/GlobalSidebar.tsx)):**
   - Penyelarasan tinggi item menu (h-9), ikon 16x16px, padding seragam, dan indikator aktif bernuansa PLN Cyan dengan kontras teks terang.
2. **Modul Pusat Kontrol Layanan & Proses ([src/app/(admin)/system-processes/page.tsx](file:///Users/a69/Desktop/goro-s2jb/src/app/(admin)/system-processes/page.tsx)):**
   - Penyelarasan kartu `ServiceStatusGrid`, `RunningProcessTable`, `SystemResourceGauge`, dan `LiveLogViewer` agar 100% patuh pada token matriks di atas.
3. **Modul Monitoring Worker & Batch ([src/app/(operator)/migration/monitor/page.tsx](file:///Users/a69/Desktop/goro-s2jb/src/app/(operator)/migration/monitor/page.tsx)):**
   - Penyelarasan kartu antrean BullMQ, tombol Jeda/Lanjutkan antrean, tabel riwayat batch, dan modal penampil log galat.
4. **Modul Triase Ulasan Eviden ([src/app/(operator)/triage/page.tsx](file:///Users/a69/Desktop/goro-s2jb/src/app/(operator)/triage/page.tsx)):**
   - Penyelarasan layout split-view (panel ulasan vs pratinjau citra eviden pintar), badge status triase, dan shortcut keyboard.
5. **Modul Laporan Eksekutif ([src/app/(manager)/reports/page.tsx](file:///Users/a69/Desktop/goro-s2jb/src/app/(manager)/reports/page.tsx)):**
   - Penyelarasan kartu rekapitulasi UP3/ULP, grafik distribusi ulasan, dan tombol unduh laporan Excel.
6. **Modul Manajemen Pengguna ([src/app/(admin)/users/page.tsx](file:///Users/a69/Desktop/goro-s2jb/src/app/(admin)/users/page.tsx)):**
   - Penyelarasan tabel pengguna, badge peran (*Role*), modal tambah/ubah pengguna, dan dialog reset password.
7. **Modul Audit Log Keamanan ([src/app/(admin)/audit-logs/page.tsx](file:///Users/a69/Desktop/goro-s2jb/src/app/(admin)/audit-logs/page.tsx)):**
   - Penyelarasan tabel log keamanan, badge jenis aksi, filter aktor pengguna, dan tampilan metadata JSON.

---

### 7.4 Kriteria Keberterimaan Sub-Task 17.1 (*Acceptance Criteria*)

- [x] **AC-9 (Design Token & Component Matrix Alignment):**
  Seluruh komponen dasar (`Button`, `Badge`, `Card`, `Input`, `Select`, `Modal`, `Table`) di seluruh 7 modul aplikasi mengadopsi spesifikasi radius, elevasi, dan padding seragam sesuai Matriks Standarisasi Komponen Global.
- [x] **AC-10 (Color Harmony & Semantic Normalization):**
  Tidak ada penggunaan warna hex acak (*hardcoded*) di luar token PLN S2JB (`#00A3E0`, `#0072A3`, `#0B132B`, `#1C2541`) dan palet status semantik standar (`emerald`, `amber`, `rose`, `slate`). Seluruh teks badge dan indikator memenuhi kontras rasio minimal 4.5:1.
- [x] **AC-11 (Human-Centric & Apple-Style Micro-Interactions):**
  Seluruh tombol interaktif memiliki umpan balik visual saat ditekan (*active scale 0.98*, transisi 150ms), status *loading spinner* konsisten, dan ring fokus aksesibilitas keyboard terlihat jelas pada navigasi tab.
- [x] **AC-12 (Responsive Mobile-to-Desktop Layouts):**
  Setiap halaman beradaptasi dengan mulus pada layar ponsel (375px+), tablet (768px+), dan desktop (1280px+) tanpa ada pergeseran tata letak (*Cumulative Layout Shift < 0.1*) atau overflow horizontal yang tidak disengaja.
- [x] **AC-13 (Zero Regression & Full Test Suite Integrity):**
  Seluruh 44 berkas pengujian (283 pengujian) tetap lulus 100% dan pengujian unit baru untuk audit token visual (`tests/unit/designSystemTokens.test.ts`) dan kepatuhan kontras warna WCAG (`tests/unit/colorContrastWcag.test.ts`) mencakup seluruh aturan konsistensi yang baru ditetapkan.

---

### 7.5 Rencana Eksekusi Bertahap Sub-Task 17.1

| Tahap | Fokus Pekerjaan | Berkas Terkait |
|---|---|---|
| **Tahap 17.1-A** | Harmonisasi komponen modul administrasi: `system-processes`, `users`, dan `audit-logs` | `src/app/(admin)/*`, `src/components/admin/*` |
| **Tahap 17.1-B** | Harmonisasi komponen modul operasional: `migration/monitor`, `migration`, dan `triage` | `src/app/(operator)/*`, `src/components/migration/*`, `src/components/triage/*` |
| **Tahap 17.1-C** | Harmonisasi modul eksekutif dan navigasi global: `reports`, `intake`, dan `GlobalSidebar` | `src/app/(manager)/*`, `src/app/(field)/*`, `src/components/layout/*` |
| **Tahap 17.1-D** | Pengujian token desain, audit aksesibilitas kontras WCAG, dan verifikasi menyeluruh `npm test` | `tests/unit/designSystemTokens.test.ts`, `tests/unit/colorContrastWcag.test.ts` |

