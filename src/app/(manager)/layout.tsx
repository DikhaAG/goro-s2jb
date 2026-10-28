import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell pageTitle="Laporan & Intelijen Manajer">{children}</AppShell>;
}
