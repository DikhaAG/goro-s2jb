"use client";

import React, { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { CascadingUnitSelect } from "./CascadingUnitSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <Card className="border-[#e2e8f0] bg-white shadow-xs rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-[#f1f5f9] pb-5">
        <div className="flex items-center justify-between">
          <Badge variant="neutral" className="gap-1.5 py-1">
            <Smartphone className="w-3.5 h-3.5 text-[#006877]" />
            <span>Formulir Lapangan Taktis</span>
          </Badge>
          <span className="text-[11px] font-mono text-[#64748b]">
            Fase 2: Mesin Intake
          </span>
        </div>
        <CardTitle className="text-xl font-bold text-[#0f172a] mt-2">
          Entri Eviden Rating Pelanggan
        </CardTitle>
        <CardDescription className="text-[#64748b]">
          Catat ulasan Play Store pelanggan dan unggah bukti tangkapan layar untuk verifikasi otomatis OCR.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5 pt-6">
          {/* Success Banner */}
          {successInfo && (
            <div className="p-4 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] flex items-start space-x-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="w-5 h-5 text-[#16a34a] shrink-0 mt-0.5" />
              <div className="flex-1 text-xs space-y-1">
                <div className="font-bold text-sm text-[#065f46]">
                  Eviden Berhasil Disimpan & Masuk Antrean Verifikasi!
                </div>
                <div className="text-[#047857]">
                  ID Review: <span className="font-mono font-bold text-[#065f46]">{successInfo.reviewId}</span>
                </div>
                <div className="text-[#059669] flex items-center space-x-2">
                  <span>Waktu Respon: <strong className="font-mono text-[#065f46]">{successInfo.latencyMs} ms</strong></span>
                  <span>•</span>
                  <span>Status Awal: <strong className="font-mono text-[#065f46]">PENDING</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Mutation Error */}
          {submitMutation.isError && (
            <div className="p-4 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-sm text-[#991b1b]">Gagal Mengirim Eviden</div>
                <div>{submitMutation.error.message}</div>
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
              <Label required htmlFor="playstoreReviewerName">
                <User className="w-3.5 h-3.5 text-[#006877] mr-1" />
                Nama Pengulas Play Store
              </Label>
              <Input
                id="playstoreReviewerName"
                placeholder="Misal: Ahmad Dani atau Budi Santoso"
                value={formData.playstoreReviewerName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, playstoreReviewerName: e.target.value }))
                }
                className={formErrors.playstoreReviewerName ? "border-[#ef4444]" : ""}
              />
              {formErrors.playstoreReviewerName && (
                <p className="text-[11px] text-[#b91c1c] font-medium">{formErrors.playstoreReviewerName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label required htmlFor="entryDate">
                <Calendar className="w-3.5 h-3.5 text-[#0284c7] mr-1" />
                Tanggal Entri
              </Label>
              <Input
                id="entryDate"
                type="date"
                value={formData.entryDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, entryDate: e.target.value }))
                }
                className={formErrors.entryDate ? "border-[#ef4444]" : ""}
              />
              {formErrors.entryDate && (
                <p className="text-[11px] text-[#b91c1c] font-medium">{formErrors.entryDate}</p>
              )}
            </div>
          </div>

          {/* 3. Version & Original Customer Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label required htmlFor="appVersionSelect">
                <Tag className="w-3.5 h-3.5 text-[#7c3aed] mr-1" />
                Versi PLN Mobile
              </Label>
              <select
                id="appVersionSelect"
                value={formData.appVersionId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, appVersionId: e.target.value }))
                }
                className={`flex h-11 min-h-[44px] w-full rounded-xl border bg-[#f8fafc] px-3.5 py-2 text-sm text-[#0f172a] focus-utility-ring transition-colors ${
                  formErrors.appVersionId ? "border-[#ef4444]" : "border-[#cbd5e1] focus:border-[#00a2b9]"
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
                <p className="text-[11px] text-[#b91c1c] font-medium">{formErrors.appVersionId}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="originalReviewerName">
                Nama Asli Pelanggan (KTP)
              </Label>
              <Input
                id="originalReviewerName"
                placeholder="Opsional jika berbeda dengan nama Play Store"
                value={formData.originalReviewerName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, originalReviewerName: e.target.value }))
                }
              />
            </div>
          </div>

          {/* 4. Evidence Image Dropzone */}
          <div className="space-y-2">
            <Label required>
              <Camera className="w-3.5 h-3.5 text-[#006877] mr-1" />
              Foto Bukti Eviden (Tangkapan Layar Ulasan)
            </Label>

            {previewUrl ? (
              <div className="relative rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-36 h-48 rounded-xl overflow-hidden border border-[#cbd5e1] bg-white shrink-0 shadow-xs">
                  <img
                    src={previewUrl}
                    alt="Pratinjau Eviden"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-[#0f172a]/70 hover:bg-[#ef4444] text-white transition cursor-pointer"
                    title="Hapus gambar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-[#475569] space-y-1.5">
                  <div className="font-semibold text-[#0f172a]">
                    {formData.evidenceFilename || "eviden_selected.png"}
                  </div>
                  <div className="text-[#15803d] flex items-center space-x-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                    <span>Gambar siap diunggah & diproses OCR</span>
                  </div>
                  <p className="text-[#64748b] text-[11px]">
                    Foto akan otomatis disimpan ke direktori lokal terstruktur dan diekstraksi teksnya oleh AI vision service.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-xs min-h-[36px]"
                  >
                    Ganti Foto
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 bg-[#f8fafc] hover:bg-[#f1f5f9] ${
                  formErrors.evidenceImageBase64
                    ? "border-[#ef4444]"
                    : "border-[#cbd5e1] hover:border-[#00a2b9]"
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-[#e7eeff] text-[#006877] flex items-center justify-center mb-1">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-[#0f172a]">
                  Klik untuk Memilih Foto atau Mengambil Kamera
                </div>
                <p className="text-xs text-[#64748b] max-w-sm">
                  Mendukung berkas JPG, PNG, atau WebP (Maksimal 5 MB).
                </p>
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
              <p className="text-[11px] text-[#b91c1c] font-medium">{formErrors.evidenceImageBase64}</p>
            )}
          </div>

          {/* 5. Field Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="fieldNotes">
              <FileText className="w-3.5 h-3.5 text-[#64748b] mr-1" />
              Catatan Lapangan (Opsional)
            </Label>
            <textarea
              id="fieldNotes"
              rows={2}
              placeholder="Catatan tambahan kondisi di lapangan..."
              value={formData.fieldNotes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, fieldNotes: e.target.value }))
              }
              className="flex w-full rounded-xl border border-[#cbd5e1] bg-[#f8fafc] px-3.5 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus-utility-ring transition-colors"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-[#f8fafc] border-t border-[#f1f5f9] p-5">
          <Button
            type="button"
            variant="outline"
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
            className="w-full sm:w-auto text-xs min-h-[44px] h-11"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset Formulir
          </Button>

          <Button
            type="submit"
            variant="default"
            disabled={submitMutation.isPending}
            className="w-full sm:w-auto min-w-[200px] min-h-[44px] h-11 bg-[#00a2b9] hover:bg-[#008b9e] text-white font-semibold"
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
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
