import React from "react";
import { cn } from "@/lib/utils";

export interface FloatingUtilityCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  metric: string | number;
  secondaryInfo?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function FloatingUtilityCard({
  label,
  metric,
  secondaryInfo,
  actionText,
  onAction,
  icon,
  className,
  children,
  ...props
}: FloatingUtilityCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl p-5 border border-[#e2e8f0] card-floating-sm flex flex-col justify-between transition-all duration-150",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-body-meta text-[#64748b] font-medium tracking-normal block">
            {label}
          </span>
          <div className="text-headline-lg text-[#0f172a] font-bold mt-1 tracking-tight">
            {metric}
          </div>
          {secondaryInfo && (
            <p className="text-body-meta text-[#64748b] mt-1">
              {secondaryInfo}
            </p>
          )}
        </div>

        {icon && (
          <div className="w-10 h-10 rounded-full bg-[#f0f3ff] text-[#006877] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>

      {actionText && onAction && (
        <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center justify-between">
          <button
            type="button"
            onClick={onAction}
            className="text-label-action text-[#00a2b9] hover:text-[#0097a7] font-semibold transition-colors focus-utility-ring rounded cursor-pointer"
          >
            {actionText}
          </button>
        </div>
      )}

      {children}
    </div>
  );
}
