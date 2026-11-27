import { NextRequest, NextResponse } from "next/server";
import { migrationBatch } from "@/server/services/migrationBatch";
import { session } from "@/server/session/live";

// Eviden Ulasan goes through trpc.intake.submitReview. This route only stores Batch Migrasi spreadsheets.
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

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const result = await migrationBatch.storeUpload(user, {
      fileName: file.name,
      fileSize: file.size,
      bytes: Buffer.from(await file.arrayBuffer()),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      filePath: result.filePath,
      fileName: result.fileName,
      fileSize: result.fileSize,
    });
  } catch (err: any) {
    console.error("Upload handler error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload file" }, { status: 500 });
  }
}
