import React from "react";
import { ModuleLoadingSkeleton } from "@/components/layout/ModuleLoadingSkeleton";

export default function AdminLoading() {
  return (
    <ModuleLoadingSkeleton
      label="Memuat panel administrasi sistem, pengguna, dan audit log..."
      variant="grid"
    />
  );
}

