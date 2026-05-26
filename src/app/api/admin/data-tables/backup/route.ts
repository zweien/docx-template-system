import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runBackup, listBackups, deleteBackup, restoreBackup, getBackupDir } from "@/lib/services/backup.service";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } }, { status: 403 });
  }

  const result = await listBackups();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } }, { status: 403 });
  }

  const result = await runBackup();
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } }, { status: 403 });
  }

  const { filename } = await request.json();
  if (!filename || typeof filename !== "string") {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "缺少文件名" } }, { status: 400 });
  }

  const result = await deleteBackup(filename);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "请上传文件" } }, { status: 400 });
    }

    if (!file.name.endsWith(".zip")) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "仅支持 .zip 格式" } }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempFilename = `uploaded_${Date.now()}.zip`;
    const tempPath = join(getBackupDir(), tempFilename);
    await writeFile(tempPath, buffer);

    const result = await restoreBackup(tempFilename);

    try {
      const { unlink } = await import("fs/promises");
      await unlink(tempPath);
    } catch { /* ignore */ }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: result.data });
  }

  const { filename } = await request.json();
  if (!filename || typeof filename !== "string") {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "缺少文件名" } }, { status: 400 });
  }

  const result = await restoreBackup(filename);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}
