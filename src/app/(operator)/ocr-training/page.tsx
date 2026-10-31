import React from "react";
import { OcrTrainingDashboard } from "@/components/operator/training/OcrTrainingDashboard";

export const metadata = {
  title: "Pelatihan & Model OCR Deep Learning | GORO S2JB 2026",
  description:
    "Pusat komando pelatihan kontinu, manajemen katalog model CRNN PyTorch, kurasi data latih, dan hot-reload produksi tanpa downtime UID S2JB",
};

export default function OcrTrainingPage() {
  return <OcrTrainingDashboard />;
}

