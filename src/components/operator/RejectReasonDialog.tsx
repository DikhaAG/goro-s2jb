"use client";

import React, { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RejectReasonDialogProps {
  isOpen: boolean;
  reviewerName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const PRESET_REASONS = [
  "Nama akun tidak cocok",
  "Eviden buram / tidak terbaca",
  "Bukan ulasan rating PLN Mobile",
  "Bintang rating kurang dari 5",
  "Format bukti tidak valid",
  "Terindikasi duplikasi bukti",
];

export function RejectReasonDialog({
  isOpen,
  reviewerName,
  onClose,
  onConfirm,
}: RejectReasonDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(PRESET_REASONS[0]);
      setCustomReason("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = customReason.trim().length > 0 ? customReason.trim() : selectedReason;
    onConfirm(finalReason);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5 text-red-400">
            <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Tolak Ulasan</h3>
              <p className="text-xs text-slate-400">
                Pilih alasan penolakan untuk <span className="text-amber-300 font-mono">{reviewerName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Pilihan Cepat Alasan:
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_REASONS.map((reason) => {
                const isSelected = selectedReason === reason && !customReason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setSelectedReason(reason);
                      setCustomReason("");
                    }}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all text-left ${
                      isSelected
                        ? "bg-red-500/20 text-red-200 border-red-500/50 font-medium"
                        : "bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Atau Tulis Catatan Kustom:
            </label>
            <Input
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Contoh: Tangkapan layar salah aplikasi..."
              className="bg-slate-950 border-slate-800 text-xs text-slate-200 h-9"
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-9 text-xs"
            >
              Batal [Esc]
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="flex-1 h-9 text-xs bg-red-600 hover:bg-red-500 text-white font-medium"
            >
              Konfirmasi Tolak [Enter]
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
