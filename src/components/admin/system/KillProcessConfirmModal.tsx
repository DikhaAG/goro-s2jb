"use client";

import React, { useState } from "react";
import { AlertTriangle, AlertOctagon, X } from "lucide-react";
import { ManagedProcessItem } from "./RunningProcessTable";

interface KillProcessConfirmModalProps {
  process: ManagedProcessItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pid: number, reason: string, force: boolean) => void;
  isSubmitting?: boolean;
}

export function KillProcessConfirmModal({
  process,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}: KillProcessConfirmModalProps) {
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);

  if (!isOpen || !process) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) return;
    onConfirm(process.pid, reason.trim(), force);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f172a]/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e2e8f0] animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 bg-[#fef2f2] text-[#dc2626] rounded-2xl border border-[#fecaca] flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6 text-[#dc2626]" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#0f172a] p-1.5 rounded-xl hover:bg-[#f1f5f9] transition-colors focus-utility-ring"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-bold text-[#0f172a] tracking-tight">
            Konfirmasi Penghentian Proses
          </h3>
          <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
            Tindakan ini akan mengirimkan sinyal pemutusan ke sistem operasi. Aksi ini akan dicatat ke dalam rekam jejak Audit Log.
          </p>
        </div>

        {/* Process Detail Summary */}
        <div className="mt-4 p-4 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-[#64748b]">Process ID:</span>
            <span className="font-bold text-[#0f172a]">PID {process.pid}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Jenis Layanan:</span>
            <span className="font-bold text-[#006877]">{process.serviceType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748b]">Waktu Berjalan:</span>
            <span className="text-[#0f172a]">{process.elapsedTime}</span>
          </div>
          <div className="pt-2 border-t border-[#e2e8f0] text-[#475569] text-[11px] truncate">
            {process.command}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider">
              Alasan Penghentian (Wajib Diisi):
            </label>
            <input
              type="text"
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Proses menggantung / socket tidak tertutup"
              className="w-full text-xs min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] focus-utility-ring text-[#0f172a] placeholder:text-[#94a3b8] transition-all"
            />
          </div>

          {/* Force SIGKILL Checkbox */}
          <div className="flex items-center gap-2.5 p-3 bg-[#fff7ed] rounded-xl border border-[#fed7aa]">
            <input
              type="checkbox"
              id="force-kill"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="w-4 h-4 text-[#dc2626] rounded border-[#fed7aa] focus:ring-[#dc2626]"
            />
            <label htmlFor="force-kill" className="text-xs text-[#9a3412] cursor-pointer">
              <strong>Paksa Berhenti (SIGKILL):</strong> Gunakan hanya jika proses macet total dan tidak merespons penghentian normal.
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9] transition-all focus-utility-ring cursor-pointer disabled:opacity-50"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 3}
              className="min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold bg-[#dc2626] hover:bg-[#b91c1c] text-white shadow-xs transition-all focus-utility-ring cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Menghentikan..." : force ? "Paksa Hentikan (SIGKILL)" : "Hentikan Proses (SIGTERM)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
