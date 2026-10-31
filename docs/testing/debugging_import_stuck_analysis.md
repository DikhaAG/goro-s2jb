# Laporan Investigasi dan Debugging: Kegagalan Impor Data (Hanya Menunggu)

Dokumen ini mencatat investigasi mendalam, analisis akar masalah teknis (*root cause analysis*), perbaikan kode sumber, serta verifikasi pengujian terhadap masalah proses impor berkas [100baris.csv](file:///Users/a69/Desktop/goro-s2jb/docs/testing/100baris.csv) yang tertahan pada status **"Menunggu" (WAITING / PENDING)** tanpa ada kemajuan.

---

## 1. Gejala dan Kronologi Masalah

### Gejala yang Dialami Pengguna
1. Pengguna mengunggah berkas [docs/testing/100baris.csv](file:///Users/a69/Desktop/goro-s2jb/docs/testing/100baris.csv) melalui antarmuka web migrasi data.
2. Sistem menampilkan status batch migrasi sebagai **Menunggu** (*WAITING / PENDING*).
3. Angka penghitung baris yang diproses (*processed rows*) tidak bertambah sama sekali (tetap 0).
4. Tidak ada indikasi aktivitas komputasi atau perubahan status menjadi *PROCESSING*, sehingga pengguna terpaksa membatalkan proses impor.

---

## 2. Investigasi Log dan Diagnostik Sistem

### A. Pemeriksaan Jejak Log Worker ([logs/worker_import.log](file:///Users/a69/Desktop/goro-s2jb/logs/worker_import.log))
Pemeriksaan pada log runtime worker impor menemukan galat fatal (*unhandled exception*) yang menyebabkan proses worker berhenti mendadak:

```text
node:events:497
      throw er; // Unhandled 'error' event
      ^

Error: ENOENT: no such file or directory, open '/Users/a69/Desktop/goro-s2jb/uploads/test_recovery_sample.csv'
Emitted 'error' event on ReadStream instance at:
    at emitErrorNT (node:internal/streams/destroy:170:8)
    at emitErrorCloseNT (node:internal/streams/destroy:129:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:82:21) {
  errno: -2,
  code: 'ENOENT',
  syscall: 'open',
  path: '/Users/a69/Desktop/goro-s2jb/uploads/test_recovery_sample.csv'
}
```

### B. Pemeriksaan Antrean Redis / BullMQ
Melalui skrip inspeksi antrean BullMQ:
1. Berkas unggahan pengguna tersimpan dengan benar di direktori penyimpanan:
   `uploads/migration/1793330654574_26d9ace4b707_100baris.csv` (ukuran 32.180 bytes, utuh dan valid).
2. Terdapat job baru dengan **Job ID 55** di antrean `import-queue` dengan status `waiting`.
3. Namun, **tidak ada satu pun instance worker aktif** yang mendengarkan (*listening*) atau mengonsumsi job dari antrean `import-queue`.

---

## 3. Analisis Akar Masalah Teknis (*Root Cause Analysis*)

Masalah ini terjadi akibat rantai kegagalan beruntun (*cascading failure*):

1. **Ketiadaan Error Handler pada Node.js `ReadStream`:**
   Pada fungsi `parseCsvStream` di [src/lib/parsers/csvStreamParser.ts](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/csvStreamParser.ts), pembacaan berkas menggunakan `fs.createReadStream(filePath)`. Stream ini langsung disambungkan (*piped*) ke `fast-csv` tanpa melampirkan event listener `.on("error")` pada instance stream asal.
2. **Crash Fatal Akibat ENOENT:**
   Ketika ada job uji pemulihan sebelumnya yang merujuk pada berkas yang telah dihapus (`test_recovery_sample.csv`), `fs.createReadStream` memancarkan event `error` dengan kode `ENOENT`. Di Node.js, event `error` pada EventEmitter yang tidak memiliki listener terdaftar akan memicu Unhandled Exception yang seketika mematikan proses (*process exit*).
3. **Worker Latar Belakang Mati Permanen:**
   Proses `importWorker` berhenti total. Ketika antarmuka pengguna mengirimkan job baru (Job ID 55 untuk `100baris.csv`), job berhasil masuk ke antrean Redis BullMQ, tetapi tidak ada worker hidup yang memprosesnya.
4. **Tampilan Antarmuka Tertahan:**
   Karena worker mati sebelum sempat menyentuh Job ID 55, status batch di basis data tetap `PENDING` / `WAITING`. Antarmuka pengguna terus menampilkan status menunggu tanpa batas waktu.

---

## 4. Langkah Perbaikan (*Debugging & Bug Fixes*)

Perbaikan dilakukan secara komprehensif pada level parser, penanganan worker, dan ketahanan proses:

### A. Pengamanan Parser CSV ([src/lib/parsers/csvStreamParser.ts](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/csvStreamParser.ts))
- Menambahkan pemeriksaan fisik keberadaan berkas `fs.existsSync(filePath)` sebelum membuat stream.
- Memasang event listener `stream.on("error", (err) => reject(err))` pada instance `fs.createReadStream` agar galat I/O ditangkap secara bersih sebagai penolakan *Promise* (*Promise rejection*) dan tidak meruntuhkan proses runtime.

### B. Pengamanan Parser Excel ([src/lib/parsers/xlsxStreamParser.ts](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/xlsxStreamParser.ts))
- Menambahkan validasi keberadaan berkas sebelum memanggil `ExcelJS.stream.xlsx.WorkbookReader`.

### C. Ketahanan Worker Impor ([src/server/workers/importWorker.ts](file:///Users/a69/Desktop/goro-s2jb/src/server/workers/importWorker.ts))
- Menambahkan pengecekan keberadaan berkas di awal eksekusi job. Jika berkas sumber tidak ditemukan:
  - Batch migrasi ditandai sebagai `FAILED` di basis data dengan pesan diagnostik yang informatif.
  - Job diselesaikan secara terkendali tanpa melempar unhandled error.
- Memasang listener `worker.on("error")` untuk mengisolasi kegagalan koneksi Redis atau BullMQ.
- Memasang handler keselamatan global `process.on("uncaughtException")` dan `process.on("unhandledRejection")` khusus untuk proses worker mandiri agar worker tetap aktif melayani antrean berikutnya meskipun terjadi galat tak terduga.

### D. Ketahanan Worker OCR ([src/server/workers/ocrWorker.ts](file:///Users/a69/Desktop/goro-s2jb/src/server/workers/ocrWorker.ts))
- Menerapkan pengamanan serupa (`worker.on("error")`, `uncaughtException`, dan `unhandledRejection`) untuk mencegah terhentinya proses validasi OCR saat memproses gambar yang rusak atau tautan Google Drive yang tidak dapat diakses.

---

## 5. Hasil Verifikasi dan Uji Coba

Setelah perbaikan diimplementasikan, seluruh komponen sistem diuji secara bertahap:

### A. Uji Ingesti Nyata dengan Berkas [100baris.csv](file:///Users/a69/Desktop/goro-s2jb/docs/testing/100baris.csv)
Uji coba dilakukan menggunakan antrean BullMQ aktif:
- **Batch ID:** `cmvuezzy500005q8zkid6m30w`
- **Job ID:** 56
- **Hasil:**
  - Status Akhir: `COMPLETED`
  - Total Baris Terproses: 187 baris (seluruh rekaman data dari berkas)
  - Total Gagal: 0
  - Durasi Ingesti: ~1.04 detik
  - Worker tetap stabil dan siap menerima pekerjaan berikutnya tanpa mengalami crash.

### B. Verifikasi Keseluruhan Suite Pengujian Sistem (`npm test`)
Seluruh rangkaian pengujian unit dan integrasi dijalankan:
- **Test Suites:** 45 passed, 45 total
- **Tests:** 291 passed, 291 total
- **Snapshots:** 0 total
- **Durasi Eksekusi:** 60.67 detik
- **Status:** Lolos 100% tanpa ada regresi.

### C. Verifikasi Kompilasi TypeScript (`npx tsc --noEmit`)
- Hasil kompilasi: Bersih (exit code 0), tidak ada galat tipe data.

---

## 6. Kesimpulan dan Rekomendasi Operasional

1. **Penyebab Utama:** Status "hanya menunggu" disebabkan oleh matinya proses latar belakang `importWorker` akibat unhandled `ENOENT` error saat mencoba membaca berkas yang tidak ada.
2. **Kondisi Terkini:** Seluruh parser dan worker kini telah terlindungi oleh mekanisme penanganan galat berlapis sehingga proses worker tidak akan mati ketika menemui berkas yang hilang atau rusak.
3. **Rekomendasi Pemeliharaan:**
   - Untuk lingkungan server produksi, disarankan menjalankan worker menggunakan process manager seperti `PM2` atau kontainerisasi (Docker) dengan restart policy `always` sebagai proteksi tambahan.
   - Menyediakan indikator *Worker Health / Heartbeat* pada dashboard sistem untuk memudahkan tim operasional memantau status keaktifan worker secara waktu nyata.
