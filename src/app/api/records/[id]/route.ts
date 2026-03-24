import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as recordService from "@/lib/services/record.service";

// ── GET /api/records/[id] ──

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

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (!result.data) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "记录不存在" } },
      { status: 404 }
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

  return NextResponse.json({ success: true, data: result.data });
}
