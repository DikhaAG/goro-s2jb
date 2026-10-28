# Task 14: Pemantau Progres Interaktif Migrasi Data (/migration) & Penguncian Sesi Keluar Akun Multi-Layer

> **Status:** Proposed / Ready for Execution 📋  
> **Fase:** 3 (Manajemen Migrasi Data Historis Masif, Interaksi UI/UX Real-Time & Keamanan Sesi)  
> **Target Audiens:** Frontend UI/UX Engineer, Full-Stack Engineer, QA Automation Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Modul 4.1: Sistem Migrasi Historis Masif & Standar Integritas Data)
> - [`DESIGN.md`](file:///Users/a69/Desktop/goro-s2jb/DESIGN.md) (Modern Utility Minimalism & Aksesibilitas Kontras WCAG AA)
> - [`docs/tasks/task_2.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_2.md) (Bulk Data Migration Engine & BullMQ Worker)
> - [`docs/tasks/task_8.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_8.md) (Sistem Desain, GlobalSidebar & Navigasi Responsif)
> - [`docs/tasks/task_13.md`](file:///Users/a69/Desktop/goro-s2jb/docs/tasks/task_13.md) (Otorisasi Fitur Migrasi untuk Pegawai & Super Admin)
> - [`.agents/skills/antislop/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop/SKILL.md) (Core Anti-Slop Filter)
> - [`.agents/skills/antislop-ui/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-ui/SKILL.md) (Desain UI Utilitas & Komponen Status)
> - [`.agents/skills/antislop-layoutmobile/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-layoutmobile/SKILL.md) (Breakpoints Mobile & Tap Target >= 44px)
> - [`.agents/skills/antislop-human/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/antislop-human/SKILL.md) (Aksesibilitas ARIA Live & Kontras WCAG AA)
> - [`.agents/skills/working-with-spreadsheets/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/working-with-spreadsheets/SKILL.md) (Penanganan Berkas Spreadsheet Skala Besar)
> - [`.agents/skills/tdd/SKILL.md`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/SKILL.md) (Test-Driven Development)

---

## 1. Ringkasan & Latar Belakang Masalah

Pada alur operasional PLN UID S2JB, berkas impor historis (*Form Responses 1* dan rekap laporan bulanan) memiliki ukuran masif hingga lebih dari 143.000 baris. Proses pemrosesan melalui BullMQ worker dan parser streaming memerlukan waktu beberapa menit untuk menyelesaikan validasi relasi unit, deduplikasi, dan pencatatan entri ulasan ke basis data PostgreSQL.

Terdapat dua celah kritis yang perlu diselesaikan:
1. **Kekurangan Umpan Balik Visual Progres (UI/UX Slop):**
   * Antarmuka lama pada [`src/components/admin/BulkDropzone.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/admin/BulkDropzone.tsx) masih menggunakan palet gelap lama (`#0d1424`), gradien oranye-cyan generik, dan ikon generik yang tidak selaras dengan standar Modern Utility Minimalism.
   * Tidak tersedia bilah kemajuan (*progress bar*) visual dengan persentase capaian yang dinamis dan estimasi baris tersisa, sehingga pengguna tidak mengetahui sejauh mana berkas telah diproses.
2. **Risiko Pemutusan Sesi (Accidental Logout / Disconnection):**
   * Apabila pengguna menekan tombol "Keluar dari Sesi" pada [`GlobalSidebar.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/GlobalSidebar.tsx) atau menutup tab browser saat proses migrasi masih berjalan (`status === "PROCESSING"`), sesi otentikasi dapat terputus, memicu *orphaned job*, serta menghilangkan kendali pemantauan pengguna atas proses impor data.

---

## 2. Tujuan Teknis Task 14

1. **Antarmuka Pemantau Progres Real-Time & Interaktif:**
   * Menampilkan bilah kemajuan (*Progress Bar*) bertaraf utilitas dengan transisi pengisian halus, persentase penyelesaian numerik yang akurat, serta atribut aksesibilitas lengkap (`role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-live="polite"`).
   * Menyajikan metrik taktis real-time:
     - **Baris Berhasil:** Jumlah akumulasi baris yang sukses disimpan ke basis data (format separator ribuan Indonesia `toLocaleString("id-ID")`).
     - **Baris Gagal:** Jumlah baris cacat yang diisolasi ke `MigrationErrorLog` tanpa menghentikan worker.
     - **Total Baris & Persentase:** Kalkulasi rasio baris selesai terhadap total baris berkas.
     - **Kecepatan Proses (Throughput):** Estimasi kecepatan pemrosesan (misal: `~1.850 baris/detik`) dan waktu berjalan (*elapsed time*).
2. **Penguncian Sesi Keluar Akun (*Session Logout Locking*):**
   * Selama status migrasi berada dalam fase `PROCESSING` atau `PENDING` (maupun saat berkas fisik sedang diunggah):
     - Tombol "Keluar dari Sesi" pada [`GlobalSidebar.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/GlobalSidebar.tsx) dan [`MobileNavDrawer.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/MobileNavDrawer.tsx) dinonaktifkan (*disabled*) secara visual dan fungsional.
     - Terdapat indikator gembok proteksi dan lencana peringatan: *"Sesi Terkunci: Migrasi Data Sedang Berjalan"*.
     - Jika pengguna mencoba memicu aksi keluar, sistem menampilkan modal konfirmasi taktis yang melarang pemutusan sesi hingga proses impor tuntas.
   * Perlindungan tingkat API: Endpoint `POST /api/auth/logout` menolak pembatalan sesi jika terdeteksi batch migrasi aktif milik pengguna yang sedang berjalan, kecuali diberikan parameter konfirmasi paksa (*force cancel*).
3. **Perlindungan Penutupan Halaman (*Tab Unload Guard*):**
   * Menerapkan listener event `window.beforeunload` untuk mencegah penutupan tab atau reload browser yang tidak disengaja saat proses migrasi sedang aktif.
4. **Penyelarasan Desain Utilitas Modern (Anti-Slop Hardening):**
   * Mengganti seluruh palet gelap usang pada [`BulkDropzone.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/admin/BulkDropzone.tsx) menjadi kanvas bersih putih `#ffffff`, batas tepi lembut `#e2e8f0`, aksen primer Teal PLN `#006877` / `#00a2b9`, dan teks karbon kontras tinggi `#0f172a`.
   * Menghilangkan ikon sparkle/magic generik dan melarang penggunaan tanda baca em dash di seluruh antarmuka.

---

## 3. Struktur Sub-Task Hierarkis

* **Task 14.1:** Penyempurnaan Skema tRPC & Worker untuk Pelacakan Total Baris & Metrik Real-Time
* **Task 14.2:** Pembuatan Global Context & Hook Penguncian Sesi (`MigrationGuardContext.tsx`, `useMigrationGuard.ts`)
* **Task 14.3:** Refaktorisasi Antarmuka Dasbor `/migration` ke Desain Utilitas & Bilah Kemajuan Interaktif
* **Task 14.4:** Penegakan Penguncian Logout pada `GlobalSidebar`, `MobileNavDrawer`, dan Route Handler `/api/auth/logout`
* **Task 14.5:** Implementasi Pelindung Tab Browser (`beforeunload`) & Dialog Peringatan Navigasi
* **Task 14.6:** Otomasi Pengujian TDD Unit & Integrasi (Progress Bar, Logout Lock, Error Recovery)

---

## 4. Instruksi Teknis Rinci

### 4.1 Task 14.1: Penyempurnaan Skema tRPC & Worker untuk Pelacakan Total Baris
1. **Target Berkas:**
   * [`src/server/routers/migration.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/routers/migration.ts)
   * [`src/server/workers/importWorker.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/workers/importWorker.ts)
   * [`src/lib/parsers/csvStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/csvStreamParser.ts)
   * [`src/lib/parsers/xlsxStreamParser.ts`](file:///Users/a69/Desktop/goro-s2jb/src/lib/parsers/xlsxStreamParser.ts)
2. **Spesifikasi Teknis:**
   * **Deteksi / Estimasi Total Baris Awal:**
     - Pada berkas `.xlsx`, manfaatkan properti `worksheet.rowCount` untuk langsung mengisi field `totalRows` pada tabel `MigrationBatch` saat worker mulai berjalan.
     - Pada berkas `.csv`, jalankan penghitungan baris cepat (*newline counter streaming*) atau estimasi berdasarkan ukuran berkas rata-rata agar pembagi persentase progres dapat segera diketahui oleh antarmuka pengguna.
   * **Prosedur tRPC `migration.getActiveBatch`:**
     - Sediakan kueri tRPC baru `getActiveBatch: operatorProcedure.query(...)` yang memeriksa apakah terdapat batch dengan status `PROCESSING` atau `PENDING` yang terkait dengan pengguna atau sistem secara umum.
   * **Pemutakhiran Prosedur `migration.getBatchStatus`:**
     - Mengembalikan data `totalRows`, `processedRows`, `failedRows`, `startedAt`, `completedAt`, dan persentase terhitung `progressPercentage = totalRows > 0 ? Math.min(100, Math.round((processedRows / totalRows) * 100)) : 0`.

---

### 4.2 Task 14.2: Pembuatan Global Context & Hook Penguncian Sesi
1. **Target Berkas:**
   * `src/context/MigrationGuardContext.tsx`
   * `src/hooks/useMigrationGuard.ts`
2. **Spesifikasi Arsitektur:**
   * Buat `MigrationGuardProvider` yang membungkus komponen aplikasi:
     ```typescript
     interface MigrationGuardState {
       isMigrationActive: boolean;
       activeBatchId: string | null;
       activeFileName: string | null;
       processedRows: number;
       totalRows: number;
       progressPercentage: number;
       setMigrationState: (state: Partial<MigrationGuardState>) => void;
       clearMigrationState: () => void;
     }
     ```
   * Melakukan sinkronisasi otomatis dengan kueri tRPC `migration.getActiveBatch` untuk menjaga konsistensi status bahkan jika pengguna melakukan penyegaran halaman.

---

### 4.3 Task 14.3: Refaktorisasi Antarmuka Dasbor `/migration` & Bilah Kemajuan Interaktif
1. **Target Berkas:**
   * [`src/app/(operator)/migration/page.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/app/(operator)/migration/page.tsx)
   * [`src/components/admin/BulkDropzone.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/admin/BulkDropzone.tsx)
2. **Spesifikasi Visual & Komponen Progress Bar (Modern Utility Minimalism):**
   * **Struktur Kartu Utama:**
     - Kanvas putih `#ffffff`, border 1px solid `#e2e8f0`, sudut membulat `rounded-2xl`, elevasi halus `shadow-xs`.
     - Header kartu memuat judul operasional tebal *"Migrasi Berkas Historis (CSV / XLSX)"*, deskripsi fungsional singkat, dan lencana status penugasan unit.
   * **Elemen Bilah Kemajuan (*Interactive Progress Bar*):**
     - Track latar belakang: `h-3 w-full bg-[#f1f5f9] rounded-full overflow-hidden border border-[#e2e8f0]`.
     - Fill bar: `h-full bg-gradient-to-r from-[#006877] to-[#00a2b9] transition-all duration-300 ease-out rounded-full`.
     - Atribut Aksesibilitas WCAG:
       `role="progressbar" aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100} aria-label="Kemajuan migrasi rekam data historis"`
     - Teks Progres Berdampingan:
       - Sisi Kiri: Nilai persentase besar tebal font Inter (contoh: `74% Selesai`).
       - Sisi Kanan: Rincian baris numerik monospaced (contoh: `105.820 dari 143.000 baris`).
   * **Grid Metrik Taktis (4 Kolom Utilitas):**
     1. **Baris Sukses:** Angka hijau tebal `#15803d` dengan latar pastel `#f0fdf4` dan border `#bbf7d0`.
     2. **Baris Gagal (Anomali):** Angka merah tebal `#b91c1c` dengan latar pastel `#fef2f2` dan border `#fecaca`.
     3. **Kecepatan Impor:** Indikator numerik kecepatan pemrosesan (misal: `1.920 baris/dtk`).
     4. **Status Worker:** Lencana status aktif dengan animasi denyut halus (*pulsing indicator*) warna teal saat aktif, hijau solid saat tuntas, merah solid saat gagal.
   * **Accordion Pratinjau Error Baris:**
     - Jika terdapat error, tampilkan ringkasan tabel error baris dengan nomor baris dan alasan validasi (misal: format tanggal tidak valid, unit ULP tidak dikenali).

---

### 4.4 Task 14.4: Penegakan Penguncian Logout Multi-Layer
1. **Target Berkas:**
   * [`src/components/layout/GlobalSidebar.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/GlobalSidebar.tsx)
   * [`src/components/layout/MobileNavDrawer.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/layout/MobileNavDrawer.tsx)
   * [`src/app/api/auth/logout/route.ts`](file:///Users/a69/Desktop/goro-s2jb/src/app/api/auth/logout/route.ts)
   * [`src/server/routers/auth.ts`](file:///Users/a69/Desktop/goro-s2jb/src/server/routers/auth.ts)
2. **Pencegahan di Tingkat Klien (UI Guard):**
   * Jika `isMigrationActive === true`:
     - Tombol keluar di footer sidebar diubah menjadi mode terkunci:
       ```tsx
       <button
         type="button"
         disabled={true}
         aria-disabled="true"
         className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] cursor-not-allowed opacity-80 min-h-[44px]"
       >
         <Lock className="w-4 h-4 text-[#d97706]" />
         <span>Sesi Terkunci (Migrasi Aktif)</span>
       </button>
       ```
     - Tambahkan pesan keterangan mini di bawah tombol: *"Keluar akun dinonaktifkan sementara untuk menjaga stabilitas impor data."*
3. **Pencegahan di Tingkat API (Defense-in-Depth Server Guard):**
   * Di dalam route handler `POST /api/auth/logout` dan mutasi tRPC `auth.logout`:
     - Periksa apakah pengguna yang meminta logout memiliki batch pada tabel `MigrationBatch` dengan status `PROCESSING` atau `PENDING` yang dimulai dalam kurun waktu 1 jam terakhir.
     - Jika ada dan request tidak menyertakan header/parameter override `force=true`, tolak permintaan dengan respons:
       `HTTP 423 Locked` atau `NextResponse.json({ error: "Sesi tidak dapat diakhiri saat proses migrasi data sedang berjalan." }, { status: 423 })`.

---

### 4.5 Task 14.5: Perlindungan Penutupan Tab Browser & Dialog Peringatan
1. **Target Berkas:**
   * `src/components/migration/MigrationBeforeUnloadGuard.tsx`
   * `src/components/migration/ActiveMigrationWarningModal.tsx`
2. **Spesifikasi Teknis:**
   * **Browser Native Unload Guard:**
     - Daftarkan event listener `beforeunload` saat migrasi aktif:
       ```typescript
       window.addEventListener("beforeunload", (event) => {
         event.preventDefault();
         event.returnValue = "Proses migrasi data sedang berlangsung. Menutup tab akan menghentikan pemantauan impor data.";
         return event.returnValue;
       });
       ```
   * **In-App Navigation Interception:**
     - Jika pengguna mengklik tautan menu lain di sidebar (misal berpindah ke `/triage` atau `/reports`) saat migrasi aktif, tampilkan dialog konfirmasi halus:
       *"Proses migrasi masih berjalan di latar belakang. Anda dapat berpindah halaman, namun dilarang menutup browser atau keluar dari akun."*

---

### 4.6 Task 14.6: Otomasi Pengujian TDD Unit & Integrasi
1. **Target Berkas Pengujian:**
   * `tests/unit/migrationProgressBar.test.tsx`
   * `tests/unit/migrationLogoutLock.test.tsx`
   * `tests/integration/migrationWorkerProgress.test.ts`
   * `tests/integration/logoutProtectionSecurity.test.ts`
2. **Skenario Pengujian Wajib:**
   * **Test 1 (Progress Bar Calculation Seam):** Memverifikasi formula perhitungan persentase baris sukses terhadap total baris menghasilkan nilai bulat 0% s/d 100% tanpa NaN atau overflow.
   * **Test 2 (Accessible Attributes Seam):** Memverifikasi elemen progress bar memuat atribut `role="progressbar"`, `aria-valuenow`, dan `aria-live="polite"`.
   * **Test 3 (Logout Button Disabled Seam):** Memverifikasi tombol logout di `GlobalSidebar` berstatus `disabled` dan memiliki teks penanda kunci saat batch migrasi berstatus `PROCESSING`.
   * **Test 4 (Server Logout Rejection Seam):** Memverifikasi pemanggilan endpoint `POST /api/auth/logout` mengembalikan status `423 Locked` jika ada batch migrasi aktif.
   * **Test 5 (BeforeUnload Event Seam):** Memverifikasi event `beforeunload` terpasang saat migrasi dimulai dan dibersihkan (*cleaned up*) saat migrasi tuntas (`COMPLETED` atau `FAILED`).
   * **Test 6 (Anti-Slop Compliance Seam):** Memverifikasi tidak ada karakter em dash (Unicode \u2014) pada seluruh teks antarmuka dan rasio kontras warna progress bar memenuhi WCAG AA (>= 4.5:1).

---

## 5. Matriks Perilaku Sistem & Penanganan Status Sesi

| Status Migrasi | Status Tombol Logout | Perilaku Endpoint `/api/auth/logout` | Status Bilah Kemajuan (*Progress Bar*) | Listener `beforeunload` |
| :--- | :--- | :--- | :--- | :--- |
| **IDLE** (Belum Ada Berkas) | Aktif (Normal) | Diizinkan (`200 OK`) | Tersembunyi | Tidak Aktif |
| **UPLOADING** (Unggah Fisik) | **Terkunci (Disabled)** | Ditolak (`423 Locked`) | Menampilkan status unggah berkas | **Aktif** |
| **PENDING** (Antrean Worker) | **Terkunci (Disabled)** | Ditolak (`423 Locked`) | Menampilkan indikator antrean aktif | **Aktif** |
| **PROCESSING** (Sedang Streaming) | **Terkunci (Disabled)** | Ditolak (`423 Locked`) | **Aktif: persentase & baris sukses berjalan** | **Aktif** |
| **COMPLETED** (Tuntas Sukses) | Aktif Kembali | Diizinkan (`200 OK`) | Statis 100% (Hijau Sukses Solid) | Dilepas (Nonaktif) |
| **FAILED** (Gagal / Berhenti) | Aktif Kembali | Diizinkan (`200 OK`) | Statis Merah (Laporan Error Siap Unduh) | Dilepas (Nonaktif) |

---

## 6. Kriteria Keberhasilan & Verifikasi Penerimaan

- [ ] Bilah kemajuan (*Progress Bar*) pada halaman `/migration` tampil secara interaktif saat proses impor berjalan dengan animasi pengisian mulus.
- [ ] Angka akumulasi baris sukses, baris gagal, dan total baris terbarui secara dinamis tanpa jeda atau kedipan layar (*flicker*).
- [ ] Tombol "Keluar dari Sesi" pada bilah navigasi desktop dan laci navigasi mobile terkunci (*disabled*) dengan label jelas saat migrasi aktif.
- [ ] Endpoint `POST /api/auth/logout` menolak permintaan penghentian sesi saat proses impor data sedang berlangsung.
- [ ] Dialog konfirmasi browser pemicu event `beforeunload` aktif saat pengguna mencoba menutup tab di tengah proses impor.
- [ ] Desain kartu dan kontrol antarmuka mematuhi standar Modern Utility Minimalism (latar putih, border lembut, palet teal/slate, target tap >= 44px).
- [ ] Bebas dari karakter em dash (Unicode \u2014) di seluruh teks UI, kode, dan komentar.
- [ ] Seluruh suite pengujian otomatis (`npm test`) lulus 100% tanpa regresi.
