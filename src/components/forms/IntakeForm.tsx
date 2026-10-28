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
    <Card className="border-slate-800 bg-[#0d1424]/90 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500" />

      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="default" className="gap-1.5 py-1">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Formulir Lapangan Taktis</span>
          </Badge>
          <span className="text-[11px] font-mono text-slate-400">
            Fase 2: Intake Engine
          </span>
        </div>
        <CardTitle className="text-xl font-bold text-white mt-2">
          Entri Eviden Rating Pelanggan
        </CardTitle>
        <CardDescription>
          Catat ulasan Play Store pelanggan dan unggah bukti tangkapan layar untuk verifikasi otomatis OCR.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {/* Success Banner */}
          {successInfo && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex items-start space-x-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs space-y-1">
                <div className="font-bold text-sm text-emerald-300">
                  Eviden Berhasil Disimpan & Masuk Antrean Verifikasi!
                </div>
                <div className="text-slate-300">
                  ID Review: <span className="font-mono text-cyan-300">{successInfo.reviewId}</span>
                </div>
                <div className="text-slate-400 flex items-center space-x-3">
                  <span>Waktu Respon: <strong className="text-emerald-400 font-mono">{successInfo.latencyMs} ms</strong></span>
                  <span>•</span>
                  <span>Status Awal: <strong className="text-amber-300 font-mono">PENDING</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Mutation Error */}
          {submitMutation.isError && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-sm text-red-300">Gagal Mengirim Eviden</div>
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

          {/* 2. Reviewer Name (Column 4) & Entry Date (Column 5) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label required htmlFor="playstoreReviewerName">
                <User className="w-3.5 h-3.5 text-cyan-400 mr-1" />
                Nama Pengulas Play Store
              </Label>
              <Input
                id="playstoreReviewerName"
                placeholder="Misal: Ahmad Dani atau Budi Santoso"
                value={formData.playstoreReviewerName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, playstoreReviewerName: e.target.value }))
                }
                className={formErrors.playstoreReviewerName ? "border-red-500" : ""}
              />
              {formErrors.playstoreReviewerName && (
                <p className="text-[11px] text-red-400">{formErrors.playstoreReviewerName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label required htmlFor="entryDate">
                <Calendar className="w-3.5 h-3.5 text-sky-400 mr-1" />
                Tanggal Entri
              </Label>
              <Input
                id="entryDate"
                type="date"
                value={formData.entryDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, entryDate: e.target.value }))
                }
                className={formErrors.entryDate ? "border-red-500" : ""}
              />
              {formErrors.entryDate && (
                <p className="text-[11px] text-red-400">{formErrors.entryDate}</p>
              )}
            </div>
          </div>

          {/* 3. Version (Column 7) & Original Customer Name (Column 8) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label required htmlFor="appVersionSelect">
                <Tag className="w-3.5 h-3.5 text-purple-400 mr-1" />
                Versi PLN Mobile
              </Label>
              <select
                id="appVersionSelect"
                value={formData.appVersionId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, appVersionId: e.target.value }))
                }
                className={`flex h-11 w-full rounded-lg border bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:border-cyan-400 focus-visible:ring-1 focus-visible:ring-cyan-400 transition-colors ${
                  formErrors.appVersionId ? "border-red-500" : "border-slate-700/80"
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
                <p className="text-[11px] text-red-400">{formErrors.appVersionId}</p>
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

          {/* 4. Evidence Image Dropzone (Column 6) */}
          <div className="space-y-2">
            <Label required>
              <Camera className="w-3.5 h-3.5 text-cyan-400 mr-1" />
              Foto Bukti Eviden (Tangkapan Layar Ulasan)
            </Label>

            {previewUrl ? (
              <div className="relative rounded-xl border border-slate-700/80 bg-slate-950/70 p-3 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-36 h-48 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
                  <img
                    src={previewUrl}
                    alt="Pratinjau Eviden"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-950/80 hover:bg-red-500 text-slate-300 hover:text-white transition"
                    title="Hapus gambar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-white">
                    {formData.evidenceFilename || "eviden_selected.png"}
                  </div>
                  <div className="text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Gambar siap diunggah & diproses OCR</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-2">
                    Foto akan otomatis disimpan ke direktori lokal terstruktur dan diekstraksi teksnya oleh AI vision service.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-xs"
                  >
                    Ganti Foto
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 bg-slate-950/40 hover:bg-slate-900/60 ${
                  formErrors.evidenceImageBase64
                    ? "border-red-500/80"
                    : "border-slate-700/80 hover:border-cyan-500/60"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400 mb-1">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-200">
                  Klik untuk Memilih Foto atau Mengambil Kamera
                </div>
                <p className="text-xs text-slate-400 max-w-sm">
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
              <p className="text-[11px] text-red-400">{formErrors.evidenceImageBase64}</p>
            )}
          </div>

          {/* 5. Field Notes (Column 10) */}
          <div className="space-y-1.5">
            <Label htmlFor="fieldNotes">
              <FileText className="w-3.5 h-3.5 text-slate-400 mr-1" />
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
              className="flex w-full rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:border-cyan-400 focus-visible:ring-1 focus-visible:ring-cyan-400 transition-colors"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-950/50">
          <Button
            type="button"
            variant="ghost"
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
            className="w-full sm:w-auto text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset Formulir
          </Button>

          <Button
            type="submit"
            variant="tactical"
            disabled={submitMutation.isPending}
            className="w-full sm:w-auto min-w-[200px]"
          >
            {submitMutation.isPending ? (
              <span className="flex items-center space-x-2">
                <Clock className="w-4 h-4 animate-spin text-slate-950" />
                <span>Menyimpan Eviden...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Kirim Eviden Rating</span>
              </span>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
