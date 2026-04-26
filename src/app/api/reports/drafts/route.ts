import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createReportDraftSchema } from "@/modules/reports/validators";
import * as draftService from "@/modules/reports/services/report-draft.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const result = await draftService.listReportDrafts(session.user.id);
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
    const body = createReportDraftSchema.parse(await request.json());
    const result = await draftService.createReportDraft(session.user.id, body.templateId, body.title);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Error && "issues" in e) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "参数校验失败" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Internal error" } }, { status: 500 });
  }
}
