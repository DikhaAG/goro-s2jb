"use client";

import React, { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { CascadingUnitSelect } from "./CascadingUnitSelect";
import {
  UploadCloud,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Smartphone,
  Calendar,
  User,
  Tag,
  FileText,
  Clock,
  X,
  Zap,
} from "lucide-react";
import { intakeReviewSchema, MAX_FILE_SIZE_BYTES, ACCEPTED_IMAGE_TYPES } from "@/lib/validators/intake";

function getTodayString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function IntakeForm() {
  const versionsQuery = trpc.master.getVersions.useQuery();
  const submitMutation = trpc.intake.submitReview.useMutation();

  const [formData, setFormData] = useState({
    up3Id: "",
    ulpId: "",
    playstoreReviewerName: "",
    entryDate: getTodayString(),
    appVersionId: "",
    originalReviewerName: "",
    reviewerCategory: "Pelanggan",
    fieldNotes: "",
    evidenceImageBase64: "",
    evidenceFilename: "",
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [successInfo, setSuccessInfo] = useState<{
    reviewId: string;
    evidencePath: string;
    latencyMs: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set default appVersionId when query loads
  React.useEffect(() => {
    if (!formData.appVersionId && versionsQuery.data && versionsQuery.data.length > 0) {
      setFormData((prev) => ({ ...prev, appVersionId: versionsQuery.data[0].id }));
    }
  }, [versionsQuery.data, formData.appVersionId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setFormErrors((prev) => ({
        ...prev,
        evidenceImageBase64: "Format file harus JPG, PNG, atau WebP",
      }));
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFormErrors((prev) => ({
        ...prev,
        evidenceImageBase64: "Ukuran berkas melebihi batas 5 MB",
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setFormData((prev) => ({
        ...prev,
        evidenceImageBase64: base64,
        evidenceFilename: file.name,
      }));
      setPreviewUrl(base64);
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy.evidenceImageBase64;
        return copy;
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setPreviewUrl(null);
    setFormData((prev) => ({
      ...prev,
      evidenceImageBase64: "",
      evidenceFilename: "",
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessInfo(null);

    // Validate with Zod
    const validation = intakeReviewSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        errors[path] = issue.message;
      });
      setFormErrors(errors);
      return;
    }

    setFormErrors({});

    try {
      const res = await submitMutation.mutateAsync(validation.data);
      setSuccessInfo({
        reviewId: res.reviewId,
        evidencePath: res.evidencePath,
        latencyMs: res.latencyMs,
      });

      // Reset form partially for rapid multi-submission (keep UP3/ULP for field officer convenience)
      setFormData((prev) => ({
        ...prev,
        playstoreReviewerName: "",
        originalReviewerName: "",
        fieldNotes: "",
        evidenceImageBase64: "",
        evidenceFilename: "",
      }));
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("Submission failed:", err);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="p-5 sm:p-6 border-b border-[#f1f5f9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00a2b9]" />
            <h2 className="text-lg font-bold text-[#0f172a] tracking-tight">
              Formulir Bukti Ulasan Lapangan
            </h2>
          </div>
          <p className="text-xs text-[#64748b] mt-1">
            Data ulasan akan diverifikasi secara otomatis oleh worker OCR dan siap ditinjau di modul triase.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#00a2b9] text-[#006877] bg-[#f0fdfa] text-xs font-bold self-start sm:self-auto">
          <Zap className="w-3.5 h-3.5 text-[#00a2b9]" />
          <span>Intake Realtime</span>
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="p-5 sm:p-6 space-y-6">
          {/* Success Banner */}
          {successInfo && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#15803d] flex items-start space-x-3.5 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="w-5 h-5 text-[#16a34a] shrink-0 mt-0.5" />
              <div className="flex-1 text-xs space-y-1.5">
                <div className="font-bold text-sm text-[#15803d]">
                  Eviden Berhasil Disimpan & Masuk Antrean Verifikasi!
                </div>
                <div className="text-[#166534]">
                  ID Ulasan: <span className="font-mono font-bold text-[#15803d]">{successInfo.reviewId}</span>
                </div>
                <div className="text-[#15803d] flex items-center space-x-2">
                  <span>Waktu Respon: <strong className="font-mono">{successInfo.latencyMs} ms</strong></span>
                  <span>•</span>
                  <span>Status Awal: <strong className="font-mono uppercase">PENDING</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Mutation Error Banner */}
          {submitMutation.isError && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] flex items-start space-x-3.5 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-sm text-[#b91c1c]">Gagal Mengirim Eviden</div>
                <div className="mt-0.5">{submitMutation.error.message}</div>
              </div>
            </div>
          )}

          {/* 1. Cascading Unit Selection */}
          <CascadingUnitSelect
            selectedUp3Id={formData.up3Id}
            selectedUlpId={formData.ulpId}
            onUp3Change={(up3Id) => setFormData((prev) => ({ ...prev, up3Id }))}
            onUlpChange={(ulpId) => setFormData((prev) => ({ ...prev, ulpId }))}
            errors={{
              up3Id: formErrors.up3Id,
              ulpId: formErrors.ulpId,
            }}
          />

          {/* 2. Reviewer Name & Entry Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="playstoreReviewerName"
                className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-[#006877]" />
                <span>Nama Pengulas Play Store</span>
                <span className="text-[#ef4444] font-bold">*</span>
              </label>
              <input
                id="playstoreReviewerName"
                type="text"
                placeholder="Misal: Ahmad Dani atau Budi Santoso"
                value={formData.playstoreReviewerName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, playstoreReviewerName: e.target.value }))
                }
                className={`flex min-h-[44px] w-full rounded-xl border bg-[#f8fafc] px-3.5 py-2.5 text-xs sm:text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus-utility-ring transition-all ${
                  formErrors.playstoreReviewerName ? "border-[#ef4444]" : "border-[#cbd5e1]"
                }`}
              />
              {formErrors.playstoreReviewerName && (
                <p className="text-[11px] text-[#b91c1c] font-medium mt-1">{formErrors.playstoreReviewerName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="entryDate"
                className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-[#0284c7]" />
                <span>Tanggal Entri</span>
                <span className="text-[#ef4444] font-bold">*</span>
              </label>
              <input
                id="entryDate"
                type="date"
                value={formData.entryDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, entryDate: e.target.value }))
                }
                className={`flex min-h-[44px] w-full rounded-xl border bg-[#f8fafc] px-3.5 py-2.5 text-xs sm:text-sm text-[#0f172a] focus-utility-ring transition-all ${
                  formErrors.entryDate ? "border-[#ef4444]" : "border-[#cbd5e1]"
                }`}
              />
              {formErrors.entryDate && (
                <p className="text-[11px] text-[#b91c1c] font-medium mt-1">{formErrors.entryDate}</p>
              )}
            </div>
          </div>

          {/* 3. Version & Original Customer Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="appVersionSelect"
                className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5 text-[#006877]" />
                <span>Versi PLN Mobile</span>
                <span className="text-[#ef4444] font-bold">*</span>
              </label>
              <select
                id="appVersionSelect"
                value={formData.appVersionId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, appVersionId: e.target.value }))
                }
                className={`flex min-h-[44px] w-full rounded-xl border bg-[#f8fafc] px-3.5 py-2.5 text-xs sm:text-sm text-[#0f172a] focus-utility-ring transition-all ${
                  formErrors.appVersionId ? "border-[#ef4444]" : "border-[#cbd5e1]"
                }`}
              >
                <option value="">-- Pilih Versi --</option>
                {versionsQuery.data?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version}
                  </option>
                ))}
              </select>
              {formErrors.appVersionId && (
                <p className="text-[11px] text-[#b91c1c] font-medium mt-1">{formErrors.appVersionId}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="originalReviewerName"
                className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-[#64748b]" />
                <span>Nama Asli Pelanggan (Sesuai KTP)</span>
              </label>
              <input
                id="originalReviewerName"
                type="text"
                placeholder="Opsional jika berbeda dengan nama Play Store"
                value={formData.originalReviewerName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, originalReviewerName: e.target.value }))
                }
                className="flex min-h-[44px] w-full rounded-xl border border-[#cbd5e1] bg-[#f8fafc] px-3.5 py-2.5 text-xs sm:text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus-utility-ring transition-all"
              />
            </div>
          </div>

          {/* 4. Evidence Image Dropzone */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-[#006877]" />
              <span>Foto Bukti Eviden (Tangkapan Layar Ulasan)</span>
              <span className="text-[#ef4444] font-bold">*</span>
            </label>

            {previewUrl ? (
              <div className="relative rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4 flex flex-col sm:flex-row items-center gap-4 shadow-xs">
                <div className="relative w-36 h-48 rounded-xl overflow-hidden border border-[#cbd5e1] bg-white shrink-0 shadow-xs">
                  <img
                    src={previewUrl}
                    alt="Pratinjau Eviden"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-[#0f172a]/70 hover:bg-[#dc2626] text-white transition-all cursor-pointer focus-utility-ring"
                    title="Hapus gambar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-[#475569] space-y-1.5">
                  <div className="font-bold text-sm text-[#0f172a]">
                    {formData.evidenceFilename || "eviden_selected.png"}
                  </div>
                  <div className="text-[#15803d] flex items-center space-x-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                    <span>Gambar siap diunggah & diproses OCR</span>
                  </div>
                  <p className="text-[#64748b] text-[11px] leading-relaxed">
                    Foto akan otomatis disimpan ke direktori lokal terstruktur dan diekstraksi teksnya oleh AI vision service.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9] transition-all focus-utility-ring cursor-pointer"
                  >
                    Ganti Foto
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                tabIndex={0}
                role="button"
                aria-label="Pilih foto atau ambil gambar kamera"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    fileInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 focus-utility-ring ${
                  formErrors.evidenceImageBase64
                    ? "border-[#fecaca] bg-[#fef2f2]"
                    : "border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] hover:border-[#00a2b9]"
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-white border border-[#e2e8f0] flex items-center justify-center text-[#006877] shadow-xs">
                  <UploadCloud className="w-7 h-7 text-[#006877]" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#0f172a]">
                    Klik untuk Memilih Foto atau Mengambil Kamera
                  </div>
                  <p className="text-xs text-[#64748b] mt-1">
                    Mendukung format JPG, PNG, atau WebP (Ukuran maksimal 5 MB).
                  </p>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {formErrors.evidenceImageBase64 && (
              <p className="text-[11px] text-[#b91c1c] font-medium mt-1">{formErrors.evidenceImageBase64}</p>
            )}
          </div>

          {/* 5. Field Notes */}
          <div className="space-y-1.5">
            <label
              htmlFor="fieldNotes"
              className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#64748b]" />
              <span>Catatan Lapangan (Opsional)</span>
            </label>
            <textarea
              id="fieldNotes"
              rows={2}
              placeholder="Catatan tambahan kondisi pelaksanaan di lapangan..."
              value={formData.fieldNotes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, fieldNotes: e.target.value }))
              }
              className="flex w-full rounded-xl border border-[#cbd5e1] bg-[#f8fafc] px-3.5 py-2.5 text-xs sm:text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus-utility-ring transition-all"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#f1f5f9] bg-[#f8fafc] flex flex-col sm:flex-row gap-3 justify-between items-center">
          <button
            type="button"
            onClick={() => {
              setFormData({
                up3Id: "",
                ulpId: "",
                playstoreReviewerName: "",
                entryDate: getTodayString(),
                appVersionId: versionsQuery.data?.[0]?.id || "",
                originalReviewerName: "",
                reviewerCategory: "Pelanggan",
                fieldNotes: "",
                evidenceImageBase64: "",
                evidenceFilename: "",
              });
              setPreviewUrl(null);
              setFormErrors({});
              setSuccessInfo(null);
            }}
            disabled={submitMutation.isPending}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-bold text-[#334155] transition-all min-h-[44px] flex items-center justify-center gap-2 focus-utility-ring cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#64748b]" />
            <span>Reset Formulir</span>
          </button>

          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full sm:w-auto min-w-[220px] px-5 py-2.5 rounded-xl bg-[#00a2b9] hover:bg-[#008c9f] text-white min-h-[44px] text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all focus-utility-ring cursor-pointer disabled:opacity-50"
          >
            {submitMutation.isPending ? (
              <span className="flex items-center space-x-2">
                <Clock className="w-4 h-4 animate-spin text-white" />
                <span>Menyimpan Eviden...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span>Kirim Eviden Rating</span>
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
