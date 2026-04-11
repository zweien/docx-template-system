import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTable, updateTable, deleteTable } from "@/lib/services/data-table.service";
import { updateTableSchema } from "@/validators/data-table";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getTable(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(result.data);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can update tables
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = updateTableSchema.parse(body);

    const result = await updateTable(id, validated);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    await logAudit({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      action: "DATA_TABLE_UPDATE",
      targetType: "DataTable",
      targetId: id,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "更新数据表失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can delete tables
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id } = await params;
  const result = await deleteTable(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  await logAudit({
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "DATA_TABLE_DELETE",
    targetType: "DataTable",
    targetId: id,
    ipAddress: getClientIp(request),
    userAgent: getUserAgent(request),
  });

  return NextResponse.json({ success: true });
}
