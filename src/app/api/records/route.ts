import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as recordService from "@/lib/services/record.service";
import { createRecordSchema, recordQuerySchema } from "@/validators/record";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";

// ── GET /api/records ──

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = recordQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const result = await recordService.listRecords(session.user.id, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "获取记录列表失败" } },
      { status: 500 }
    );
  }
}

// ── POST /api/records ──

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = createRecordSchema.parse(body);

    const result = await recordService.createRecord(
      session.user.id,
      parsed.templateId,
      parsed.formData
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      action: "DOCUMENT_GENERATE",
      targetType: "Record",
      targetId: result.data.id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "创建记录失败" } },
      { status: 500 }
    );
  }
}
