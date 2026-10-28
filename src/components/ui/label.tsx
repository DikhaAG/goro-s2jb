import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-semibold text-slate-300 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center space-x-1",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {required && <span className="text-red-400 font-bold">*</span>}
    </label>
  )
);
Label.displayName = "Label";
