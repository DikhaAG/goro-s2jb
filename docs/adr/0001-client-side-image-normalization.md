# 0001: Native Mobile Input and Client-Side Evidence Normalization

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Field officers (`Petugas Lapangan`) submit `Eviden Ulasan` via `/intake` on Android and iOS devices as either `Foto Kamera Langsung` (6-15 MB, sometimes HEIC/HEIF on iOS) or `Tangkapan Layar` from the device gallery. The previous single `<input capture="environment" accept="image/jpeg,image/png,image/webp">` forced the rear camera directly without allowing gallery screenshots, rejected iOS HEIC/HEIF files, and blocked raw smartphone camera photos exceeding the 5 MB server limit.

## Decision

1. Provide two explicit file triggers on `/intake`: **Ambil Foto Kamera** (`capture="environment"`) using the native OS camera (rather than an in-browser `getUserMedia` viewfinder), and **Pilih dari Galeri / File** (without `capture`).
2. Normalize and compress oversized (`> 1920px` or `> 2 MB`) or HEIC/HEIF evidence images on the client (via lazy-loaded HEIC decoding and canvas resizing to max `1920px` JPEG with `.jpg` filename extension) before preview and tRPC upload.
3. Store only this single normalized image on the server (`uploads/evidence/YYYY/MM/DD`) and compute OCR and 64-bit pHash from it, instead of persisting raw 6-15 MB originals alongside normalized copies.

## Considered Options

- **In-browser `getUserMedia` camera:** Rejected because native OS camera provides superior macro autofocus/HDR for photographing customer phone screens and avoids WebView/permission friction.
- **Accepting 15-20 MB raw uploads and server-side HEIC conversion:** Rejected to protect mobile field bandwidth, stay within reverse proxy limits, and match `goro-engine`'s existing `MAX_DIMENSION = 1920` OCR constraint.
- **Camera-only enforcement (blocking gallery):** Rejected because field workflows legitimately require both `Foto Kamera Langsung` and `Tangkapan Layar`.

## Consequences

- Client-side re-encoding slightly changes byte hashes compared to the original phone file, so duplicate detection (`pHash`) operates on the normalized visual representation rather than raw camera bytes.
- Because `src/lib/storage.ts` validates both MIME type and filename extension, client-side JPEG conversion must rewrite `.heic`/`.heif` filenames to `.jpg` before submission.
- Cross-browser HEIC support on Android Chrome and Desktop requires a lazy-loaded client decoder dependency (`heic2any`), loaded only when a HEIC/HEIF file is chosen.

