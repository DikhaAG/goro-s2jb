import Link from "next/link";
import { Download, FilePlus, FolderKanban, RefreshCw, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReviewsHeaderProps {
  operatorName?: string | null;
  userRole: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onExportPage: () => void;
  onPurgeAll: () => void;
}

export function ReviewsHeader({
  operatorName,
  userRole,
  isRefreshing,
  onRefresh,
  onExportPage,
  onPurgeAll,
}: ReviewsHeaderProps) {
  return (
    <div className="rounded-2xl p-5 sm:p-6 lg:p-8 bg-white border border-[#e2e8f0] shadow-xs relative overflow-hidden">
      <div className="flex flex-col 2xl:flex-row 2xl:items-start justify-between gap-5">
        <div className="min-w-0 flex-1 space-y-2 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral" className="gap-1 font-semibold whitespace-nowrap shrink-0">
              <Zap className="w-3.5 h-3.5 text-[#006877]" />
              <span>PLN UID S2JB</span>
            </Badge>
            <span className="text-xs text-[#64748b]">
              Sistem Validasi Eviden Rating PLN Mobile 2026
            </span>
            <span className="bg-[#00A3E0]/10 text-[#006877] border border-[#00A3E0]/25 text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap shrink-0">
              Human-in-the-Loop &amp; Triase
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a] flex items-start sm:items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-[#00A3E0] shrink-0 mt-0.5 sm:mt-0" />
            <span>Pusat Triase &amp; Kelola Data Ulasan</span>
          </h1>

          <p className="text-xs sm:text-sm text-[#64748b] leading-relaxed">
            Verifikasi cepat dengan hotkey taktis [A]/[R], inspeksi citra resolusi tinggi Lightbox [Spasi], koreksi metadata unit kerja, dan kontrol kuratif operator UID S2JB.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full 2xl:w-auto 2xl:max-w-xl 2xl:justify-end min-w-0">
          {/* Operator Info Pill */}
          <div className="flex items-center gap-2 px-3.5 min-h-[44px] py-2 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs max-w-full min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#16a34a] shrink-0 animate-pulse" />
            <span className="text-[#0f172a] font-semibold truncate" suppressHydrationWarning>
              {operatorName || "Petugas Verifikator"}
            </span>
            <span className="text-[#64748b] font-mono text-xs uppercase shrink-0" suppressHydrationWarning>
              ({userRole})
            </span>
          </div>

          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Segarkan Data Tabel"
            className="gap-2 text-xs font-semibold text-[#334155] rounded-xl shadow-xs shrink-0"
          >
            <RefreshCw
              className={cn("w-4 h-4 text-[#006877]", isRefreshing && "animate-spin")}
            />
            <span>Segarkan</span>
          </Button>

          {/* Export Current Page Button */}
          <Button
            type="button"
            variant="outline"
            onClick={onExportPage}
            title="Ekspor ulasan pada halaman saat ini ke CSV"
            className="gap-2 text-xs font-semibold text-[#334155] rounded-xl shadow-xs shrink-0"
          >
            <Download className="w-4 h-4 text-[#64748b]" />
            <span>Ekspor CSV</span>
          </Button>

          {/* Purge All Reviews Button */}
          <Button
            type="button"
            variant="outline"
            onClick={onPurgeAll}
            title="Hapus atau tolak seluruh data ulasan sekaligus"
            className="gap-2 px-3.5 text-xs font-semibold rounded-xl shadow-xs shrink-0 bg-[#fef2f2] border-[#fecaca] hover:bg-[#fee2e2] text-[#b91c1c]"
          >
            <Trash2 className="w-4 h-4 text-[#dc2626]" />
            <span className="hidden xl:inline">Hapus Seluruh Data</span>
            <span className="inline xl:hidden">Hapus Semua</span>
          </Button>

          {/* New Review Entry Link */}
          <Link
            href="/intake"
            className="min-h-[44px] h-11 px-4 rounded-xl bg-[#006877] hover:bg-[#004e5a] text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer focus-utility-ring shadow-xs shrink-0"
          >
            <FilePlus className="w-4 h-4" />
            <span>Entri Baru</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
