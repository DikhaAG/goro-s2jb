import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex min-h-[44px] h-11 w-full rounded-lg border border-[#cbd5e1] bg-[#f8fafc] px-3.5 py-2 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus-visible:outline-none focus-visible:border-[#00a2b9] focus-visible:ring-2 focus-visible:ring-[#00a2b9] disabled:cursor-not-allowed disabled:opacity-50 transition-all font-sans",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
