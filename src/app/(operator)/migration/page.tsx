"use client";

import Link from "next/link";
import { BulkDropzone } from "@/components/admin/BulkDropzone";
import { MigrationBatchTable } from "@/components/operator/migration/MigrationBatchTable";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Database,
  Activity,
  ArrowRight,
  Zap,
  RotateCw,
  Layers,
} from "lucide-react";

export default function MigrationPage() {
  const batchesQuery = trpc.migration.listBatches.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const refreshBatches = () => batchesQuery.refetch();

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <MigrationHeader
        isRefreshing={batchesQuery.isRefetching}
        onRefresh={refreshBatches}
      />

      <BulkDropzone />

      <MigrationBatchTable
        batches={batchesQuery.data ?? []}
        isLoading={batchesQuery.isLoading}
        isRefetching={batchesQuery.isRefetching}
        onRefresh={refreshBatches}
      />
    </div>
  );
}

interface MigrationHeaderProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

function MigrationHeader({ isRefreshing, onRefresh }: MigrationHeaderProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#006877]/10 text-[#006877] text-xs font-bold">
            <Zap className="w-3.5 h-3.5 fill-[#006877]" />
            PLN UID S2JB
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-semibold">
            <Layers className="w-3.5 h-3.5 text-[#64748b]" />
            High-Throughput Streaming Parser
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[#475569] text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            BullMQ Worker Active
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center shrink-0 border border-[#bae6fd]">
            <Database className="w-5 h-5 text-[#006877]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0f172a] tracking-tight">
              Migrasi Massal Rekam Data Historis
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
              Muat rekam data masif Google Form (143.000+ baris) dan riwayat laporan acuan ke dalam basis data PostgreSQL menggunakan streaming parser berkinerja tinggi.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          title="Segarkan riwayat migrasi"
          className="gap-2 px-3.5 text-xs font-bold text-[#334155] rounded-xl shadow-xs"
        >
          <RotateCw
            className={cn(
              "w-3.5 h-3.5 text-[#64748b]",
              isRefreshing && "animate-spin text-[#006877]"
            )}
          />
          <span>Segarkan</span>
        </Button>

        <Link
          href="/migration/monitor"
          className="min-h-[44px] px-4 py-2 bg-[#006877] hover:bg-[#004e5a] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 focus-utility-ring"
        >
          <Activity className="w-4 h-4 text-white" />
          <span>Pusat Pemantauan Worker</span>
          <ArrowRight className="w-3.5 h-3.5 text-white" />
        </Link>
      </div>
    </div>
  );
}
