import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as reportTemplateService from "@/modules/reports/services/report-template.service";

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
