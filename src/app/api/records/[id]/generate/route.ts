import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as recordService from "@/lib/services/record.service";

// ── POST /api/records/[id]/generate ──

export async function POST(
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

  // Verify ownership or admin role
  const record = await recordService.getRecord(id);
  if (!record.success) {
    const status = record.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: record.error }, { status });
  }

  if (!record.data) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "记录不存在" } },
      { status: 404 }
    );
  }

  if (
    record.data.userId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "无权操作此记录" } },
      { status: 403 }
    );
  }

  // Trigger generation
  const result = await recordService.generateDocument(id);

  if (!result.success) {
    const status =
      result.error.code === "NOT_FOUND"
        ? 404
        : result.error.code === "GENERATE_FAILED"
          ? 500
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data });
}
