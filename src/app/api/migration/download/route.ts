import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate Operator / Admin session
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return new NextResponse("Unauthorized: Sesi login diperlukan untuk mengunduh berkas migrasi.", {
        status: 401,
      });
    }

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");

    if (!batchId) {
      return new NextResponse("Bad Request: batchId parameter wajib disertakan.", {
        status: 400,
      });
    }

    // 2. Fetch migration batch record
    const batch = await prisma.migrationBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return new NextResponse("Not Found: Data batch migrasi tidak ditemukan.", {
        status: 404,
      });
    }

    // 3. RBAC isolation: Pegawai only allowed to download their own batches, Super Admin / Manager can download all
    const isSuperAdminOrManager = user.role === "SUPER_ADMIN" || user.role === "MANAGER";
    if (!isSuperAdminOrManager && batch.uploadedById && batch.uploadedById !== user.id) {
      return new NextResponse("Forbidden: Anda tidak memiliki akses untuk mengunduh batch ini.", {
        status: 403,
      });
    }

    // 4. Check if physical file exists on server disk
    if (batch.filePath && fs.existsSync(batch.filePath)) {
      const fileBuffer = await fs.promises.readFile(batch.filePath);
      const ext = path.extname(batch.fileName).toLowerCase();
      let contentType = "application/octet-stream";
      if (ext === ".csv") contentType = "text/csv; charset=utf-8";
      else if (ext === ".xlsx") contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      else if (ext === ".xls") contentType = "application/vnd.ms-excel";

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(batch.fileName)}"`,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    }

    // 5. Fallback: Generate CSV stream from database RatingReview rows if physical file is missing
    const reviews = await prisma.ratingReview.findMany({
      where: { migrationBatchId: batchId },
      orderBy: { createdAt: "asc" },
      include: {
        up3: true,
        ulp: true,
        appVersion: true,
      },
    });

    if (reviews.length === 0) {
      return new NextResponse("Not Found: Berkas fisik tidak tersedia di disk dan tidak ada rekam data terkait.", {
        status: 404,
      });
    }

    // Build CSV content
    const headers = [
      "Timestamp",
      "UP3",
      "ULP",
      "Nama Pengulas Play Store",
      "Tanggal Masuk",
      "Tautan Bukti Gambar",
      "Versi Aplikasi",
      "Nama Pengulas Asli",
      "Kategori Pengulas",
      "Catatan Lapangan",
      "Duplikasi",
      "Status Validasi",
      "Catatan Review",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvLines = [headers.join(",")];
    for (const r of reviews) {
      csvLines.push(
        [
          escapeCsv(r.timestamp?.toISOString() || ""),
          escapeCsv(r.up3?.name || ""),
          escapeCsv(r.ulp?.name || ""),
          escapeCsv(r.playstoreReviewerName || ""),
          escapeCsv(r.entryDate?.toISOString() || ""),
          escapeCsv(r.evidenceImagePath || ""),
          escapeCsv(r.appVersion?.version || ""),
          escapeCsv(r.originalReviewerName || ""),
          escapeCsv(r.reviewerCategory || ""),
          escapeCsv(r.fieldNotes || ""),
          escapeCsv(r.isDuplicate ? "YA" : "TIDAK"),
          escapeCsv(r.validationStatus),
          escapeCsv(r.reviewRemarks || ""),
        ].join(",")
      );
    }

    const csvBuffer = Buffer.from("\uFEFF" + csvLines.join("\r\n"), "utf-8"); // UTF-8 BOM for Excel
    const fallbackFileName = batch.fileName.endsWith(".csv")
      ? batch.fileName
      : `${path.parse(batch.fileName).name}.csv`;

    return new NextResponse(csvBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fallbackFileName)}"`,
        "Content-Length": csvBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Download migration file error:", error);
    return new NextResponse(error.message || "Gagal mengunduh berkas", { status: 500 });
  }
}

