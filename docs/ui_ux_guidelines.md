# Pedoman Standar Desain UI/UX (Source of Truth Antarmuka)
**PLN UID S2JB - GORO (Gotong Royong) S2JB 2026**

Dokumen ini merupakan panduan resmi standar UI/UX antarmuka pengguna untuk seluruh halaman dan komponen di repositori GORO S2JB. Seluruh pengembangan UI baru maupun pembaruan komponen eksisting **wajib mengikuti spesifikasi desain** yang telah dipadukan dari:
- [`src/components/home/HomePageClient.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/home/HomePageClient.tsx)
- [`src/components/operator/TriageDashboard.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/operator/TriageDashboard.tsx)
- [`src/components/operator/reviews/ReviewsDashboard.tsx`](file:///Users/a69/Desktop/goro-s2jb/src/components/operator/reviews/ReviewsDashboard.tsx)

---

## 1. Palet Warna & Token Brand PLN S2JB

### Palet Warna Utama (Core Tokens)
| Token / Kegunaan | Kode Hex / Tailwind | Deskripsi & Implementasi |
| :--- | :--- | :--- |
| **Primary Brand Teal** | `#006877` | Warna primer korporat PLN untuk teks utama tombol, ikon aktif, judul aksen. |
| **Accent Primary Teal** | `#00a2b9` | Warna tombol utama (`bg-[#00a2b9]`), cincin fokus (`focus-utility-ring`), active borders. |
| **Primary Hover** | `#008c9f` | Status hover tombol primer (`hover:bg-[#008c9f]`). |
| **PLN Cyan Accent** | `#00A3E0` | Gradien sekunder dan badge aksen listrik. |
| **Dark Carbon Text** | `#0f172a` (`slate-900`) | Warna tipografi heading, nama entitas, dan nilai teks kontras tinggi (WCAG AAA). |
| **Secondary Body Text** | `#334155` (`slate-700`) | Teks deskripsi, label formulir, keterangan data. |
| **Muted Meta Text** | `#64748b` (`slate-500`) | Teks penjelas sekunder, heading tabel, placeholder, metadata timestamp. |
| **Border Kontainer** | `#e2e8f0` (`slate-200`) | Garis tepi kartu (`card`), pemisah seksi besar, kontainer modal. |
| **Border Form / Input** | `#cbd5e1` (`slate-300`) | Garis batas elemen interaktif formulir (input text, select dropdown, search). |
| **Background Dasar Page** | `#f8fafc` (`slate-50`) | Latar belakang kanvas aplikasi web. |
| **Floating Dark Slate** | `#0f172a` / `#1e293b` | Latar belakang toolbar massal melayang (*bulk bar*) dan toast notifikasi (*undo bar*). |

### Palet Status & Taksonomi Operasional
Setiap status operasional memiliki token terstandarisasi untuk badge latar (`bg`), teks (`text`), garis batas (`border`), dan indikator titik (*dot*):
- **Selesai / Terverifikasi / Lolos (Emerald/Green):**
  - Background: `bg-[#ecfdf5]` (atau `bg-emerald-50`)
  - Teks: `text-[#15803d]` (atau `text-emerald-700`)
  - Border: `border-[#a7f3d0]` (atau `border-emerald-200`)
  - Titik Status: `bg-[#16a34a]`
- **Menunggu Verifikasi / Butuh Review (Amber/Orange):**
  - Background: `bg-[#fff7ed]` (atau `bg-amber-50`)
  - Teks: `text-[#b45309]` (atau `text-amber-700`)
  - Border: `border-[#fed7aa]` (atau `border-amber-200`)
  - Titik Status: `bg-[#f59e0b]`
- **Anomali / Ditolak / Dihapus (Rose/Red):**
  - Background: `bg-[#fef2f2]` (atau `bg-rose-50`)
  - Teks: `text-[#b91c1c]` (atau `text-rose-700`)
  - Border: `border-[#fecaca]` (atau `border-rose-200`)
  - Titik Status: `bg-[#ef4444]`
- **Sedang Diproses OCR / Analisis AI (Sky/Blue):**
  - Background: `bg-[#f0f9ff]` (atau `bg-sky-50`)
  - Teks: `text-[#0369a1]` (atau `text-sky-700`)
  - Border: `border-[#bae6fd]` (atau `border-sky-200`)
  - Titik Status: `bg-[#0284c7]`
- **Duplikasi / Konflik Data (Purple):**
  - Background: `bg-[#faf5ff]` (atau `bg-purple-50`)
  - Teks: `text-[#7e22ce]` (atau `text-purple-700`)
  - Border: `border-[#e9d5ff]` (atau `border-purple-200`)
  - Titik Status: `bg-[#9333ea]`

---

## 2. Struktur Komponen Standar

### A. Enterprise Header Banner
Header utama modul operasional wajib menggunakan kontainer kartu putih rounded-2xl dengan struktur taktis:
1. **Brand Badges Bar:**
   - Pill PLN: `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#006877]/10 text-[#006877] text-xs font-bold` disertai ikon `Zap`.
   - Pill Sistem: `inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-semibold` (misal: "Human-in-the-Loop Triage" atau "Data Management Center").
2. **Title & Deskripsi:**
   - Judul: `text-xl md:text-2xl font-black text-[#0f172a] tracking-tight`.
   - Deskripsi: `text-xs md:text-sm text-[#475569] mt-0.5`.
3. **Operator Status Pill & Action Buttons:**
   - Status Aktif: Indikator hijau berkedip (`span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"`), teks identitas operator.
   - Tombol Tindakan Primer: `min-h-[44px] px-4 py-2 bg-[#00a2b9] hover:bg-[#008c9f] text-white text-xs font-bold rounded-xl shadow-xs transition-all focus-utility-ring`.
   - Tombol Tindakan Sekunder: `min-h-[44px] px-3.5 py-2 bg-white hover:bg-[#f8fafc] text-[#334155] border border-[#cbd5e1] text-xs font-bold rounded-xl transition-all focus-utility-ring`.

### B. KPI Ribbon & Ringkasan Metrik
Baris ringkasan metrik menggunakan grid kartu interaktif:
- **Kontainer Kartu:** `p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between focus-utility-ring`.
- **Status Normal:** `bg-white border-[#e2e8f0] hover:border-[#cbd5e1]`.
- **Status Terpilih (Filter Aktif):** `ring-2 ring-[#00a2b9] border-[#00a2b9] bg-white shadow-xs`.
- **Struktur Isi:**
  - Baris atas: Icon box putih (`w-8 h-8 rounded-lg bg-white border border-[#e2e8f0] flex items-center justify-center text-xs font-bold`) dan badge tren / filter status.
  - Angka Nilai: `font-mono font-bold text-2xl text-[#0f172a]` (wajib menggunakan font monospace untuk ketegasan metrik angka).
  - Label: `text-[11px] font-bold text-[#64748b] uppercase tracking-wider mt-0.5`.

### C. Filter & Pencarian (FilterBar)
- Kontainer: `bg-white border border-[#e2e8f0] p-4 rounded-2xl shadow-xs space-y-3`.
- Input Pencarian:
  - Input: `w-full bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] placeholder-[#94a3b8] text-xs rounded-xl pl-9 pr-4 min-h-[38px] transition-all focus-utility-ring`.
  - Icon Search: `absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]`.
- Dropdown Bertingkat (Cascading Selects):
  - Label: `text-[11px] font-bold text-[#475569] uppercase tracking-wider block mb-1`.
  - Select: `w-full bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-xs rounded-xl px-2.5 min-h-[38px] transition-all focus-utility-ring`.

### D. Tabel Data Enterprise (Data Table)
- **Kontainer Tabel:** `bg-white border border-[#e2e8f0] rounded-2xl shadow-xs overflow-hidden`.
- **Header Kolom:** `border-b border-[#e2e8f0] bg-[#f8fafc] text-[11px] font-bold text-[#64748b] uppercase tracking-wider`. Padding `px-3.5 py-3`.
- **Baris Data:**
  - Baris Biasa: `border-b border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors`.
  - Baris Tercentang/Terpilih: `bg-[#f0f9ff] border-b border-[#bae6fd] hover:bg-[#e0f2fe]`.
  - Checkbox Kolom: `w-4 h-4 rounded border-[#cbd5e1] text-[#00a2b9] focus:ring-[#00a2b9]`.
  - Nomor ID / Pelanggan: `font-mono text-xs font-bold text-[#0f172a]`.
- **Confidence Badge (Nilai OCR / Keyakinan):**
  - Format angka monospace dengan badge kontras tinggi: misal `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold`.
- **Navigasi Paginasi:**
  - Kontainer bawah tabel: `p-3.5 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between`.
  - Tombol Paging: `min-h-[36px] min-w-[36px] rounded-xl border border-[#cbd5e1] text-xs font-bold text-[#334155] hover:bg-white focus-utility-ring`.

### E. Floating Action Bars & Toasts
Aksi massal (*bulk actions*) dan notifikasi status pemulihan (*undo toast*) wajib menggunakan palet gelap melayang:
- Kontainer: `fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0f172a] text-white border border-[#334155] shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3`.
- Badge Counter: `px-2 py-0.5 rounded-md bg-[#00a2b9] text-white text-xs font-bold font-mono`.
- Tombol Aksi: `min-h-[36px] px-3 py-1.5 rounded-xl font-bold text-xs transition-colors`.

### F. Modal Dialog & Drawer Detail
- **Backdrop:** `fixed inset-0 z-50 bg-[#0f172a]/50 backdrop-blur-xs flex items-center justify-center p-4`.
- **Kontainer Modal:** `bg-white border border-[#e2e8f0] rounded-2xl shadow-2xl overflow-hidden`.
- **Header Modal:** `px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between`.
  - Icon Box: `w-9 h-9 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center`.
  - Judul: `text-base font-bold text-[#0f172a]`.
- **Footer Aksi Modal:** `px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex justify-end gap-3`.
  - Primary Submit: `min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs focus-utility-ring`.
  - Secondary Cancel: `min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9] focus-utility-ring`.

---

## 3. Aksesibilitas (A11y) & Kaidah Interaksi

1. **Focus Utility Ring:**
   Setiap elemen interaktif (button, input, select, textarea, checkbox) wajib mengimplementasikan kelas `.focus-utility-ring`:
   ```css
   focus-visible:outline-2 focus-visible:outline-[#00a2b9] focus-visible:outline-offset-2
   ```
2. **Ukuran Target Sentuh (Tap Targets):**
   - Tombol utama & input form: minimal tinggi `44px` (`min-h-[44px]`).
   - Tombol aksi tabel padat / pagination: minimal tinggi `36px` (`min-h-[36px]`).
3. **Keterbacaan & Kontras (WCAG AA/AAA):**
   - Dilarang keras menaruh teks warna terang di atas latar belakang putih (misal teks abu-abu pudar `#cbd5e1` untuk teks utama).
   - Teks utama wajib `#0f172a` atau `#334155`.
4. **Bebas Karakter Em Dash (`—`):**
   - Dalam penulisan teks UI, pesan error, label form, maupun komentar kode, **dilarang menggunakan karakter em dash (`—`)**. Gunakan tanda hubung biasa (`-`), titik dua (`:`), atau tanda kurung `()`.

---

## 4. Checklist Penerapan untuk Komponen Baru

Sebelum melakukan penggabungan (*merge*) atau menyetujui fitur antarmuka baru:
- [ ] Header modul menggunakan format enterprise banner dengan badge brand dan profile status.
- [ ] Seluruh kartu statistik KPI menggunakan angka monospace 24px (`font-mono text-2xl font-bold`).
- [ ] Seluruh input dan tombol dilengkapi kelas `.focus-utility-ring`.
- [ ] Tombol aksi utama memenuhi standar tap target minimal 44px.
- [ ] Dropdown filter bertingkat menggunakan border `#cbd5e1` dan latar `#f8fafc`.
- [ ] Tabel memiliki baris terpilih dengan latar `#f0f9ff` dan border `#bae6fd`.
- [ ] Dialog dan floating toolbar menggunakan styling token resmi di atas.
- [ ] Menjalankan verifikasi tipe `npx tsc --noEmit` dengan 0 error.

