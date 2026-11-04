# Task 20.5: Sistem Peringatan Dini Proaktif, Audit Trail Compliance, & End-to-End Resilience Testing

> **Status:** Completed ✅  
> **Inisiatif:** Arsitektur Monitoring Proses Latar Belakang & Jaringan (Fase 3)  
> **Fokus Utama:** Proactive Alert Engine, Security Audit Trails, Chaos & Resilience Testing, & Disaster Recovery Runbook  
> **Target Berkas yang Dimodifikasi/Dibuat:**
> - `src/server/services/alertService.ts` (Baru)
> - [`src/server/services/auditService.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/services/auditService.ts)
> - `tests/integration/backgroundResilience.test.ts` (Baru)
> - `docs/runbooks/background_services_recovery.md` (Baru)
> **Aturan Khusus:** Bebas dari karakter Em Dash dan standar tipografi minimum font size >= 12px (`text-xs`).

---

## 1. Konteks Masalah & Kebutuhan Teknis

Setelah subsistem telemetri jaringan (Task 20.1), pelacak antrean (Task 20.2), pengawasan OS (Task 20.3), dan visualisasi antarmuka (Task 20.4) terpasang, sistem memerlukan lapisan pertahanan proaktif (*proactive guardrail*) dan validasi ketahanan menyeluruh (*end-to-end resilience verification*):
1. **Peringatan Dini Otomatis (Proactive Alerting):** Sistem tidak boleh menunggu administrator membuka halaman monitoring untuk mengetahui adanya gangguan. Sistem harus mampu mendeteksi anomali secara otonom (misal throttling Google Drive atau kebocoran memori).
2. **Kepatuhan Audit Trail (Audit Compliance):** Seluruh intervensi manual terhadap proses latar belakang (seperti restart worker atau penghentian paksa proses) harus tercatat ke basis data dengan identitas eksekutor yang tidak dapat dimanipulasi (*tamper-proof*).
3. **Pengujian Ketahanan Skenario Ekstrem (Chaos Testing):** Perlu dibuktikan melalui pengujian otomatis bahwa kegagalan salah satu subsistem (misalnya microservice Python mati atau Google Drive membatasi koneksi) tidak melumpuhkan aplikasi secara keseluruhan.

---

## 2. Rincian Pekerjaan & Spesifikasi Implementasi

### Langkah 1: Membangun Engine Peringatan Dini (`src/server/services/alertService.ts`)
Buat modul evaluasi anomali sistem:

```typescript
export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface SystemAlert {
  id: string;
  code:
    | "GDRIVE_RATE_LIMITED"
    | "QUEUE_STALLED"
    | "WORKER_MEMORY_HIGH"
    | "CORE_PORT_DOWN"
    | "ORPHAN_PROCESS_DETECTED";
  severity: AlertSeverity;
  message: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
```

- Pasang aturan evaluasi berkala:
  1. **Aturan 1 (Google Drive Throttling):** Jika dalam 2 menit terakhir rasio kegagalan unduhan melebihi 20% atau terdeteksi respon HTTP 403/429 berturut-turut, picu alert `GDRIVE_RATE_LIMITED` (Severity: `WARNING`).
  2. **Aturan 2 (Queue Stall):** Jika ada job aktif yang tidak mengalami pergerakan selama > 180 detik, picu alert `QUEUE_STALLED` (Severity: `CRITICAL`).
  3. **Aturan 3 (Worker OOM Risk):** Jika memori RSS worker BullMQ melebihi 500 MB, picu alert `WORKER_MEMORY_HIGH` (Severity: `WARNING`).
  4. **Aturan 4 (Layanan Inti Terputus):** Jika port 5432 (Postgres), 6379 (Redis), atau 8001 (Python OCR) tidak dapat dijangkau, picu alert `CORE_PORT_DOWN` (Severity: `CRITICAL`).

### Langkah 2: Kepatuhan Penuh Pencatatan Audit Trail
Perbarui [src/server/services/auditService.ts](file:///Users/a69/Desktop/goro-s2jb/src/server/services/auditService.ts) dan router terkait untuk memastikan aksi-aksi berikut selalu tercatat:
- `KILL_BACKGROUND_PROCESS`: Menyimpan PID, alasan (`reason`), sinyal, dan username operator.
- `RESTART_WORKER_SERVICE`: Menyimpan tipe worker, PID baru, dan pemicu restart.
- `CLEAN_ORPHAN_PROCESSES`: Menyimpan jumlah proses zombie yang dibersihkan.
- `PAUSE_QUEUE` / `RESUME_QUEUE` / `DRAIN_QUEUE`: Menyimpan nama antrean dan jumlah job terdampak.

### Langkah 3: Pengujian Integrasi Ketahanan (`tests/integration/backgroundResilience.test.ts`)
Buat suite pengujian otomatis untuk memvalidasi skenario kegagalan:
1. **Simulasi Python OCR Mati (Graceful Fallback):** Matikan atau tutup port 8001, jalankan `ocrWorker`, dan buktikan bahwa worker secara mulus beralih ke CLI subprocess runner (`ocrService.ts`) tanpa kegagalan ulasan.
2. **Simulasi Google Drive Throttling (Multi-Endpoint Failover):** Simulasikan endpoint 1 mengembalikan HTTP 429 Too Many Requests, dan buktikan bahwa `evidenceDownloader` berhasil beralih ke endpoint 2 dan endpoint 3.
3. **Simulasi Ulasan Banyak Bersamaan (High-Load Queue Stress):** Masukkan 100 job uji ke dalam `ocrQueue` dan buktikan bahwa seluruh job diproses secara stabil tanpa kebocoran memori atau deadlocks.

### Langkah 4: Penyusunan Runbook Pemulihan Bencana Operasional
Tulis berkas `docs/runbooks/background_services_recovery.md` sebagai panduan ringkas bagi tim IT operasi jika terjadi kegagalan sistem:
- Cara mereset koneksi Redis yang tertahan.
- Cara membersihkan port yang terkunci (`kill $(lsof -t -i:8001)`).
- Prosedur memulai ulang worker jika antrean terhenti.

---

## 3. Matriks Otorisasi & Hak Akses (RBAC: SUPER_ADMIN vs PEGAWAI)

| Aspek Fitur | SUPER_ADMIN | PEGAWAI (Operator / Verifikator) |
| :--- | :--- | :--- |
| **Penerimaan Alert Sistem** | Menerima seluruh alert teknis berkategori `WARNING` dan `CRITICAL` (Google Drive Throttling, Queue Stalled >180 detik, Worker High Memory, Core Port Down). | Hanya menerima banner operasional ramah pengguna: *"Pemrosesan otomatis ulasan sedang padat. Anda dapat melanjutkan verifikasi pada ulasan yang telah siap."* |
| **Kepatuhan Audit Trail** | Memantau log audit global seluruh aktivitas mutasi latar belakang: pembunuhan proses, pembersihan zombie, dan penghentian antrean. | Hanya dapat melihat log aktivitas verifikasi ulasan yang dilakukan oleh akunnya sendiri (Self-Audit). |
| **Pengujian Ketahanan & Simulasi Chaos** | Berwenang mengeksekusi uji simulasi kegagalan (`tests/integration/backgroundResilience.test.ts`) dan tindakan runbook darurat. | Tidak memiliki hak akses mengeksekusi pengujian ketahanan infrastruktur atau runbook pemulihan. |

---

## 4. Kriteria Keberhasilan & Skenario Pengujian

1. **Seluruh Pengujian Ketahanan Lulus:** `tests/integration/backgroundResilience.test.ts` berhasil mengeksekusi simulasi kegagalan dan lolos 100%.
2. **Audit Log Konsisten:** Setiap mutasi latar belakang terbukti menghasilkan baris di tabel `AuditLog`.
3. **Alert Engine Akurat:** Pemicu alert tidak memicu alarm palsu (*false positive*) saat sistem berjalan pada kondisi normal.
4. **Bebas Error:** `npx tsc --noEmit` lulus dengan 0 error.

---

## 5. Panduan Eksekusi Mandiri untuk Agent

```bash
# 1. Buat src/server/services/alertService.ts
# 2. Perbarui auditService.ts dan systemProcesses.ts
# 3. Tulis tests/integration/backgroundResilience.test.ts
npx vitest run tests/integration/backgroundResilience.test.ts

# 4. Tulis docs/runbooks/background_services_recovery.md
# 5. Jalankan verifikasi menyeluruh seluruh suite test
npx vitest run tests/ocr_service.test.ts tests/ocr_matcher_triage.test.ts tests/unit/workerManagement.test.ts

# 6. Jalankan typecheck TypeScript
npx tsc --noEmit
```

