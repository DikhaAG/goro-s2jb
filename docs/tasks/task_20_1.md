# Task 20.1: Telemetri, Diagnostik, & Pengerasan Jaringan Pengunduhan CDN / Google Drive

> **Status:** Completed ✅  
> **Inisiatif:** Arsitektur Monitoring Proses Latar Belakang & Jaringan (Fase 3)  
> **Fokus Utama:** Network I/O Observability, In-Memory Streaming Telemetry, Google Drive Failover, & Health Probe  
> **Target Berkas yang Dimodifikasi/Dibuat:**
> - [`src/server/services/evidenceDownloader.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/services/evidenceDownloader.ts)
> - [`src/server/services/ocrBridge.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/services/ocrBridge.ts)
> - [`src/app/api/health/route.ts`](file:///Users/a69/Desktop/goro-s2jb/src/app/api/health/route.ts)
> - [`src/components/operator/EvidenceLightbox.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/operator/EvidenceLightbox.tsx) (Indikator Status Unduhan Eviden Ramah Pengguna)
> - `tests/unit/evidenceDownloaderTelemetry.test.ts`
> **Aturan Khusus:** Bebas dari karakter Em Dash dan standar tipografi minimum font size >= 12px (`text-xs`).

---

## 1. Konteks Masalah & Kebutuhan Teknis

Subsistem pengunduhan eviden pada [src/server/services/evidenceDownloader.ts](file:///Users/a69/Desktop/goro-s2jb/src/server/services/evidenceDownloader.ts) bertanggung jawab mengalirkan citra bukti dari tautan eksternal (Google Drive / CDN) langsung ke memori RAM tanpa persistensi disk lokal untuk ulasan migrasi massal (*Zero-Storage architecture*).

Saat ini, fungsi `streamEvidenceImageBuffer()` telah memiliki:
- Parsing ID Google Drive (`extractGoogleDriveFileId`).
- Tiga endpoint kandidat alternatif (`getCandidateImageUrls`).
- Penyamaran header anti-bot (`User-Agent`).
- Pemeriksaan magic bytes citra (JPEG/PNG/WEBP).

Namun, sistem belum memiliki **pencatatan telemetri jaringan (network telemetry)** yang terukur secara real-time. Administrator tidak dapat memantau:
1. Rata-rata latensi unduhan per berkas citra dari Google Drive (dalam milidetik).
2. Volume total data biner yang dialirkan via in-memory stream (*total bytes streamed*).
3. Distribusi efektivitas 3 endpoint kandidat (apakah lebih sering sukses di Endpoint 1 UC, Endpoint 2 UserContent, atau Endpoint 3 LH3 CDN).
4. Tingkat kegagalan respon jaringan bukan citra (*magic bytes rejection rate* akibat halaman HTML error Google Drive).
5. Rasio cache hit pada `gdriveCache`.

---

## 2. Rincian Pekerjaan & Spesifikasi Implementasi

### Langkah 1: Membangun In-Memory Network Telemetry Recorder pada `evidenceDownloader.ts`
Tambahkan struktur data dan fungsi pengumpul metrik jaringan:

```typescript
export interface DownloaderNetworkMetrics {
  totalRequests: number;
  successfulStreams: number;
  failedStreams: number;
  totalBytesStreamed: number;
  averageLatencyMs: number;
  candidateHits: {
    endpointUc: number;
    endpointUserContent: number;
    endpointLh3: number;
    directUrl: number;
  };
  rejectionReasons: {
    htmlResponse: number;
    invalidMagicBytes: number;
    timeoutAbort: number;
    httpError: number;
  };
  cacheStats: {
    hits: number;
    misses: number;
    cachedEntriesCount: number;
  };
  lastIncident?: {
    timestamp: string;
    url: string;
    error: string;
  };
}
```

- Pasang stopwatch `Date.now()` di awal loop pengunduhan untuk menghitung latensi jaringan per request.
- Catat ukuran buffer respons ke dalam akumulator `totalBytesStreamed`.
- Rekam endpoint mana yang berhasil mengembalikan citra valid.
- Ekspor fungsi pembaca metrik: `export function getDownloaderNetworkMetrics(): DownloaderNetworkMetrics`.
- Ekspor fungsi reset metrik (untuk pengujian): `export function resetDownloaderMetrics(): void`.

### Langkah 2: Mengintegrasikan Metrik Jaringan ke `src/app/api/health/route.ts`
- Impor `getDownloaderNetworkMetrics()` ke dalam [src/app/api/health/route.ts](file:///Users/a69/Desktop/goro-s2jb/src/app/api/health/route.ts).
- Tambahkan blok `network_downloader` ke dalam respons JSON `/api/health`:
  ```json
  "network_downloader": {
    "status": "up",
    "total_requests": 1420,
    "successful_streams": 1398,
    "failed_streams": 22,
    "average_latency_ms": 312,
    "bytes_streamed_mb": 45.2,
    "cache_hit_rate_pct": 14.5
  }
  ```

### Langkah 3: Pengerasan Telemetri Loopback pada `src/server/services/ocrBridge.ts`
- Catat jumlah request yang berhasil dilayani melalui jalur utama HTTP REST (`http://127.0.0.1:8001`) dibandingkan dengan jalur fallback subprocess CLI (`ocrService.ts`).
- Ekspor fungsi `getOcrBridgeMetrics()` untuk mengetahui jika microservice Python sering mengalami kegagalan socket sehingga beralih ke CLI.

---

## 3. Matriks Otorisasi & Hak Akses (RBAC: SUPER_ADMIN vs PEGAWAI)

| Aspek Fitur | SUPER_ADMIN | PEGAWAI (Operator / Verifikator) |
| :--- | :--- | :--- |
| **Visibilitas Metrik Jaringan** | Akses penuh ke metrik raw: distribusi kandidat URL (UC vs UserContent vs LH3), rasio penolakan magic bytes, total byte dialirkan, dan status endpoint `/api/health`. | Hanya melihat indikator visual sederhana pada komponen antarmuka bukti (misal: "Koneksi CDN Optimal" atau "Latensi Jaringan Tinggi"). |
| **Interaksi Bukti Ulasan Gagal** | Menganalisis laporan insiden jaringan teknis (`lastIncident`) dan penyebab kegagalan HTTP (429 Rate Limit, 403 Forbidden, 404 Not Found). | Mendapatkan pesan status ramah di `EvidenceLightbox.tsx` (contoh: *"Tautan Google Drive privat atau file telah dihapus pengulas"*), serta tombol coba muat ulang gambar mandiri. |
| **Manajemen Cache & Konfigurasi** | Berhak memanggil `resetDownloaderMetrics()` dan mengonfigurasi strategi traversal endpoint CDN. | Tidak memiliki akses ke manajemen cache atau konfigurasi jaringan sistem. |

---

## 4. Kriteria Keberhasilan & Skenario Pengujian (TDD)

Buat berkas pengujian baru `tests/unit/evidenceDownloaderTelemetry.test.ts`:
1. **Uji Akumulasi Metrik Unduhan:** Memanggil `streamEvidenceImageBuffer()` dengan mocking fetch dan memastikan `totalRequests`, `successfulStreams`, dan `averageLatencyMs` tercatat akurat.
2. **Uji Pelacakan Endpoint Kandidat:** Memverifikasi jika endpoint 1 gagal dan endpoint 2 sukses, counter `candidateHits.endpointUserContent` bertambah 1.
3. **Uji Penolakan Magic Bytes:** Memverifikasi jika server mengembalikan teks HTML, counter `rejectionReasons.htmlResponse` bertambah dan buffer tidak dialirkan ke OCR.
4. **Uji Keterpaduan Health Route:** Memastikan endpoint `/api/health` merespons status 200 dan menyertakan objek `network_downloader`.

---

## 5. Panduan Eksekusi Mandiri untuk Agent

```bash
# 1. Jalankan pengujian awal
npx vitest run tests/ocr_service.test.ts

# 2. Modifikasi src/server/services/evidenceDownloader.ts dan src/server/services/ocrBridge.ts
# 3. Perbarui src/app/api/health/route.ts
# 4. Buat dan jalankan tests/unit/evidenceDownloaderTelemetry.test.ts
npx vitest run tests/unit/evidenceDownloaderTelemetry.test.ts

# 5. Jalankan typecheck TypeScript
npx tsc --noEmit
```

