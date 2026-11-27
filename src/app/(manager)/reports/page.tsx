import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReportsDashboard } from "@/components/manager/ReportsDashboard";

export const metadata = {
  title: "Laporan Eksekutif & Intelijen Kinerja | GORO S2JB 2026",
  description:
    "Pusat pelaporan harian, H-1, dan kumulatif bulanan rating PLN Mobile UID S2JB untuk Manager Wilayah",
};

export default function ReportsPage() {
  // ReportsDashboard reads its filters from the URL, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-[400px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00a2b9]" />
        </div>
      }
    >
      <ReportsDashboard />
    </Suspense>
  );
}
