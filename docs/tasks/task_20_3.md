# Task 20.3: Subsistem Pengawasan Proses OS, Socket TCP Probing, & Auto-Cleaner Zombie

> **Status:** Completed ✅  
> **Inisiatif:** Arsitektur Monitoring Proses Latar Belakang & Jaringan (Fase 3)  
> **Fokus Utama:** OS Kernel Process Inspection, Socket Handshake History, Orphan/Zombie Cleanup, & Safe Process Termination  
> **Target Berkas yang Dimodifikasi/Dibuat:**
> - [`src/lib/processManager.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/processManager.ts)
> - [`src/server/routers/systemProcesses.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/routers/systemProcesses.ts)
> - [`src/server/services/auditService.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/services/auditService.ts)
> - `tests/unit/processManagerDeep.test.ts`
> **Aturan Khusus:** Bebas dari karakter Em Dash dan standar tipografi minimum font size >= 12px (`text-xs`).

---

## 1. Konteks Masalah & Kebutuhan Teknis

Aplikasi GORO S2JB pada sistem operasi lokal (macOS/Linux) berjalan bersama berbagai child process dan daemon:
- PostgreSQL (5432)
- Redis (6379)
- Python OCR FastAPI (8001)
- Next.js Web Server (3000)
- Worker BullMQ OCR dan Impor

Meskipun [src/lib/processManager.ts](file:///Users/a69/Desktop/goro-s2jb/src/lib/processManager.ts) telah mampu mendeteksi port dan menghentikan proses, masih terdapat celah operasional yang perlu disempurnakan:
1. **Histori Latensi Jabat Tangan Soket TCP:** Saat ini `checkPortConnectivity()` hanya mengembalikan latensi seketika (snapshot). Jika terjadi lonjakan latensi sesaat (*latency spike*), admin tidak dapat melihat tren 5 pengukuran terakhir.
2. **Pendeteksian Proses Zombie yang Lebih Agresif:** Proses yang berstatus zombie (`state: Z` atau proses mati yang belum di-reap oleh parent) atau skrip CLI yang berjalan di latar belakang tanpa kontrol harus dapat dideteksi dan dibersihkan dalam 1 klik.
3. **Penyempurnaan Proteksi PID:** Memastikan tidak ada celah di mana proses server Next.js sendiri atau PID inti sistem operasi secara tidak sengaja terhenti.
4. **Audit Trail Keamanan:** Setiap aksi penghentian proses wajib mencatat metadata lengkap (alasan penghentian, nama eksekutor, sinyal `SIGTERM`/`SIGKILL`) ke tabel `AuditLog`.

---

## 2. Rincian Pekerjaan & Spesifikasi Implementasi

### Langkah 1: Peningkatan Fungsi Soket TCP dengan Rekaman Histori Latensi
Perbarui `checkPortConnectivity()` pada [src/lib/processManager.ts](file:///Users/a69/Desktop/goro-s2jb/src/lib/processManager.ts):
- Simpan ring-buffer in-memory berisi 5 nilai latensi terakhir per port.
- Kembalikan `recentLatencies: number[]` dan `averageLatencyMs: number` pada setiap objek `ServicePortInfo`.
- Berikan status `DEGRADED` jika rata-rata latensi melampaui 300 ms.

### Langkah 2: Peningkatan Pembersih Otomatis Proses Zombie (`cleanOrphanProcesses`)
Perbarui fungsi `cleanOrphanProcesses()`:
- Pindai proses menggunakan perintah `ps -eo pid,ppid,state,command`.
- Identifikasi proses yang memenuhi salah satu kriteria orphan:
  1. Status proses mengandung karakter `Z` (zombie/defunct).
  2. Perintah cocok dengan worker terlepas (*detached worker*) yang memiliki PPID bernilai `1` (diadopsi oleh init/launchd).
  3. Skrip Node.js sementara atau tugas CLI yang tidak aktif lebih dari 30 menit.
- Kirim sinyal `SIGTERM` secara bertahap, dan jika tidak merespons dalam 2 detik, kirim `SIGKILL`.
- Kembalikan daftar PID yang berhasil dibersihkan.

### Langkah 3: Penguatan Mutasi tRPC `systemProcessesRouter`
Pada [src/server/routers/systemProcesses.ts](file:///Users/a69/Desktop/goro-s2jb/src/server/routers/systemProcesses.ts):
- Pastikan prosedur `terminateProcess` memvalidasi input alasan penghentian (`reason`) minimal 5 karakter.
- Rekam event audit dengan aksi `KILL_BACKGROUND_PROCESS` sebelum dan sesudah eksekusi sinyal.
- Perkaya endpoint `getSystemOverview` dengan histori latensi TCP.

---

## 3. Matriks Otorisasi & Hak Akses (RBAC: SUPER_ADMIN vs PEGAWAI)

| Aspek Fitur | SUPER_ADMIN | PEGAWAI (Operator / Verifikator) |
| :--- | :--- | :--- |
| **Akses Manajemen Proses OS** | **Hak Akses Eksklusif (`superAdminProcedure`)**. Memantau daftar PID, konsumsi CPU/RAM tiap worker/daemon, dan memicu penghentian paksa (*Kill Process* / *SIGKILL*). | **Tidak Ada Akses (Strictly Blocked)**. Seluruh endpoint mutasi proses dan inspeksi PID ditolak oleh tRPC dengan status `403 FORBIDDEN` demi keamanan server. |
| **Socket TCP Probing & Port Monitor** | Memeriksa histori 5 latensi socket TCP (PostgreSQL 5432, Redis 6379, Python 8001, Next.js 3000) dan mendeteksi kondisi *Degraded*. | Tidak melihat data teknis soket/port. Hanya melihat lampu indikator global: *"Layanan Sistem Berjalan Normal"* pada bilah atas aplikasi. |
| **Pembersih Zombie (Auto-Cleaner)** | Dapat mengeksekusi `cleanOrphanProcesses()` secara on-demand untuk membersihkan proses zombie/defunct. | Tidak memiliki hak maupun tombol untuk memicu pembersihan proses OS. |
| **Audit Trail Terminasi Proses** | Melihat catatan log lengkap di `AuditLog`: siapa yang mematikan proses, alasan terminasi, sinyal yang dikirim, dan timestamp. | Tidak memiliki hak akses melihat audit log teknis penghentian proses latar belakang. |

---

## 4. Kriteria Keberhasilan & Skenario Pengujian (TDD)

Buat berkas pengujian `tests/unit/processManagerDeep.test.ts`:
1. **Uji Histori Latensi TCP:** Memverifikasi pemanggilan berulang `checkPortConnectivity` mengakumulasi 5 data latensi terakhir.
2. **Uji Penolakan PID Berbahaya:** Memastikan pemanggilan `terminateProcess(1)` atau `terminateProcess(process.pid)` melempar error dan menolak eksekusi.
3. **Uji Pembersihan Zombie:** Menyimulasikan daftar proses yang memiliki flag `Z` dan memverifikasi fungsi `cleanOrphanProcesses` memilih PID tersebut untuk dimatikan.
4. **Uji Audit Log:** Memverifikasi pemanggilan `terminateProcess` membuat baris baru di tabel `AuditLog`.

---

## 5. Panduan Eksekusi Mandiri untuk Agent

```bash
# 1. Jalankan pengujian manajemen worker saat ini
npx vitest run tests/unit/workerManagement.test.ts

# 2. Modifikasi src/lib/processManager.ts dan src/server/routers/systemProcesses.ts
# 3. Buat dan jalankan tests/unit/processManagerDeep.test.ts
npx vitest run tests/unit/processManagerDeep.test.ts

# 4. Jalankan typecheck TypeScript
npx tsc --noEmit
```

