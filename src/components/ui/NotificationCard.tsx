import React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, Info, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";

export type NotificationStatus = "info" | "warning" | "success" | "error";

export interface NotificationCardProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: NotificationStatus;
  title: string;
  metaItems?: string[]; // array of strings joined by center dot ' • '
  subtitle?: string; // or direct formatted string
  icon?: React.ReactNode;
  showChevron?: boolean;
  onAction?: () => void;
}

const statusConfig: Record<
  NotificationStatus,
  {
    bgClass: string;
    iconContainerClass: string;
    defaultIcon: React.ReactNode;
  }
> = {
  info: {
    bgClass: "bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0]",
    iconContainerClass: "bg-[#475569] text-white",
    defaultIcon: <Info className="w-5 h-5" />,
  },
  warning: {
    bgClass: "bg-[#fff7ed] hover:bg-[#ffedd5] border border-[#fed7aa]",
    iconContainerClass: "bg-[#f97316] text-white",
    defaultIcon: <AlertTriangle className="w-5 h-5" />,
  },
  success: {
    bgClass: "bg-[#f0fdf4] hover:bg-[#dcfce7] border border-[#bbf7d0]",
    iconContainerClass: "bg-[#22c55e] text-white",
    defaultIcon: <CheckCircle2 className="w-5 h-5" />,
  },
  error: {
    bgClass: "bg-[#fef2f2] hover:bg-[#fee2e2] border border-[#fecaca]",
    iconContainerClass: "bg-[#ef4444] text-white",
    defaultIcon: <AlertCircle className="w-5 h-5" />,
  },
};

export function NotificationCard({
  status = "info",
  title,
  metaItems,
  subtitle,
  icon,
  showChevron = true,
  className,
  onClick,
  ...props
}: NotificationCardProps) {
  const config = statusConfig[status];

  // Enforce mandatory center dot separator rule (DESIGN.md)
  const formattedSubtitle = metaItems && metaItems.length > 0
    ? metaItems.filter(Boolean).join(" • ")
    : subtitle;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          (onClick as any)(e);
        }
      }}
      className={cn(
        "flex flex-row items-center gap-4 w-full p-4 rounded-2xl transition-all duration-150 card-pastel-flat select-none",
        onClick && "cursor-pointer focus-utility-ring active:scale-[0.99]",
        config.bgClass,
        className
      )}
      {...props}
    >
      {/* Leading Icon Badge: 40px x 40px full circle */}
      <div
        className={cn(
          "w-10 h-10 min-w-10 rounded-full flex items-center justify-center shrink-0 shadow-xs",
          config.iconContainerClass
        )}
      >
        {icon || config.defaultIcon}
      </div>

      {/* Content Block */}
      <div className="flex flex-col text-left overflow-hidden">
        <h4 className="text-title-card text-[#1e293b] font-semibold truncate leading-tight">
          {title}
        </h4>
        {formattedSubtitle && (
          <p className="text-body-meta text-[#64748b] truncate mt-0.5">
            {formattedSubtitle}
          </p>
        )}
      </div>

      {/* Trailing Chevron Action */}
      {showChevron && (
        <div className="ml-auto shrink-0 pl-2 text-[#94a3b8]">
          <ChevronRight className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}
