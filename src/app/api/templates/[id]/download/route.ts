import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { basename } from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// ── GET /api/templates/[id]/download ──

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const template = await db.template.findUnique({
    where: { id },
    select: { filePath: true, fileName: true, originalFileName: true, name: true, deliveryMode: true },
  });

  if (!template) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "模板不存在" } },
      { status: 404 }
    );
  }

  if (!template.filePath) {
    return NextResponse.json(
      { error: { code: "NO_FILE", message: "模板文件不存在" } },
      { status: 404 }
    );
  }

  if (!existsSync(template.filePath)) {
    return NextResponse.json(
      { error: { code: "FILE_MISSING", message: "文件不存在" } },
      { status: 404 }
    );
  }

  const buffer = await readFile(template.filePath);
  const isDownload = template.deliveryMode === "DOWNLOAD";

  // DOWNLOAD 型下载 bundle.zip；FILL 型下载原始 docx
  const downloadName = isDownload
    ? `${template.name}.zip`
    : template.originalFileName || basename(template.filePath);
  const contentType = isDownload
    ? "application/zip"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // ?inline=1 时返回 inline，供在线预览使用（保留登录校验，不带参数仍为下载）
  const inline = request.nextUrl.searchParams.get("inline") === "1";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
    },
  });
}
