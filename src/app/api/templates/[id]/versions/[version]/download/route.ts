import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── GET /api/templates/[id]/versions/[version]/download ──

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id, version: versionStr } = await params;
  const version = parseInt(versionStr, 10);

  if (isNaN(version) || version < 1) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "版本号无效" } },
      { status: 400 }
    );
  }

  const versionRecord = await db.templateVersion.findUnique({
    where: {
      templateId_version: { templateId: id, version },
    },
    select: { filePath: true, originalFileName: true },
  });

  if (!versionRecord) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "版本不存在" } },
      { status: 404 }
    );
  }

  if (!versionRecord.filePath) {
    return NextResponse.json(
      { error: { code: "NO_FILE", message: "版本文件不存在" } },
      { status: 404 }
    );
  }

  if (!existsSync(versionRecord.filePath)) {
    return NextResponse.json(
      { error: { code: "FILE_MISSING", message: "文件不存在" } },
      { status: 404 }
    );
  }

  const buffer = await readFile(versionRecord.filePath);
  const downloadName = versionRecord.originalFileName || `v${version}.docx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
    },
  });
}
