import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getView, updateView, deleteView } from "@/lib/services/data-view.service";

const updateViewSchema = z.object({
  name: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  filters: z.array(z.object({
    fieldKey: z.string(),
    op: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "contains", "isempty", "isnotempty"]),
    value: z.union([z.string(), z.number()]),
  })).optional(),
  sortBy: z.object({
    fieldKey: z.string(),
    order: z.enum(["asc", "desc"]),
  }).nullable().optional(),
  visibleFields: z.array(z.string()).optional(),
  fieldOrder: z.array(z.string()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string; viewId: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { viewId } = await params;

  try {
    const body = await request.json();
    const data = updateViewSchema.parse(body);
    const result = await updateView(viewId, data);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "更新视图失败" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { viewId } = await params;
  const result = await deleteView(viewId);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
