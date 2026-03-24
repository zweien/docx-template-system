import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecord, updateRecord, deleteRecord } from "@/lib/services/data-record.service";
import { updateRecordSchema } from "@/validators/data-table";

interface RouteParams {
  params: Promise<{ id: string; recordId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { recordId } = await params;
  const result = await getRecord(recordId);

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

  // Only ADMIN can update records
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { recordId } = await params;

  try {
    const body = await request.json();
    const validated = updateRecordSchema.parse(body);

    const result = await updateRecord(recordId, validated.data);

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
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "数据验证失败", details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "更新记录失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  // Only ADMIN can delete records
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { recordId } = await params;
  const result = await deleteRecord(recordId);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
