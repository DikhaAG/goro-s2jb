import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { BASE_UPLOAD_DIR } from "@/lib/storage";
import { session } from "@/server/session/live";

// Eviden Ulasan goes through trpc.intake.submitReview. This route only stores Batch Migrasi spreadsheets.
const MIGRATION_UPLOAD_DIR = path.join(BASE_UPLOAD_DIR, "migration");
const MIGRATION_ROLES: Role[] = [Role.PEGAWAI, Role.SUPER_ADMIN];
const MIGRATION_EXTENSIONS = [".csv", ".xlsx", ".xls"];

export async function POST(req: NextRequest) {
  try {
    const user = await session.getUser(req.headers);
    if (!user) {
      return NextResponse.json(
        { error: "Autentikasi diperlukan untuk mengunggah berkas." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    if (formData.get("type") !== "migration") {
      return NextResponse.json(
        { error: "Jenis unggahan tidak didukung. Rute ini hanya menerima berkas Batch Migrasi." },
        { status: 400 }
      );
    }

    if (!MIGRATION_ROLES.includes(user.role)) {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Pegawai Triase atau Super Admin yang diizinkan mengunggah berkas migrasi." },
        { status: 403 }
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const originalName = file.name;
    if (!MIGRATION_EXTENSIONS.includes(path.extname(originalName).toLowerCase())) {
      return NextResponse.json(
        { error: "Only CSV and XLSX files are supported for migration" },
        { status: 400 }
      );
    }

    await fs.promises.mkdir(MIGRATION_UPLOAD_DIR, { recursive: true });

    const uniqueId = crypto.randomBytes(6).toString("hex");
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const destination = path.join(MIGRATION_UPLOAD_DIR, `${Date.now()}_${uniqueId}_${sanitizedName}`);

    await fs.promises.writeFile(destination, Buffer.from(await file.arrayBuffer()));

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
