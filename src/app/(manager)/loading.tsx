import React from "react";
import { ModuleLoadingSkeleton } from "@/components/layout/ModuleLoadingSkeleton";

export default function ManagerLoading() {
  return (
    <ModuleLoadingSkeleton
      label="Mengagregasikan laporan performa unit UID S2JB & target imutabel..."
      variant="dashboard"
    />
  );
}
