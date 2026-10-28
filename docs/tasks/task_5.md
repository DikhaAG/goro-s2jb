# Task 5: Modul Laporan Eksekutif (Pusat Agregasi)

> **Status:** Draft / Ready for Engineering Execution  
> **Fase:** 2 (Modul Fitur Utama - Modul 4.4 PRD)  
> **Target Audiens:** Data Engineer, Backend Engineer, Frontend Engineer  
> **Referensi Wajib:**
> - [`docs/PRD.md`](file:///Users/a69/Desktop/goro-s2jb/docs/PRD.md) (Bagian 1.2: Inkonsistensi Historis Target Kinerja, Bagian 4.4: Modul Laporan Eksekutif, Bagian 5: RBAC Role Manager)
> - [`docs/GORO S2JB 2026 (Jawaban).xlsx`](file:///Users/a69/Desktop/goro-s2jb/docs/GORO%20S2JB%202026%20%28Jawaban%29.xlsx) (Sheet *LAPORAN HARIAN H-1*, *LAPORAN HARIAN*, dan *LAPORAN BULANAN*)
> - [`.agents/skills/working-with-spreadsheets/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/working-with-spreadsheets/)
> - [`.agents/skills/xlsx/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/xlsx/)
> - [`.agents/skills/frontend-design/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/frontend-design/)
> - [`.agents/skills/tdd/`](file:///Users/a69/Desktop/goro-s2jb/.agents/skills/tdd/)

---

## 1. Ringkasan & Tujuan Task

Membangun **Modul Laporan Eksekutif (Pusat Agregasi)** yang berfungsi sebagai pusat intelijen operasional untuk **Role MANAGER (Komandan / Eksekutif)** dan pemangku kepentingan UID S2JB.

Modul ini bertugas menggantikan seluruh beban penyusunan manual lembar kerja *Laporan Harian*, *Laporan Harian H-1*, dan *Laporan Bulanan* yang sebelumnya harus dibuat sendiri oleh pegawai dari lembar mentah *Form Responses 1*.

Selain mengotomatisasi kalkulasi agregasi secara *real-time*, modul ini **mengatasi titik lemah kritis nomor 3 pada sistem lama (PRD Bagian 1.2)**: pada spreadsheet lama, jika ada penyesuaian target harian ULP di tengah periode pada formula spreadsheet manual, formula spreadsheet manual sering menimpa (*overwrite*) dan merusak riwayat persentase capaian kumulatif di bulan-bulan sebelumnya. Sistem baru menerapkan prinsip **Immutabilitas Riwayat Target (Target History Immutability)** sehingga rekapitulasi performa lampau terkunci secara permanen dan mutlak akurat.

---

## 2. Struktur Sub-Task Hierarkis

* **Task 5.1:** Mesin Agregasi & Logika Kalkulasi Metrik Immutabel (Daily, H-1, dan Kumulatif)
* **Task 5.2:** Antarmuka Dasbor Eksekutif Manajerial (`/manager/reports`)
* **Task 5.3:** Visualisasi Tren & Grafik Performa ULP (Target vs Realisasi)
* **Task 5.4:** Mesin Ekspor Otomatis Berkas Resmi (.xlsx Baku Berformula & Ringkasan .pdf)

---

## 3. Instruksi Teknis Rinci

### 3.1 Task 5.1: Mesin Agregasi & Logika Kalkulasi Metrik Immutabel
1. **Target File:**
   * `src/server/services/reportService.ts`
   * `src/server/routers/report.ts`
2. **Formula Kalkulasi Baku (Mereplikasi Struktur Excel Asli):**
   * **Realisasi Harian ($R_H$):**
     $$\text{Count}(\text{RatingReview}) \quad \text{di mana} \quad \text{ulpId} = U, \; \text{entryDate} = D, \; \text{validationStatus} = \text{"APPROVED"}$$
   * **Target Harian ($T_H$):** Nilai target yang tercatat di tabel `TargetMaster` untuk ULP $U$ pada tanggal $D$.
   * **Persentase Harian ($\%_H$):**
     $$\%_H = \begin{cases} \frac{R_H}{T_H} \times 100\% & \text{jika } T_H > 0 \\ 0.0\% & \text{jika } T_H = 0 \end{cases}$$
   * **Realisasi Kumulatif ($R_K$):** Akumulasi seluruh ulasan tervalidasi (`APPROVED`) dari tanggal 1 bulan berjalan ($D_1$) hingga tanggal yang dipilih ($D_n$).
   * **Target Kumulatif ($T_K$):** Akumulasi target harian dari tanggal 1 ($D_1$) hingga tanggal $D_n$.
   * **Persentase Kumulatif ($\%_K$):**
     $$\%_K = \begin{cases} \frac{R_K}{T_K} \times 100\% & \text{jika } T_K > 0 \\ 0.0\% & \text{jika } T_K = 0 \end{cases}$$
   * **Status Keterangan:**
     $$\text{Status} = \begin{cases} \text{"TERCAPAI"} & \text{jika } \% \ge 100\% \text{ (atau } R \ge T) \\ \text{"TIDAK TERCAPAI"} & \text{jika } \% < 100\% \end{cases}$$
3. **Immutabilitas Target & Proteksi Historis:**
   * Setiap record target diikat pada tanggal spesifik (`targetDate`).
   * Jika manajer mengubah target di tengah bulan atau untuk masa depan, query laporan hanya membaca snapshot target yang aktif pada tanggal historis terkait tanpa pernah menimpa riwayat target masa lalu.

---

### 3.2 Task 5.2: Antarmuka Dasbor Eksekutif Manajerial (`/manager/reports`)
1. **Target Rute:** `src/app/(manager)/reports/page.tsx`
2. **Proteksi Otorisasi (RBAC):**
   * Prosedur tRPC menggunakan `executiveProcedure` yang hanya mengizinkan role `MANAGER` dan `SUPER_ADMIN`. Role `PEGAWAI` dan `PETUGAS_LAPANGAN` ditolak keras.
3. **Executive KPI Overview Cards (Tingkat UID S2JB):**
   * **Total Realisasi Kumulatif:** Jumlah total ulasan `APPROVED` se-UID S2JB bulan berjalan.
   * **Persentase Capaian Kumulatif UID:** Rata-rata capaian kumulatif seluruh unit.
   * **Leaderboard Top 3 ULP:** ULP dengan persentase capaian tertinggi (misal: ULP RIVAI - 112%).
   * **Underperforming Bottom 3 ULP:** ULP dengan deviasi target terbesar untuk perhatian intervensi manajerial.
4. **Tampilan Tiga Tab Pelaporan (Menggantikan 3 Sheet Manual Pegawai):**
   * **Tab 1: Laporan Harian (Hari Ini / Tanggal Dipilih):** Menampilkan grid tabel seluruh ULP dengan kolom: `NO`, `NAMA ULP`, `TARGET HARIAN`, `REALISASI HARIAN`, `% HARIAN`, `KETERANGAN`.
   * **Tab 2: Laporan Harian H-1 (Kemarin):** Menampilkan rekapan status hari sebelumnya untuk bahan briefing manajer di pagi hari.
   * **Tab 3: Laporan Bulanan (Kumulatif 1 s/d Akhir Bulan):** Menampilkan perbandingan kumulatif lengkap: `TARGET KUMULATIF`, `REALISASI KUMULATIF`, `% KUMULATIF`, dan `STATUS CAPAIAN`.

---

### 3.3 Task 5.3: Visualisasi Tren & Grafik Performa ULP
1. **Target File:**
   * `src/components/manager/PerformanceChart.tsx`
   * `src/components/manager/CumulativePacingChart.tsx`
2. **Komponen Visualisasi Data:**
   * **Bar Chart Komparasi Harian:** Grafik batang interaktif membandingkan Realisasi vs Target untuk setiap ULP pada UP3 yang dipilih (dikelompokkan per UP3 PALEMBANG, UP3 OGAN ILIR, dll.).
   * **Line Chart Laju Kumulatif (Pacing Chart):** Memvisualisasikan laju kurva capaian riil harian dari tanggal 1 hingga akhir bulan terhadap garis linier target bulanan (membantu manajer memprediksi apakah target akhir bulan akan tercapai).
   * Styling visual mengikuti arahan `.agents/skills/frontend-design/`: palet warna navy korporat, aksen cyan untuk realisasi, dan garis putus-putus amber untuk garis target.

---

### 3.4 Task 5.4: Mesin Ekspor Otomatis Berkas Resmi (.xlsx & .pdf)
1. **Target File:**
   * `src/lib/export/excelExporter.ts`
   * `src/lib/export/pdfExporter.ts`
   * `src/app/api/export/excel/route.ts`
   * `src/app/api/export/pdf/route.ts`
2. **Kepatuhan Standar Excel (.agents/skills/xlsx/ & working-with-spreadsheets/):**
   * Format berkas `.xlsx` hasil unduhan harus mempertahankan susunan header resmi:
     - Judul: `MONITORING REALISASI ENTRI RATING PADA APLIKASI GORO`
     - Sub-judul: `UID SUMATERA SELATAN, JAMBI DAN BENGKULU`
     - Periode: `BULAN [NAMA_BULAN] [TAHUN]`
   * **Kaidah Formula Otentik:** Cell ringkasan total dan persentase **WAJIB menggunakan formula Excel**, BUKAN angka mati yang di-hardcode:
     - Formula penjumlahan: `=SUM(D9:D40)`
     - Formula persentase: `=E9/D9` dengan format sel persentase `0.0%`
     - Formula keterangan: `=IF(F9>=1,"TERCAPAI","TIDAK TERCAPAI")`
   * **Standar Tipografi & Warna:** Font Arial/Calibri, header sel berwarna biru korporat (#1E3A8A) dengan teks putih tebal, zebra-striping halus, dan batas border sel tipis yang rapi.
3. **Ekspor Ringkasan Eksekutif PDF:**
   * Menghasilkan dokumen 1-2 halaman bertaraf korporat siap cetak dengan logo PLN, tabel rekapitulasi performa per UP3, dan ringkasan eksekutif untuk laporan ke pimpinan wilayah.

---

## 4. Kriteria Penerimaan (Acceptance Criteria)

- [ ] **AC-1 (RBAC Security Guard):** Rute `/manager/reports` dan endpoint API ekspor hanya dapat diakses oleh role `MANAGER` dan `SUPER_ADMIN`. Akses dari role lain ditolak dengan respon HTTP 403.
- [ ] **AC-2 (Mathematical Precision):** Nilai Realisasi Harian, H-1, dan Kumulatif pada aplikasi 100% identik dengan hasil kalkulasi manual pada berkas acuan `docs/GORO S2JB 2026 (Jawaban).xlsx`.
- [ ] **AC-3 (Zero Division Safeguard):** Perhitungan persentase pada ULP yang memiliki target 0 menghasilkan nilai `0.0%` tanpa error `NaN`, `Infinity`, atau crash server.
- [ ] **AC-4 (Target Immutability):** Penyesuaian nilai target di masa kini/depan tidak mengubah atau merusak kalkulasi persentase pada tanggal-tanggal di masa lalu.
- [ ] **AC-5 (Executive UI Fluidity):** Dasbor dapat beralih antara Tab Laporan Harian, H-1, dan Bulanan secara instan, serta mendukung filter dropdown UP3/ULP dan pemilih bulan.
- [ ] **AC-6 (Flawless Excel Export):** Berkas `.xlsx` yang diunduh dapat dibuka di Microsoft Excel tanpa peringatan *corrupt*, mempertahankan susunan layout resmi lama, dan sel persentase/total menggunakan formula aktif Excel (`=SUM`, `=IF`).
- [ ] **AC-7 (Print-Ready PDF Export):** Ekspor PDF menghasilkan dokumen formal dengan tata letak bersih dan proporsional tanpa elemen terpotong.
- [ ] **AC-8 (Pacing Visualization):** Grafik laju kumulatif menampilkan garis tren capaian terhadap target dari tanggal 1 hingga akhir bulan secara akurat.

---

## 5. Matriks Berkas yang Dibuat / Diubah

| Jalur Berkas | Aksi | Deskripsi Perubahan |
| :--- | :--- | :--- |
| `src/app/(manager)/reports/page.tsx` | Dibuat | Halaman utama dasbor eksekutif manajerial |
| `src/components/manager/ExecutiveKpiCards.tsx`| Dibuat | Kartu metrik tingkat wilayah UID S2JB dan leaderboard ULP |
| `src/components/manager/ReportTableDaily.tsx` | Dibuat | Tabel laporan realisasi harian (mereplikasi LAPORAN HARIAN) |
| `src/components/manager/ReportTableH1.tsx` | Dibuat | Tabel laporan H-1 (mereplikasi LAPORAN HARIAN H-1) |
| `src/components/manager/ReportTableMonthly.tsx`| Dibuat | Tabel kumulatif bulanan (mereplikasi LAPORAN BULANAN) |
| `src/components/manager/PerformanceChart.tsx` | Dibuat | Visualisasi grafik batang komparasi realisasi vs target per ULP |
| `src/components/manager/CumulativePacingChart.tsx`| Dibuat | Visualisasi kurva laju kumulatif bulanan terhadap target |
| `src/server/services/reportService.ts` | Dibuat | Mesin logika agregasi database (Harian, H-1, Kumulatif) |
| `src/server/routers/report.ts` | Dibuat | Prosedur tRPC untuk data laporan eksekutif |
| `src/lib/export/excelExporter.ts` | Dibuat | Engine pembuat berkas .xlsx dengan formula dan format resmi |
| `src/lib/export/pdfExporter.ts` | Dibuat | Generator berkas PDF laporan eksekutif siap cetak |
| `src/app/api/export/excel/route.ts` | Dibuat | Endpoint unduhan berkas Excel |
| `src/app/api/export/pdf/route.ts` | Dibuat | Endpoint unduhan berkas PDF |
| `src/server/routers/_app.ts` | Diubah | Mendaftarkan router `report` ke AppRouter utama |
| `tests/unit/reportCalculations.test.ts` | Dibuat | Pengujian unit formula kalkulasi agregasi dan zero-division guard |
| `tests/integration/excelExporter.test.ts` | Dibuat | Pengujian integrasi keabsahan struktur berkas dan formula Excel |

---

## 6. Titik Uji & Pengujian (TDD Seams)

1. **Aggregation Calculation Seam:** Uji fungsi `calculateDailyMetrics` dan `calculateCumulativeMetrics` dengan data tiruan (*mock datasets*), memverifikasi bahwa persentase harian, persentase kumulatif, dan label keterangan ("TERCAPAI" / "TIDAK TERCAPAI") tepat sesuai aturan bisnis.
2. **Target Immutability Seam:** Uji skenario perubahan target: buat target tanggal 1-10 sebesar 50, lalu ubah target tanggal 11-20 menjadi 70. Verifikasi bahwa metrik laporan tanggal 1-10 tidak berubah sedikit pun.
3. **Zero-Division Seam:** Uji kalkulasi dengan `target = 0` dan `realisasi = 0`, serta `target = 0` dan `realisasi = 5`. Pastikan tidak menghasilkan error runtime dan mengembalikan `0.0%`.
4. **Excel Structure & Formula Seam (Mengacu `.agents/skills/xlsx/SKILL.md`):** Uji output berkas `.xlsx` hasil generator untuk memastikan tidak ada formula error (`#NAME?`, `#VALUE!`, `#REF!`), format angka bertipe persentase valid, dan sel formula dievaluasi secara dinamis.
