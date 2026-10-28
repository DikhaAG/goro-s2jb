import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { BASE_UPLOAD_DIR } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const uploadType = (formData.get("type") as string) || "migration";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();

    // Check extension
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
