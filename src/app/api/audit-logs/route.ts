import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAuditLogs } from "@/lib/services/audit-log.service";
import { auditLogQuerySchema } from "@/validators/audit-log";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可查看审计日志" } },
      { status: 403 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = auditLogQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      userId: searchParams.get("userId") ?? undefined,
      action: searchParams.get("action") ?? undefined,
      targetType: searchParams.get("targetType") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    });

    const result = await listAuditLogs(query);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
      { status: 400 }
    );
  }
}
