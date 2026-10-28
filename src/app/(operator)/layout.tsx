import React from "react";
import { AppShell } from "@/components/layout/AppShell";

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell pageTitle="Triase Ulasan Operator">{children}</AppShell>;
}
