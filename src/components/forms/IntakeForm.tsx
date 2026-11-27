"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  useController,
  useForm,
  type Control,
  type UseFormClearErrors,
  type UseFormSetError,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { trpc } from "@/lib/trpc";
import { CascadingUnitSelect } from "./CascadingUnitSelect";
import {
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Calendar,
  User,
  Tag,
  FileText,
  Clock,
  Loader2,
  X,
  Zap,
} from "lucide-react";
import { intakeReviewSchema, type IntakeReviewInput } from "@/lib/validators/intake";
import {
  normalizeEvidenceImageFile,
  type NormalizedEvidenceImage,
} from "@/lib/client/evidenceImageNormalizer";

// The schema applies .default()/.optional(), so what the inputs hold differs from what submit receives.
type IntakeFormValues = z.input<typeof intakeReviewSchema>;
type IntakeFormControl = Control<IntakeFormValues, unknown, IntakeReviewInput>;

type ImageMeta = Pick<
  NormalizedEvidenceImage,
  "originalSizeBytes" | "finalSizeBytes" | "width" | "height" | "wasNormalized" | "wasHeicConverted"
> & { dataUrl: string; filename: string };

type SuccessInfo = {
  reviewId: string;
  evidencePath: string;
  latencyMs: number;
};

const intakeResolver = zodResolver(intakeReviewSchema);

