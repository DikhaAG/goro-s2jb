import React from "react";
import { ReviewsDashboard } from "@/components/operator/reviews/ReviewsDashboard";

export const metadata = {
  title: "Pusat Manajemen & Pengelolaan Data Ulasan | GORO S2JB 2026",
  description:
    "Antarmuka komando penelusuran, inspeksi, koreksi data hasil migrasi Google Form, dan kontrol kuratif operator UID S2JB",
};

export default function OperatorReviewsPage() {
  return <ReviewsDashboard />;
}

