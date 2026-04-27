import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renameReportTemplateSchema } from "@/modules/reports/validators";
import * as reportTemplateService from "@/modules/reports/services/report-template.service";

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
    const body = renameReportTemplateSchema.parse(await request.json());
    const result = await reportTemplateService.renameReportTemplate(id, session.user.id, body.name);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
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
  const result = await reportTemplateService.deleteReportTemplate(id, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