function formatFileSizeKb(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getTodayString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildDefaultValues(appVersionId = ""): IntakeFormValues {
  return {
    up3Id: "",
    ulpId: "",
    playstoreReviewerName: "",
    entryDate: getTodayString(),
    appVersionId,
    originalReviewerName: "",
    reviewerCategory: "Pelanggan",
    fieldNotes: "",
    evidenceImageBase64: "",
  };
}

const inputBaseClass =
  "flex min-h-[44px] w-full rounded-xl border bg-[#f8fafc] px-3.5 py-2.5 text-xs sm:text-sm text-[#0f172a] focus-utility-ring transition-all";

function borderClass(hasError: boolean): string {
  return hasError ? "border-[#ef4444]" : "border-[#cbd5e1]";
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] text-[#b91c1c] font-medium mt-1">{message}</p>;
}

export function IntakeForm() {
  const versionsQuery = trpc.master.getVersions.useQuery();
  const submitMutation = trpc.intake.submitReview.useMutation();
  const latestVersionId = versionsQuery.data?.[0]?.id ?? "";

  const {
    register,
    control,
    handleSubmit,
    reset,
    resetField,
    getValues,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<IntakeFormValues, unknown, IntakeReviewInput>({
    resolver: intakeResolver,
    defaultValues: buildDefaultValues(latestVersionId),
  });

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

  // resetField also moves the default, so "Reset Formulir" keeps the latest version selected.
  useEffect(() => {
    if (latestVersionId && !getValues("appVersionId")) {
      resetField("appVersionId", { defaultValue: latestVersionId });
    }
  }, [latestVersionId, getValues, resetField]);

  // Keep UP3, ULP, date and version so a field officer can submit several reviews in a row.
  useEffect(() => {
    if (!isSubmitSuccessful) return;
    const { up3Id, ulpId, entryDate, appVersionId } = getValues();
    reset(
      { ...buildDefaultValues(appVersionId), up3Id, ulpId, entryDate },
      { keepDefaultValues: true }
    );
  }, [isSubmitSuccessful, getValues, reset]);

  const onSubmit = async (values: IntakeReviewInput) => {
    setSuccessInfo(null);
    try {
      const res = await submitMutation.mutateAsync(values);
      setSuccessInfo({
        reviewId: res.reviewId,
        evidencePath: res.evidencePath,
        latencyMs: res.latencyMs,
      });
    } catch (err: unknown) {
      setError("root.serverError", {
        type: "server",
        message: err instanceof Error ? err.message : "Terjadi kesalahan saat mengirim eviden.",
      });
    }
  };

  const handleReset = () => {
    reset();
    setSuccessInfo(null);
  };

  const isBusy = isSubmitting || isProcessingImage;
  const serverError = errors.root?.serverError?.message;

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

      <form onSubmit={handleSubmit(onSubmit, () => setSuccessInfo(null))} noValidate>
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

          {/* Server Error Banner */}
          {serverError && (
            <div
              role="alert"
              className="p-4 sm:p-5 rounded-2xl bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] flex items-start space-x-3.5 shadow-xs"
            >
              <AlertTriangle className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-sm text-[#b91c1c]">Gagal Mengirim Eviden</div>
                <div className="mt-0.5">{serverError}</div>
              </div>
            </div>
          )}

          {/* 1. Cascading Unit Selection */}
          <UnitFields control={control} />

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
                aria-invalid={errors.playstoreReviewerName ? true : undefined}
                {...register("playstoreReviewerName")}
                className={`${inputBaseClass} placeholder:text-[#94a3b8] ${borderClass(!!errors.playstoreReviewerName)}`}
              />
              <FieldError message={errors.playstoreReviewerName?.message} />
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
                aria-invalid={errors.entryDate ? true : undefined}
                {...register("entryDate")}
                className={`${inputBaseClass} ${borderClass(!!errors.entryDate)}`}
              />
              <FieldError message={errors.entryDate?.message} />
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
                aria-invalid={errors.appVersionId ? true : undefined}
                {...register("appVersionId")}
                className={`${inputBaseClass} ${borderClass(!!errors.appVersionId)}`}
              >
                <option value="">-- Pilih Versi --</option>
                {versionsQuery.data?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version}
                  </option>
                ))}
              </select>
              <FieldError message={errors.appVersionId?.message} />
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
                aria-invalid={errors.originalReviewerName ? true : undefined}
                {...register("originalReviewerName")}
                className={`${inputBaseClass} placeholder:text-[#94a3b8] ${borderClass(!!errors.originalReviewerName)}`}
              />
              <FieldError message={errors.originalReviewerName?.message} />
            </div>
          </div>

          {/* 4. Evidence Image Dropzone */}
          <EvidenceImageField
            control={control}
            setError={setError}
            clearErrors={clearErrors}
            isProcessing={isProcessingImage}
            onProcessingChange={setIsProcessingImage}
          />

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
              aria-invalid={errors.fieldNotes ? true : undefined}
              {...register("fieldNotes")}
              className={`flex w-full rounded-xl border bg-[#f8fafc] px-3.5 py-2.5 text-xs sm:text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus-utility-ring transition-all ${borderClass(!!errors.fieldNotes)}`}
            />
            <FieldError message={errors.fieldNotes?.message} />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#f1f5f9] bg-[#f8fafc] flex flex-col sm:flex-row gap-3 justify-between items-center">
          <button
            type="button"
            onClick={handleReset}
            disabled={isBusy}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-bold text-[#334155] transition-all min-h-[44px] flex items-center justify-center gap-2 focus-utility-ring cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#64748b]" />
            <span>Reset Formulir</span>
          </button>

          <button
            type="submit"
            disabled={isBusy}
            className="w-full sm:w-auto min-w-[220px] px-5 py-2.5 rounded-xl bg-[#006877] hover:bg-[#004e5a] text-white min-h-[44px] text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-all focus-utility-ring cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
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

function UnitFields({ control }: { control: IntakeFormControl }) {
  const { field: up3, fieldState: up3State } = useController({ control, name: "up3Id" });
  const { field: ulp, fieldState: ulpState } = useController({ control, name: "ulpId" });

  return (
    <CascadingUnitSelect
      selectedUp3Id={up3.value}
      selectedUlpId={ulp.value}
      onUp3Change={up3.onChange}
      onUlpChange={ulp.onChange}
      errors={{
        up3Id: up3State.error?.message,
        ulpId: ulpState.error?.message,
      }}
    />
  );
}

interface EvidenceImageFieldProps {
  control: IntakeFormControl;
  setError: UseFormSetError<IntakeFormValues>;
  clearErrors: UseFormClearErrors<IntakeFormValues>;
  isProcessing: boolean;
  onProcessingChange: (isProcessing: boolean) => void;
}

function EvidenceImageField({
  control,
  setError,
  clearErrors,
  isProcessing,
  onProcessingChange,
}: EvidenceImageFieldProps) {
  const { field: image, fieldState: imageState } = useController({
    control,
    name: "evidenceImageBase64",
  });
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = image.value || null;
  // Meta is tied to the data URL it describes, so a form reset hides it without extra cleanup.
  const currentMeta = imageMeta && imageMeta.dataUrl === image.value ? imageMeta : null;
  const errorMessage = imageState.error?.message;

  const processSelectedFile = async (file: File) => {
    onProcessingChange(true);
    clearErrors("evidenceImageBase64");

    try {
      const normalized = await normalizeEvidenceImageFile(file);
      image.onChange(normalized.dataUrl);
      setImageMeta({
        dataUrl: normalized.dataUrl,
        filename: normalized.filename,
        originalSizeBytes: normalized.originalSizeBytes,
        finalSizeBytes: normalized.finalSizeBytes,
        width: normalized.width,
        height: normalized.height,
        wasNormalized: normalized.wasNormalized,
        wasHeicConverted: normalized.wasHeicConverted,
      });
    } catch (err: unknown) {
      setError("evidenceImageBase64", {
        type: "processing",
        message: err instanceof Error ? err.message : "Gagal memproses gambar bukti ulasan.",
      });
    } finally {
      onProcessingChange(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset immediately so picking or retaking the same filename triggers onChange again
    e.target.value = "";
    if (!file) return;
    void processSelectedFile(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isProcessing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  };

  const removeImage = () => {
    image.onChange("");
    setImageMeta(null);
  };

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
        <Camera className="w-3.5 h-3.5 text-[#006877]" />
        <span>Eviden Ulasan (Foto Kamera Langsung / Tangkapan Layar)</span>
        <span className="text-[#ef4444] font-bold">*</span>
      </label>

      {previewUrl ? (
        <div className="relative rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] p-4 flex flex-col sm:flex-row items-center gap-4 shadow-xs">
          <div className="relative w-36 h-48 rounded-xl overflow-hidden border border-[#cbd5e1] bg-white shrink-0 shadow-xs">
            <img
              src={previewUrl}
              alt="Pratinjau Eviden Ulasan"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={removeImage}
              aria-label="Hapus eviden ulasan"
              disabled={isProcessing}
              className="absolute top-2 right-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full bg-[#0f172a]/75 hover:bg-[#dc2626] text-white transition-all cursor-pointer focus-utility-ring disabled:opacity-50"
              title="Hapus gambar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="text-xs text-[#475569] space-y-2 w-full">
            <div className="font-bold text-sm text-[#0f172a] break-all">
              {currentMeta?.filename || "eviden_selected.jpg"}
            </div>
            <div className="text-[#15803d] flex items-center space-x-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#16a34a] shrink-0" />
              <span>Gambar siap diunggah & diproses OCR</span>
            </div>
            {currentMeta && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-[#334155]">
                <span className="px-2 py-0.5 rounded-full bg-white border border-[#e2e8f0]">
                  {currentMeta.width}x{currentMeta.height} px
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white border border-[#e2e8f0]">
                  {currentMeta.wasNormalized
                    ? `${formatFileSizeKb(currentMeta.originalSizeBytes)} -> ${formatFileSizeKb(currentMeta.finalSizeBytes)}`
                    : formatFileSizeKb(currentMeta.finalSizeBytes)}
                </span>
                {currentMeta.wasHeicConverted && (
                  <span className="px-2 py-0.5 rounded-full bg-[#f0f9ff] border border-[#bae6fd] text-[#0369a1] font-sans font-semibold">
                    HEIC dikonversi ke JPG
                  </span>
                )}
              </div>
            )}
            <p className="text-[#64748b] text-[11px] leading-relaxed">
              Eviden Ulasan akan otomatis disimpan ke penyimpanan lokal server dan diekstraksi teksnya oleh layanan OCR.
            </p>
            <div className="pt-1 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[#006877] hover:bg-[#004e5a] text-white transition-all focus-utility-ring cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Foto Ulang Kamera</span>
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => galleryInputRef.current?.click()}
                className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9] transition-all focus-utility-ring cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4 text-[#006877]" />
                <span>Pilih dari Galeri</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all flex flex-col items-center justify-center space-y-4 ${
            errorMessage
              ? "border-[#fecaca] bg-[#fef2f2]"
              : "border-[#cbd5e1] bg-[#f8fafc] hover:border-[#00a2b9]"
          }`}
        >
          {isProcessing ? (
            <div className="py-4 flex flex-col items-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#e2e8f0] flex items-center justify-center text-[#006877] shadow-xs">
                <Loader2 className="w-6 h-6 animate-spin text-[#00a2b9]" />
              </div>
              <div className="text-sm font-bold text-[#0f172a]">
                Mengoptimalkan gambar untuk OCR...
              </div>
              <p className="text-xs text-[#64748b]">
                Menyesuaikan resolusi, format iOS/Android, dan ukuran unggahan.
              </p>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-white border border-[#e2e8f0] flex items-center justify-center text-[#006877] shadow-xs">
                <Camera className="w-7 h-7 text-[#006877]" />
              </div>
              <div className="max-w-lg">
                <div className="text-sm font-bold text-[#0f172a]">
                  Ambil Foto Kamera Langsung atau Pilih Tangkapan Layar
                </div>
                <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
                  Mendukung kamera Android & iOS (termasuk HEIC/HEIF) maupun screenshot galeri (JPG, PNG, WebP). Foto beresolusi tinggi otomatis dioptimalkan.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 w-full max-w-md pt-1">
                <button
                  ref={image.ref}
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-[#006877] hover:bg-[#004e5a] text-white text-xs font-bold shadow-xs transition-all focus-utility-ring cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Ambil Foto Kamera</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="min-h-[44px] flex-1 px-4 py-2.5 rounded-xl bg-white hover:bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1] text-xs font-bold shadow-xs transition-all focus-utility-ring cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <ImageIcon className="w-4 h-4 text-[#006877] shrink-0" />
                  <span>Pilih dari Galeri / File</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        aria-label="Ambil Foto Kamera Langsung"
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        onChange={handleFileChange}
        aria-label="Pilih Tangkapan Layar dari Galeri atau File"
        className="hidden"
      />

      <FieldError message={errorMessage} />
    </div>
  );
}
