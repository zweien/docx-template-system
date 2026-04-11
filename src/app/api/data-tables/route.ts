import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTables, createTable } from "@/lib/services/data-table.service";
import { createTableSchema } from "@/validators/data-table";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await listTables();

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(result.data);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can create tables
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const validated = createTableSchema.parse(body);

    const result = await createTable(session.user.id, validated);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      action: "DATA_TABLE_CREATE",
      targetType: "DataTable",
      targetId: result.data.id,
      targetName: result.data.name,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "创建数据表失败" },
      { status: 500 }
    );
  }
}
