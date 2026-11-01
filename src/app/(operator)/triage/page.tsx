import { redirect } from "next/navigation";

export const metadata = {
  title: "Triase Ulasan | GORO S2JB 2026",
  description: "Pengalihan otomatis ke modul verifikasi ulasan terpadu",
};

export default function OperatorTriagePage() {
  redirect("/reviews");
}

