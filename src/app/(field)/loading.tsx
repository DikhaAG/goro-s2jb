import React from "react";
import { ModuleLoadingSkeleton } from "@/components/layout/ModuleLoadingSkeleton";

export default function FieldLoading() {
  return (
    <ModuleLoadingSkeleton
      label="Menyiapkan formulir entri data ulasan lapangan..."
      variant="form"
    />
  );
}
