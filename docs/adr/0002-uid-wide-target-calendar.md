# 0002: One UID-wide Kalender Target with locked past dates

- **Status:** accepted
- **Date:** 2026-11-27

## Context

Laporan Capaian read targets from two places: a per-ULP, effective-dated `TargetMaster` table that only `prisma/seed.ts` wrote, and a single global weekday/weekend pair in Redis (`config:report:targets`) that the target modal edited. The monthly table preferred `TargetMaster` while the pacing chart read only Redis, so the two views disagreed for the same month, modal edits had no effect on seeded ULPs, and any Redis edit silently rewrote every past month. PRD AC-4 requires that a target change never alters past reports. The reference workbook (`docs/GORO S2JB 2026 (Jawaban).xlsx`, sheet `note` columns K:L) keeps one target per date for the whole UID, with irregular values on weekends and holidays and a cumulative that restarts each month.

## Decision

1. Targets are a **Kalender Target**: one daily target per date, applied to every ULP in the UID. `TargetMaster` and the Redis key are removed.
2. Entries for dates before today (WIB) are read-only, enforced inside the Laporan Capaian module rather than in the UI. Changing a target means editing today or later dates.
3. An explicit 0 means no target that day. A date with no entry falls back to a fixed code constant (50 weekday, 20 weekend), which is never configurable, and the report marks that target as default.
4. Target Kumulatif is always derived from the calendar, never stored.

## Considered Options

- **Per-ULP rows per date (`TargetMaster` kept):** rejected because the business sets one number for all ULPs; the extra dimension was never used and only ever held seed data.
- **Effective-dated weekday/weekend pairs:** rejected because the real calendar has holiday and weekend values that no weekday/weekend rule can express. The pattern survives only as a fill helper in the modal.
- **Configurable fallback:** rejected because changing it would recompute every past date that had no entry, breaking AC-4.

## Consequences

- Per-ULP targets, if ever needed, are an override layered on the calendar, not a return to `TargetMaster`.
- The seed generates calendar entries for the current and next month; months nobody has filled show default targets.
