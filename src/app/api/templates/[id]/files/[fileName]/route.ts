import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { basename } from "path";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTemplateSourceFilePath } from "@/lib/file.service";

// ── GET /api/templates/[id]/files/[fileName] ──
// 下载 DOWNLOAD 型模板 sources/ 下的单个文件。
// 权限：PUBLISHED 对所有登录用户可见；DRAFT/ARCHIVED 仅管理员可见。

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    txt: "text/plain",
    csv: "text/csv",
  };
  return map[ext ?? ""] || "application/octet-stream";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileName: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id, fileName } = await params;
  const template = await db.template.findUnique({
    where: { id },
    select: { deliveryMode: true, status: true },
  });

  if (!template) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "模板不存在" } },
      { status: 404 }
    );
  }

  if (template.deliveryMode !== "DOWNLOAD") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "该模板不是文件下载型" } },
      { status: 400 }
    );
  }

  // DRAFT/ARCHIVED 仅管理员可见
  if (template.status !== "PUBLISHED" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "无权访问此模板" } },
      { status: 403 }
    );
  }

  // 防路径穿越：getTemplateSourceFilePath 会校验路径在 sources/ 内
  const filePath = getTemplateSourceFilePath(id, decodeURIComponent(fileName));
  if (!filePath) {
    return NextResponse.json(
      { error: { code: "FILE_MISSING", message: "文件不存在" } },
      { status: 404 }
    );
  }

  const buffer = await readFile(filePath);
  const downloadName = basename(filePath);
  const inline = request.nextUrl.searchParams.get("inline") === "1";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": getMimeType(downloadName),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
    },
  });
}
