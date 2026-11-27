import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewsDashboard } from "@/components/operator/reviews/ReviewsDashboard";
import { getServerSession } from "@/lib/server-auth";

export const metadata = {
  title: "Pusat Manajemen & Pengelolaan Data Ulasan | GORO S2JB 2026",
  description:
    "Antarmuka komando penelusuran, inspeksi, koreksi data hasil migrasi Google Form, dan kontrol kuratif operator UID S2JB",
};

export default async function OperatorReviewsPage() {
  const session = await getServerSession();
  // ReviewsDashboard reads its filters from the URL, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <div className="flex-1 min-h-[400px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#00a2b9]" />
        </div>
      }
    >
      <ReviewsDashboard initialSession={session} />
    </Suspense>
  );
}

