# Task 20.2: Telemetri & Sensor Antrean BullMQ Terpadu (Queue Events, Throughput Tracker & Stall Detector)

> **Status:** Completed ✅  
> **Inisiatif:** Arsitektur Monitoring Proses Latar Belakang & Jaringan (Fase 3)  
> **Fokus Utama:** BullMQ Queue Telemetry, Throughput Calculator (jobs/menit), Stall Job Detector, & Event Listeners  
> **Target Berkas yang Dimodifikasi/Dibuat:**
> - [`src/server/queues/queueTelemetry.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/queues/queueTelemetry.ts) (Baru)
> - [`src/server/queues/ocrQueue.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/queues/ocrQueue.ts)
> - [`src/server/queues/importQueue.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/queues/importQueue.ts)
> - [`src/server/workers/ocrWorker.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/workers/ocrWorker.ts)
> - [`src/server/workers/importWorker.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/workers/importWorker.ts)
> - [`src/server/routers/migration.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/routers/migration.ts)
> - `tests/unit/queueTelemetry.test.ts`
> **Aturan Khusus:** Bebas dari karakter Em Dash dan standar tipografi minimum font size >= 12px (`text-xs`).

---

## 1. Konteks Masalah & Kebutuhan Teknis

Saat ini, aplikasi memiliki dua antrean utama BullMQ yang bekerja pada Redis:
1. `importQueue` (`goro-bulk-import-queue`): Menangani penguraian streaming CSV/XLSX.
2. `ocrQueue` (`goro-ocr-queue`): Menangani ekstraksi OCR citra dan anti-fraud pHash.

Query `migration.getDetailedWorkerStatus` saat ini hanya mengembalikan jumlah kasar (*job counts*): `waiting`, `active`, `completed`, `failed`, dan `delayed`.

Kekurangan yang dialami saat operasional:
- Tidak ada metrik **laju pemrosesan (throughput)**: Administrator tidak tahu berapa banyak job yang berhasil diselesaikan per menit secara real-time.
- Tidak ada **detektor job macet (Stall Detector)**: Jika sebuah job berstatus `active` terhenti selama lebih dari 3 menit (misalnya karena socket download menggantung tanpa timeout), sistem tidak membunyikan alarm visual.
- Tidak ada pencatatan **waktu eksekusi rata-rata per job (average execution latency)** yang teragregasi.

---

## 2. Rincian Pekerjaan & Spesifikasi Implementasi

### Langkah 1: Membangun In-Memory Circular Buffer Telemetry Tracker
Buat modul pelacak metrik antrean ringan (`src/server/queues/queueTelemetry.ts`):

```typescript
export interface QueueThroughputStats {
  queueName: string;
  throughputJobsPerMinute: number;
  averageExecutionDurationMs: number;
  totalCompletedInWindow: number;
  totalFailedInWindow: number;
  stalledJobsCount: number;
  stalledJobIds: string[];
  lastCompletedJobAt?: string;
  lastFailedJobAt?: string;
}
```

- Simpan sliding window 60 detik (array timestamp job selesai) untuk menghitung throughput aktual (jobs/menit).
- Pasang hook pada event completion worker:
  - Pada `ocrWorker.ts`, rekam durasi job saat selesai diproses.
  - Pada `importWorker.ts`, rekam progres per 1.000 baris.

### Langkah 2: Implementasi Sensor Job Macet (Stall Detector)
Buat fungsi pemeriksa berkala:
- Memeriksa job dengan status `active` pada `ocrQueue` dan `importQueue`.
- Jika `job.processedOn` melebihi 180.000 ms (3 menit) dan tidak ada pembaruan progres (`job.progress`), tandai sebagai **STALLED_JOB**.
- Sediakan indikator status: `isStalled: boolean` dan daftar `stalledJobIds`.

### Langkah 3: Perkaya Query tRPC `migration.getDetailedWorkerStatus`
Modifikasi prosedur `getDetailedWorkerStatus` pada [src/server/routers/migration.ts](file:///Users/a69/Desktop/goro-s2jb/src/server/routers/migration.ts):
- Tambahkan properti `throughput` dan `stallDetection` ke dalam respon `queues.import` dan `queues.ocr`.
- Sertakan metrik ini agar dapat langsung dikonsumsi oleh kartu UI di frontend.

---

## 3. Matriks Otorisasi & Hak Akses (RBAC: SUPER_ADMIN vs PEGAWAI)

| Aspek Fitur | SUPER_ADMIN | PEGAWAI (Operator / Verifikator) |
| :--- | :--- | :--- |
| **Kontrol Operasional Antrean** | Memiliki wewenang mutlak untuk melakukan tindakan: *Pause Queue*, *Resume Queue*, *Retry All Failed Jobs*, dan *Purge / Drain Stale Queue*. | **Hanya Baca (Read-Only)**. Seluruh tombol mutasi antrean disembunyikan atau dinonaktifkan demi mencegah gangguan operasional. |
| **Visibilitas Metrik Antrean** | Mengakses metrik diagnostik internal Redis: ID job yang macet (`stalledJobIds`), durasi eksekusi per job milidetik, dan kegagalan memory worker. | Mengakses indikator produktivitas ulasan di `/reviews`: jumlah ulasan tersisa di antrean, perkiraan waktu tunggu, dan throughput ulasan/menit. |
| **Penanganan Job Macet (Stall)** | Menerima peringatan merah ketika job terhenti > 180 detik dan dapat mengeksekusi reset job individual. | Menerima notifikasi transparan apabila batch ulasan sedang mengalami perlambatan pemrosesan tanpa akses intervensi Redis. |

---

## 4. Kriteria Keberhasilan & Skenario Pengujian (TDD)

Buat berkas pengujian `tests/unit/queueTelemetry.test.ts`:
1. **Uji Penghitungan Throughput:** Menyimulasikan penyelesaian 10 job dalam jendela 60 detik dan memverifikasi throughput bernilai 10 jobs/menit.
2. **Uji Pendeteksi Job Macet:** Menyimulasikan job aktif yang memiliki `processedOn` 4 menit lalu tanpa pembaruan progres, dan memastikan fungsi stall detector mengembalikan ID job tersebut.
3. **Uji Integrasi Router tRPC:** Memanggil `getDetailedWorkerStatus` dan memverifikasi objek telemetri throughput dan status stall hadir dalam skema respon.

---

## 5. Panduan Eksekusi Mandiri untuk Agent

```bash
# 1. Jalankan pengujian worker sebelumnya
npx vitest run tests/unit/workerManagement.test.ts

# 2. Implementasikan src/server/queues/queueTelemetry.ts
# 3. Integrasikan ke ocrWorker.ts, importWorker.ts, dan migration.ts
# 4. Buat dan jalankan tests/unit/queueTelemetry.test.ts
npx vitest run tests/unit/queueTelemetry.test.ts

# 5. Jalankan typecheck TypeScript
npx tsc --noEmit
```

