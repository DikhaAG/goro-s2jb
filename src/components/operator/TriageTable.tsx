"use client";

import React, { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TriageRow, TriageRowData } from "./TriageRow";
import { CheckCircle2 } from "lucide-react";

interface TriageTableProps {
  items: TriageRowData[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpenLightbox: (item: TriageRowData) => void;
  onApprove: (id: string) => void;
  onReject: (item: TriageRowData) => void;
}

export function TriageTable({
  items,
  activeId,
  onSelect,
  onOpenLightbox,
  onApprove,
  onReject,
}: TriageTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 145,
    overscan: 5,
  });

  // Automatically scroll active item into view when changed via keyboard hotkeys
  useEffect(() => {
    if (!activeId) return;
    const activeIndex = items.findIndex((i) => i.id === activeId);
    if (activeIndex >= 0) {
      virtualizer.scrollToIndex(activeIndex, {
        align: "auto",
        behavior: "smooth",
      });
    }
  }, [activeId, items, virtualizer]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#e2e8f0] rounded-2xl text-center space-y-3 shadow-xs">
        <div className="p-4 bg-[#ecfdf5] border border-[#a7f3d0] rounded-full text-[#16a34a]">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#0f172a]">
            Antrean Triase Bersih!
          </h3>
          <p className="text-xs text-[#64748b] max-w-sm mt-1">
            Tidak ada ulasan pada filter yang dipilih. Seluruh data Zona Kuning telah diverifikasi oleh operator.
          </p>
        </div>
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-320px)] min-h-[500px] overflow-y-auto rounded-2xl border border-[#e2e8f0] bg-white p-2.5 relative shadow-xs"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;

          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="pb-2"
            >
              <TriageRow
                item={item}
                isActive={item.id === activeId}
                onSelect={onSelect}
                onOpenLightbox={onOpenLightbox}
                onApprove={onApprove}
                onReject={onReject}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
