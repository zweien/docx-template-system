import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: e.message } }, { status: 500 });
  }
}
