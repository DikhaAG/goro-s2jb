import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell pageTitle="Entri Eviden Lapangan">{children}</AppShell>;
}
