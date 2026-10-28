import React from "react";
import { TriageDashboard } from "@/components/operator/TriageDashboard";

export const metadata = {
  title: "Dasbor Triase Operator (Human-in-the-Loop) | GORO S2JB 2026",
  description:
    "Antarmuka komando verifikasi ulasan Google Play Store dan anti-fraud PLN Mobile untuk Pegawai Verifikator",
};

export default function OperatorTriagePage() {
  return <TriageDashboard />;
}
