import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as recordService from "@/lib/services/record.service";

// ── POST /api/records/[id]/copy ──

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
  const result = await recordService.copyRecordToDraft(session.user.id, id);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
