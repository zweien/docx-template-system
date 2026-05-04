import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";
import * as draftService from "@/modules/reports/services/report-draft.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  const result = await draftService.exportReportDraft(id, session.user.id);
  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  await logAudit({
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "REPORT_EXPORT",
    targetType: "ReportDraft",
    targetId: id,
    targetName: (() => {
      const disposition = result.data.headers.get("content-disposition") || "";
      const utf8Match = disposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
      if (utf8Match) return decodeURIComponent(utf8Match[1]);
      const plainMatch = disposition.match(/filename[^;=\n]*=["']?([^"';\n]+)/);
      return plainMatch?.[1] || id;
    })(),
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });

  const buf = await result.data.arrayBuffer();
  const headers = new Headers();
  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const disposition = result.data.headers.get("content-disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  return new Response(buf, { status: 200, headers });
}
