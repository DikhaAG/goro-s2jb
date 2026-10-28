import React from "react";
import { ReportsDashboard } from "@/components/manager/ReportsDashboard";

export const metadata = {
  title: "Laporan Eksekutif & Intelijen Kinerja | GORO S2JB 2026",
  description:
    "Pusat pelaporan harian, H-1, dan kumulatif bulanan rating PLN Mobile UID S2JB untuk Manager Wilayah",
};

export default function ReportsPage() {
  return <ReportsDashboard />;
}
