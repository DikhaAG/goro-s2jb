import React from "react";
import { IntakeForm } from "@/components/forms/IntakeForm";

export const metadata = {
  title: "Entri Eviden | GORO S2JB 2026",
  description: "Formulir cepat pengumpulan bukti rating pelanggan PLN Mobile untuk Petugas Lapangan",
};

export default function IntakePage() {
  return (
    <div className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      <IntakeForm />
    </div>
  );
}
