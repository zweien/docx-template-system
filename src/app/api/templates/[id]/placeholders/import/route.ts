import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importPlaceholdersFromExcel } from "@/lib/services/placeholder.service";

// ── POST /api/templates/[id]/placeholders/import ──

export async function POST(
  request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可执行此操作" } },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请上传文件" } },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "仅支持 .xlsx 或 .xls 格式" } },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = importPlaceholdersFromExcel(arrayBuffer);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (_error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "导入占位符失败" } },
      { status: 500 }
    );
  }
}
