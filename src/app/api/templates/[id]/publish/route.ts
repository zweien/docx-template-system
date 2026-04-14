import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as templateVersionService from "@/lib/services/template-version.service";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可执行此操作" } },
      { status: 403 }
    );
  }

  const { id } = await params;
  const result = await templateVersionService.publishTemplate(id, session.user.id);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  await logAudit({
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "TEMPLATE_PUBLISH",
    targetType: "Template",
    targetId: id,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });

  return NextResponse.json({ success: true, data: result.data });
}
