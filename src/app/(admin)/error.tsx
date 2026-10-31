"use client";

import { ShieldAlert } from "lucide-react";
import { ModuleErrorFallback } from "@/components/layout/ModuleErrorFallback";

export default function AdminError({
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
      moduleName="Admin Module"
      badgeLabel="KESALAHAN SISTEM ADMINISTRASI"
      defaultTitle="Gagal Memuat Modul Administrasi"
      defaultMessage="Terjadi kendala saat memuat data manajemen pengguna, audit log, atau proses sistem."
      retryLabel="Muat Ulang Modul"
      icon={ShieldAlert}
      themeColor="slate"
    />
  );
}

