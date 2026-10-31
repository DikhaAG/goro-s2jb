"use client";

import { AlertTriangle } from "lucide-react";
import { ModuleErrorFallback } from "@/components/layout/ModuleErrorFallback";

export default function FieldError({
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
      moduleName="Field Module"
      badgeLabel="KESALAHAN SISTEM LAPANGAN"
      defaultTitle="Gagal Memuat Formulir Entri"
      defaultMessage="Terjadi kendala saat menghubungkan modul entri eviden ke server."
      icon={AlertTriangle}
      themeColor="red"
    />
  );
}
