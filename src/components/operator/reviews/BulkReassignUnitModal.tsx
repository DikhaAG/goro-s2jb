"use client";

import React, { useState } from "react";
import { X, Building2, RefreshCw, CheckCircle2 } from "lucide-react";

interface Up3Option {
  id: string;
  code: string;
  name: string;
}

interface UlpOption {
  id: string;
  code: string;
  name: string;
  up3Id: string;
}

interface BulkReassignUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  up3s: Up3Option[];
  ulps: UlpOption[];
  onConfirm: (data: { up3Id: string; ulpId: string; remarks?: string }) => void;
  isSubmitting?: boolean;
}

export function BulkReassignUnitModal({
  isOpen,
  onClose,
  selectedIds,
  up3s,
  ulps,
  onConfirm,
  isSubmitting = false,
}: BulkReassignUnitModalProps) {
  const [up3Id, setUp3Id] = useState("");
  const [ulpId, setUlpId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredUlps = up3Id
    ? ulps.filter((u) => u.up3Id === up3Id)
    : ulps;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!up3Id || !ulpId) {
      setError("Unit UP3 dan ULP tujuan wajib dipilih.");
      return;
    }
    setError(null);
    onConfirm({
      up3Id,
      ulpId,
      remarks: remarks.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#e2e8f0] overflow-hidden z-10 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center border border-[#cfdaf2]">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">
                Pindahkan Unit Kerja Massal
              </h3>
              <p className="text-xs text-[#64748b]">
                <span className="font-semibold text-[#006877] font-mono">{selectedIds.length}</span> baris ulasan akan diperbarui
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] h-9 w-9 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#64748b] flex items-center justify-center transition-colors cursor-pointer focus-utility-ring shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-xs text-[#b91c1c] font-medium">
              {error}
            </div>
          )}

          {/* Target UP3 */}
          <div>
            <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
              Unit Pelaksana Pelayanan (UP3) Tujuan *
            </label>
            <select
              value={up3Id}
              onChange={(e) => {
                setUp3Id(e.target.value);
                setUlpId("");
              }}
              required
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
            >
              <option value="">Pilih UP3 Tujuan</option>
              {up3s.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target ULP */}
          <div>
            <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
              Unit Layanan Pelanggan (ULP) Tujuan *
            </label>
            <select
              value={ulpId}
              onChange={(e) => setUlpId(e.target.value)}
              required
              disabled={!up3Id}
              className="w-full min-h-[42px] px-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium disabled:opacity-50"
            >
              <option value="">Pilih ULP Tujuan</option>
              {filteredUlps.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Alasan / Remarks */}
          <div>
            <label className="block text-xs font-semibold text-[#0f172a] mb-1.5">
              Alasan Pemindahan Unit (Opsional)
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Contoh: Koreksi salah unit pada Google Form migrasi..."
              className="w-full p-3 rounded-xl border border-[#cbd5e1] bg-[#f8fafc] text-xs text-[#0f172a] focus:bg-white focus-utility-ring font-medium"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] h-11 px-4 rounded-xl border border-[#cbd5e1] text-[#334155] hover:bg-[#f8fafc] text-xs font-semibold transition-colors cursor-pointer focus-utility-ring shadow-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] h-11 px-5 rounded-xl bg-[#00a2b9] hover:bg-[#008b9e] text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-utility-ring"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Terapkan Pemindahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
