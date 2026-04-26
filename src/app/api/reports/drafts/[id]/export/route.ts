import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as draftService from "@/modules/reports/services/report-draft.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  const result = await draftService.exportReportDraft(id, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const response = result.data as any as Response;
  const headers = new Headers();
  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const disposition = response.headers.get("content-disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  return new Response(response.body, { status: 200, headers });
}
