import { NextRequest, NextResponse } from "next/server";
import { getRouteSessionUser } from "@/lib/auth";
import { deleteTaskDependency } from "@/lib/services/task-dependency.service";

interface RouteParams {
  params: Promise<{ id: string; depId: string }>;
}

function mapErrorStatus(code: string): number {
  if (code === "NOT_FOUND") return 404;
  return 400;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getRouteSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id: tableId, depId } = await params;
  const result = await deleteTaskDependency(tableId, depId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: mapErrorStatus(result.error.code) }
    );
  }

  return NextResponse.json({ success: true });
}
