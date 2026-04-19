import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import {
  listTaskDependencies,
  upsertTaskDependency,
} from "@/lib/services/task-dependency.service";
import { taskDependencyInputSchema } from "@/validators/data-table";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function mapErrorStatus(code: string): number {
  if (code === "NOT_FOUND") return 404;
  if (code === "SELF_LOOP" || code === "CROSS_TABLE_DEPENDENCY" || code === "INVALID_TYPE" || code === "RECORD_NOT_FOUND") {
    return 400;
  }
  return 400;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id: tableId } = await params;
  const result = await listTaskDependencies(tableId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: mapErrorStatus(result.error.code) }
    );
  }

  return NextResponse.json(result.data);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id: tableId } = await params;

  try {
    const body = await request.json();
    const validated = taskDependencyInputSchema.parse(body);

    const result = await upsertTaskDependency({
      tableId,
      successorRecordId: validated.successorRecordId,
      predecessorRecordId: validated.predecessorRecordId,
      type: validated.type,
      lagDays: validated.lagDays,
      required: validated.required,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapErrorStatus(result.error.code) }
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
      { error: "保存依赖失败" },
      { status: 500 }
    );
  }
}
