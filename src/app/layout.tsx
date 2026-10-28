import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "GORO S2JB 2026 | Command Center & Validasi Eviden",
  description:
    "Sistem Taktis Pemantauan Gotong Royong Rating PLN Mobile UID S2JB (Sumatera Selatan, Jambi, dan Bengkulu) 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="antialiased bg-[#090d16] text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
