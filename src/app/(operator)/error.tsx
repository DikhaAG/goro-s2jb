"use client";

import { AlertOctagon } from "lucide-react";
import { ModuleErrorFallback } from "@/components/layout/ModuleErrorFallback";

export default function OperatorError({
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
      moduleName="Operator Module"
      badgeLabel="KESALAHAN MODUL TRIASE"
      defaultTitle="Gagal Memuat Antrean Triase"
      defaultMessage="Terjadi kesalahan sinkronisasi data ulasan antrean triase operator."
      retryLabel="Muat Ulang Triase"
      icon={AlertOctagon}
      themeColor="orange"
    />
  );
}
