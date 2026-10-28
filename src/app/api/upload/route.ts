import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { BASE_UPLOAD_DIR } from "@/lib/storage";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // 1. Layer 3 Authentication Guard: Verify active JWT session
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = token ? await verifySessionToken(token) : null;

    if (!user) {
      return NextResponse.json(
        { error: "Autentikasi diperlukan untuk mengunggah berkas." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const uploadType = (formData.get("type") as string) || "evidence";

    // 2. Layer 3 Authorization Guard: Check role permissions per upload category
    if (uploadType === "migration") {
      if (user.role !== Role.SUPER_ADMIN) {
        return NextResponse.json(
          { error: "Akses ditolak. Hanya Super Admin yang diizinkan mengunggah berkas migrasi." },
          { status: 403 }
        );
      }
    } else {
      // Default to evidence: field officer or super admin
      const allowedRoles: Role[] = [Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN];
      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { error: "Akses ditolak. Hanya Petugas Lapangan atau Super Admin yang diizinkan mengunggah bukti." },
          { status: 403 }
        );
      }
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();

    // Check extension for migration
    if (uploadType === "migration") {
      if (ext !== ".csv" && ext !== ".xlsx" && ext !== ".xls") {
        return NextResponse.json(
          { error: "Only CSV and XLSX files are supported for migration" },
          { status: 400 }
        );
      }
    }

    const targetSubdir = path.join(BASE_UPLOAD_DIR, uploadType);
    await fs.promises.mkdir(targetSubdir, { recursive: true });

    const uniqueId = crypto.randomBytes(6).toString("hex");
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${Date.now()}_${uniqueId}_${sanitizedName}`;
    const destination = path.join(targetSubdir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(destination, buffer);

    return NextResponse.json({
      success: true,
      filePath: destination,
      fileName: originalName,
      fileSize: file.size,
    });
  } catch (err: any) {
    console.error("Upload handler error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload file" }, { status: 500 });
  }
}
