import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { basename } from "path";
import { auth } from "@/lib/auth";
import * as recordService from "@/lib/services/record.service";

// ── GET /api/records/[id]/download ──

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
  const result = await recordService.getRecord(id);

  if (!result.success || !result.data) {
    const status = result.success ? 404 : 400;
    return NextResponse.json(
      { error: result.success ? { code: "NOT_FOUND", message: "记录不存在" } : result.error },
      { status }
    );
  }

  // Verify ownership or admin role
  if (
    result.data.userId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "无权访问此记录" } },
      { status: 403 }
    );
  }

  if (!result.data.filePath || !result.data.fileName) {
    return NextResponse.json(
      { error: { code: "NO_FILE", message: "文档尚未生成" } },
      { status: 404 }
    );
  }

  if (!existsSync(result.data.filePath)) {
    return NextResponse.json(
      { error: { code: "FILE_MISSING", message: "文件不存在" } },
      { status: 404 }
    );
  }

  const buffer = await readFile(result.data.filePath);
  const fileName = basename(result.data.filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
