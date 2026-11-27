"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { wibToday } from "@/lib/wibDate";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const WEEKDAY_HEADERS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
// Indexed by getUTCDay(): 0 is Sunday.
const WEEKDAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MAX_TARGET = 10000;

interface TargetCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The dashboard's Posisi Tanggal; the modal opens on its month. */
  initialDate: string;
}

type Feedback = { kind: "success" | "error"; text: string } | null;

function parseTarget(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_TARGET ? value : null;
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function monthOf(date: string) {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

export function TargetCalendarModal({ isOpen, onClose, initialDate }: TargetCalendarModalProps) {
  const utils = trpc.useUtils();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [view, setView] = useState(() => monthOf(initialDate));
  // Unsaved edits keyed by date, kept across month changes until saved or discarded.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pattern, setPattern] = useState({ weekday: "50", weekend: "20" });
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!isOpen) return;
    setView(monthOf(initialDate));
    setDrafts({});
    setFeedback(null);
    closeButtonRef.current?.focus();
  }, [isOpen, initialDate]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const calendarQuery = trpc.report.getTargetCalendar.useQuery(view, { enabled: isOpen });

  const saveMutation = trpc.report.setTargetCalendar.useMutation({
    onSuccess: (result) => {
      setDrafts({});
      setFeedback({
        kind: "success",
        text: `Kalender Target tersimpan untuk ${result.changedDates.length} tanggal. Laporan sudah memakai nilai baru.`,
      });
      utils.report.getTargetCalendar.invalidate();
      utils.report.getDaily.invalidate();
      utils.report.getMonthly.invalidate();
      utils.report.getKpis.invalidate();
      utils.report.getPacing.invalidate();
    },
    onError: (err) => {
      setFeedback({ kind: "error", text: err.message || "Kalender Target gagal disimpan. Coba lagi." });
    },
  });

  if (!isOpen) return null;

  const today = wibToday();
  const days = calendarQuery.data ?? [];
  const storedByDate = new Map(days.map((d) => [d.date, d]));

  function setDraft(date: string, raw: string) {
    setFeedback(null);
    setDrafts((prev) => {
      const next = { ...prev };
      const stored = storedByDate.get(date);
      // Typing back the value already saved is not a change.
      if (stored && !stored.isDefault && parseTarget(raw) === stored.dailyTarget) {
        delete next[date];
      } else {
        next[date] = raw;
      }
      return next;
    });
  }

  const patternWeekday = parseTarget(pattern.weekday);
  const patternWeekend = parseTarget(pattern.weekend);
  const editableDays = days.filter((d) => d.date >= today);

  function applyPattern() {
    if (patternWeekday === null || patternWeekend === null) return;
    for (const day of editableDays) {
      const weekday = weekdayOf(day.date);
      const target = weekday === 0 || weekday === 6 ? patternWeekend : patternWeekday;
      setDraft(day.date, String(target));
    }
  }

  function shiftMonth(delta: number) {
    setView(({ year, month }) => {
      const index = year * 12 + (month - 1) + delta;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  }

  const draftEntries = Object.entries(drafts);
  const invalidDates = draftEntries.filter(([, raw]) => parseTarget(raw) === null).map(([date]) => date);
  const changeCount = draftEntries.length;
  const canSave = changeCount > 0 && invalidDates.length === 0 && !saveMutation.isPending;

  function save() {
    if (!canSave) return;
    saveMutation.mutate({
      entries: draftEntries.map(([date, raw]) => ({ date, dailyTarget: parseTarget(raw) as number })),
    });
  }

  const monthTotal = days.reduce((sum, d) => {
    const draft = drafts[d.date];
    const parsed = draft === undefined ? null : parseTarget(draft);
    return sum + (parsed ?? d.dailyTarget);
  }, 0);
  const leadingBlanks = days.length > 0 ? (weekdayOf(days[0].date) + 6) % 7 : 0;
  const monthLabel = `${MONTH_NAMES[view.month - 1]} ${view.year}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/50 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="target-calendar-title"
        className="flex max-h-[100dvh] w-full flex-col overflow-hidden border border-[#e2e8f0] bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-3xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#e2e8f0] px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e7eeff] text-[#006877]">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="target-calendar-title" className="text-base font-bold text-[#0f172a]">
                Kalender Target
              </h2>
              <p className="mt-0.5 text-xs text-[#475569]">
                Target harian per tanggal, sama untuk setiap ULP. Tanggal yang sudah lewat terkunci agar laporan lama tidak berubah.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup Kalender Target"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#475569] transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a] focus-utility-ring cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Bulan sebelumnya"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc] focus-utility-ring cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <p className="text-base font-semibold text-[#0f172a]" aria-live="polite">
              {monthLabel}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Bulan berikutnya"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f8fafc] focus-utility-ring cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {calendarQuery.isLoading ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2" role="status">
              <Loader2 className="h-6 w-6 animate-spin text-[#00a2b9]" aria-hidden />
              <span className="text-xs text-[#64748b]">Memuat Kalender Target {monthLabel}...</span>
            </div>
          ) : calendarQuery.isError ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl bg-[#fef2f2] p-4 sm:flex-row sm:items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ef4444] text-white">
                <AlertCircle className="h-5 w-5" aria-hidden />
              </div>
              <p className="flex-1 text-sm text-[#93000a]">
                Kalender Target {monthLabel} gagal dimuat. {calendarQuery.error.message}
              </p>
              <button
                type="button"
                onClick={() => calendarQuery.refetch()}
                className="min-h-[44px] rounded-xl border border-[#cbd5e1] bg-white px-4 text-xs font-bold text-[#334155] hover:bg-[#f1f5f9] focus-utility-ring cursor-pointer"
              >
                Muat ulang
              </button>
            </div>
          ) : (
            <>
              {editableDays.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-2xl bg-[#f8fafc] p-3.5 sm:flex-row sm:items-end">
                  <p className="text-xs text-[#334155] sm:flex-1">
                    Isi semua tanggal yang belum lewat di {MONTH_NAMES[view.month - 1]} dengan pola hari kerja dan akhir pekan, lalu ubah tanggal libur satu per satu.
                  </p>
                  <div className="flex items-end gap-2">
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-[#475569]">
                      Hari kerja
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_TARGET}
                        value={pattern.weekday}
                        onChange={(e) => setPattern((p) => ({ ...p, weekday: e.target.value }))}
                        aria-invalid={patternWeekday === null}
                        className="h-11 w-20 rounded-xl border border-[#cbd5e1] bg-white px-2.5 font-mono text-sm text-[#0f172a] focus-utility-ring"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-[#475569]">
                      Akhir pekan
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_TARGET}
                        value={pattern.weekend}
                        onChange={(e) => setPattern((p) => ({ ...p, weekend: e.target.value }))}
                        aria-invalid={patternWeekend === null}
                        className="h-11 w-20 rounded-xl border border-[#cbd5e1] bg-white px-2.5 font-mono text-sm text-[#0f172a] focus-utility-ring"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={applyPattern}
                      disabled={patternWeekday === null || patternWeekend === null}
                      className="min-h-[44px] rounded-xl border border-[#cbd5e1] bg-white px-3.5 text-xs font-bold text-[#334155] hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-60 focus-utility-ring cursor-pointer"
                    >
                      Terapkan pola
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl bg-[#f8fafc] p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#475569] text-white">
                    <Lock className="h-4 w-4" aria-hidden />
                  </div>
                  <p className="text-xs text-[#334155]">
                    Semua tanggal di {monthLabel} sudah lewat, jadi targetnya hanya bisa dilihat.
                  </p>
                </div>
              )}

              <div className="hidden grid-cols-7 gap-2 sm:grid" aria-hidden>
                {WEEKDAY_HEADERS.map((name) => (
                  <span key={name} className="text-center text-[11px] font-bold text-[#64748b]">
                    {name}
                  </span>
                ))}
              </div>

              <ol className="grid grid-cols-1 gap-2 sm:grid-cols-7" aria-label={`Target harian ${monthLabel}`}>
                {Array.from({ length: leadingBlanks }, (_, i) => (
                  <li key={`blank-${i}`} className="hidden sm:block" aria-hidden />
                ))}
                {days.map((day) => {
                  const dayNumber = Number(day.date.slice(8));
                  const weekdayName = WEEKDAY_NAMES[weekdayOf(day.date)];
                  const locked = day.date < today;
                  const draft = drafts[day.date];
                  const changed = draft !== undefined;
                  const invalid = changed && parseTarget(draft) === null;
                  const isToday = day.date === today;
                  const status = invalid
                    ? "Angka 0-10000"
                    : changed
                      ? "Diubah"
                      : day.isDefault
                        ? "Default"
                        : null;
                  const inputId = `target-${day.date}`;

                  return (
                    <li
                      key={day.date}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 sm:flex-col sm:items-stretch sm:gap-1.5 sm:px-2",
                        locked ? "border-[#e2e8f0] bg-[#f8fafc]" : "border-[#cbd5e1] bg-white",
                        changed && !invalid && "border-[#00a2b9] ring-1 ring-[#00a2b9]",
                        invalid && "border-[#b91c1c] ring-1 ring-[#b91c1c]"
                      )}
                    >
                      <label htmlFor={locked ? undefined : inputId} className="flex min-w-0 items-baseline gap-1.5 sm:justify-between">
                        <span className="font-mono text-sm font-bold text-[#0f172a]">{dayNumber}</span>
                        <span className="text-xs text-[#475569] sm:hidden">{weekdayName}</span>
                        {isToday && <span className="text-[11px] font-bold text-[#006877]">Hari ini</span>}
                      </label>

                      <div className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:gap-1">
                        {status && (
                          <span
                            className={cn(
                              "order-first text-[11px] sm:order-last",
                              invalid ? "font-semibold text-[#b91c1c]" : changed ? "font-semibold text-[#006877]" : "text-[#64748b]"
                            )}
                          >
                            {status}
                          </span>
                        )}
                        {locked ? (
                          <span className="flex h-11 items-center gap-1.5 font-mono text-sm text-[#334155] sm:justify-center">
                            <Lock className="h-3.5 w-3.5 text-[#64748b]" aria-hidden />
                            {day.dailyTarget}
                            <span className="sr-only">, {weekdayName} {dayNumber} {monthLabel}, terkunci</span>
                          </span>
                        ) : (
                          <input
                            id={inputId}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={MAX_TARGET}
                            value={draft ?? String(day.dailyTarget)}
                            onChange={(e) => setDraft(day.date, e.target.value)}
                            aria-label={`Target ${weekdayName} ${dayNumber} ${monthLabel}`}
                            aria-invalid={invalid}
                            className="h-11 w-24 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-2.5 text-right font-mono text-sm text-[#0f172a] focus-utility-ring sm:w-full sm:text-center"
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="space-y-3 border-t border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 sm:px-6 sm:py-4">
          {feedback && (
            <div
              role={feedback.kind === "error" ? "alert" : "status"}
              className={cn(
                "flex items-start gap-2 text-xs",
                feedback.kind === "error" ? "text-[#93000a]" : "text-[#15803d]"
              )}
            >
              {feedback.kind === "error" ? (
                <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <CheckCircle2 className="mt-px h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-[#475569]" aria-live="polite">
              {days.length > 0 && (
                <p>
                  Target Kumulatif {MONTH_NAMES[view.month - 1]} per ULP:{" "}
                  <span className="font-mono font-bold text-[#0f172a]">{monthTotal.toLocaleString("id-ID")}</span>
                </p>
              )}
              <p>
                {changeCount === 0
                  ? "Belum ada perubahan."
                  : invalidDates.length > 0
                    ? `${invalidDates.length} tanggal berisi angka yang tidak valid.`
                    : `${changeCount} tanggal belum disimpan.`}
              </p>
            </div>

            <div className="flex gap-2">
              {changeCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDrafts({});
                    setFeedback(null);
                  }}
                  className="min-h-[44px] flex-1 rounded-xl border border-[#cbd5e1] bg-white px-4 text-xs font-bold text-[#334155] hover:bg-[#f1f5f9] focus-utility-ring cursor-pointer sm:flex-none"
                >
                  Batalkan perubahan
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#006877] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#004e5a] disabled:cursor-not-allowed disabled:bg-[#94a3b8] focus-utility-ring cursor-pointer sm:flex-none"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Menyimpan...
                  </>
                ) : changeCount > 0 ? (
                  `Simpan ${changeCount} tanggal`
                ) : (
                  "Simpan"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
