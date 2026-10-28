import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "teal" | "tactical";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a2b9] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]";

    const variantStyles = {
      default:
        "bg-[#00a2b9] text-white hover:bg-[#0097a7] rounded-lg font-semibold shadow-xs",
      teal:
        "bg-[#00a2b9] text-white hover:bg-[#0097a7] rounded-lg font-semibold shadow-xs",
      tactical:
        "bg-[#00a2b9] text-white hover:bg-[#0097a7] rounded-lg font-semibold shadow-xs",
      destructive:
        "bg-[#ef4444] text-white hover:bg-[#dc2626] rounded-lg font-semibold shadow-xs",
      outline:
        "border border-[#cbd5e1] bg-white text-[#1e293b] hover:bg-[#f8fafc] rounded-lg font-medium",
      secondary:
        "bg-[#f0f3ff] text-[#006877] hover:bg-[#e7eeff] rounded-lg font-semibold",
      ghost:
        "text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] rounded-lg",
      link:
        "text-[#00a2b9] font-semibold underline-offset-4 hover:underline p-0 h-auto",
    };

    // Minimum 44px tap target for default and lg (R-03 compliance)
    const sizeStyles = {
      default: "min-h-[44px] h-11 px-4 py-2 text-sm rounded-lg",
      sm: "h-9 rounded-md px-3 text-xs",
      lg: "min-h-[48px] h-12 rounded-xl px-6 text-base font-semibold",
      icon: "min-h-[44px] min-w-[44px] h-11 w-11 rounded-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
