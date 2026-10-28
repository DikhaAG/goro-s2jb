import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "reward" | "neutral";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-[#e7eeff] text-[#006877] border-[#cfdaf2]",
    info: "bg-[#f8fafc] text-[#475569] border-[#e2e8f0]",
    neutral: "bg-[#f8fafc] text-[#334155] border-[#e2e8f0]",
    secondary: "bg-[#f1f5f9] text-[#334155] border-[#cbd5e1]",
    destructive: "bg-[#fef2f2] text-[#b91c1c] border-[#fee2e2]",
    success: "bg-[#f0fdf4] text-[#15803d] border-[#dcfce7]",
    warning: "bg-[#fff7ed] text-[#c2410c] border-[#ffedd5]",
    reward: "bg-[#fff7ed] text-[#ea580c] border-[#fed7aa] font-semibold",
    outline: "text-[#1e293b] border-[#cbd5e1] bg-white",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors font-sans",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
