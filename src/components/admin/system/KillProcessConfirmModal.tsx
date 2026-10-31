"use client";

import React, { useState } from "react";
import { AlertTriangle, AlertOctagon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight">
            Konfirmasi Penghentian Proses
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Tindakan ini akan mengirimkan sinyal pemutusan ke sistem operasi. Aksi ini akan dicatat ke dalam rekam jejak Audit Log.
          </p>
        </div>

        {/* Process Detail Summary */}
        <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500">Process ID:</span>
            <span className="font-semibold text-slate-900">PID {process.pid}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Jenis Layanan:</span>
            <span className="font-medium text-slate-800">{process.serviceType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Waktu Berjalan:</span>
            <span className="text-slate-700">{process.elapsedTime}</span>
          </div>
          <div className="pt-1.5 border-t border-slate-200 text-slate-600 text-[11px] truncate">
            {process.command}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Alasan Penghentian (Wajib Diisi):
            </label>
            <input
              type="text"
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Proses menggantung / socket tidak tertutup"
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-slate-800"
            />
          </div>

          {/* Force SIGKILL Checkbox */}
          <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200/60">
            <input
              type="checkbox"
              id="force-kill"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="w-4 h-4 text-rose-600 rounded border-amber-300 focus:ring-rose-500"
            />
            <label htmlFor="force-kill" className="text-xs text-amber-900 cursor-pointer">
              <strong>Paksa Berhenti (SIGKILL):</strong> Gunakan hanya jika proses macet total dan tidak merespons penghentian normal.
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 text-xs px-4 rounded-xl border-slate-200 text-slate-600"
            >
              Batalkan
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 3}
              className="h-9 text-xs px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-sm transition-all"
            >
              {isSubmitting ? "Menghentikan..." : force ? "Paksa Hentikan (SIGKILL)" : "Hentikan Proses (SIGTERM)"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
