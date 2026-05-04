import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";
import { updateReportDraftSchema } from "@/modules/reports/validators";
import * as draftService from "@/modules/reports/services/report-draft.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  const result = await draftService.getReportDraft(id, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = updateReportDraftSchema.parse(await request.json());
    const result = await draftService.updateReportDraft(id, session.user.id, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await logAudit({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      action: "REPORT_DRAFT_UPDATE",
      targetType: "ReportDraft",
      targetId: id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Error && "issues" in e) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "参数校验失败" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Internal error" } }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  const result = await draftService.deleteReportDraft(id, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  await logAudit({
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "REPORT_DRAFT_DELETE",
    targetType: "ReportDraft",
    targetId: id,
    ipAddress: getClientIp(_request),
    userAgent: getUserAgent(_request),
  });
  return NextResponse.json({ success: true });
}
