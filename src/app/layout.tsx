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
    <html lang="id">
      <body className="antialiased bg-[#f9f9ff] text-[#111c2d] selection:bg-[#00a2b9]/20 selection:text-[#006877] min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
