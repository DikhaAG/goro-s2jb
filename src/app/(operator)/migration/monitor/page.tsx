import { Suspense } from "react";
import { MigrationMonitor } from "@/components/migration/MigrationMonitor";

export default function MigrationMonitorPage() {
  // MigrationMonitor reads its tab and filters from the URL, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-2xl border border-[#e2e8f0] p-12 text-center text-[#64748b] text-xs animate-pulse">
            Memuat pusat pemantauan worker...
          </div>
        </div>
      }
    >
      <MigrationMonitor />
    </Suspense>
  );
}
