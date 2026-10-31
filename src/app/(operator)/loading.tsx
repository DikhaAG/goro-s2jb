import React from "react";
import { ModuleLoadingSkeleton } from "@/components/layout/ModuleLoadingSkeleton";

export default function OperatorLoading() {
  return (
    <ModuleLoadingSkeleton
      label="Memuat antrean triase Zona Kuning & inspektur eviden..."
      variant="grid"
    />
  );
}
