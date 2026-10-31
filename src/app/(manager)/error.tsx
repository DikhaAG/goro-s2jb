"use client";

import { AlertCircle } from "lucide-react";
import { ModuleErrorFallback } from "@/components/layout/ModuleErrorFallback";

export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ModuleErrorFallback
      error={error}
      reset={reset}
      moduleName="Manager Module"
      badgeLabel="KESALAHAN MODUL EKSEKUTIF"
      defaultTitle="Gagal Memuat Laporan Eksekutif"
      defaultMessage="Terjadi kesalahan saat menghitung agregasi metrik harian/bulanan."
      retryLabel="Kalkulasi Ulang"
      icon={AlertCircle}
      themeColor="blue"
    />
  );
}
