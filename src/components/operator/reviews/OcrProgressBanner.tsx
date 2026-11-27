import { RefreshCw } from "lucide-react";

interface OcrProgressBannerProps {
  activeCount: number;
  onShowProcessing: () => void;
}

/** Shown while the background OCR worker still has rows in flight. */
export function OcrProgressBanner({ activeCount, onShowProcessing }: OcrProgressBannerProps) {
  if (activeCount <= 0) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f0f9ff] border border-[#00a2b9]/30 rounded-2xl shadow-xs text-[#0f172a] animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#00a2b9]/10 text-[#006877] flex items-center justify-center shrink-0 border border-[#00a2b9]/20">
          <RefreshCw className="w-5 h-5 text-[#006877] animate-spin" />
        </div>
        <div>
          <div className="text-xs font-bold text-[#0f172a] flex items-center gap-2">
            <span>Background OCR Worker & Image Proxy Sedang Berjalan</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#00a2b9] text-white">
              {activeCount} baris dalam pemrosesan
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5">
            Citra eviden beresolusi tinggi sedang diunduh dari Google Drive dan diekstraksi teksnya secara asinkron. Halaman otomatis memperbarui progress.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onShowProcessing}
        className="text-xs font-semibold text-[#006877] hover:underline self-start sm:self-auto cursor-pointer"
      >
        Saring Baris yang Sedang Diproses &rarr;
      </button>
    </div>
  );
}
