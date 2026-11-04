import React from "react";
import { ReviewsDashboard } from "@/components/operator/reviews/ReviewsDashboard";
import { getServerSession } from "@/lib/server-auth";

export const metadata = {
  title: "Pusat Manajemen & Pengelolaan Data Ulasan | GORO S2JB 2026",
  description:
    "Antarmuka komando penelusuran, inspeksi, koreksi data hasil migrasi Google Form, dan kontrol kuratif operator UID S2JB",
};

export default async function OperatorReviewsPage() {
  const session = await getServerSession();
  return <ReviewsDashboard initialSession={session} />;
}

