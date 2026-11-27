"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-30 min-w-40 rounded-xl border border-[#e2e8f0] bg-white p-2 shadow-lg outline-none space-y-1",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn("px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#64748b]", className)}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(
        "group flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-[#0f172a] cursor-pointer select-none outline-none focus-utility-ring data-[highlighted]:bg-[#f1f5f9]",
        className
      )}
      {...props}
    >
      <span
        className="w-4 h-4 shrink-0 rounded border border-[#64748b] bg-white inline-flex items-center justify-center group-data-[state=checked]:border-[#006877] group-data-[state=checked]:bg-[#006877]"
        aria-hidden
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}
