import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";
import * as reportTemplateService from "@/modules/reports/services/report-template.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const result = await reportTemplateService.listReportTemplates(session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "请上传文件" } }, { status: 400 });
    }
    const result = await reportTemplateService.createReportTemplate(session.user.id, file);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await logAudit({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      action: "REPORT_TEMPLATE_CREATE",
      targetType: "ReportTemplate",
      targetId: result.data.id as string,
      targetName: result.data.name as string,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Internal error" } }, { status: 500 });
  }
}
