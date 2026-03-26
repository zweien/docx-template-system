import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { listViews, createView } from "@/lib/services/data-view.service";

const createViewSchema = z.object({
  name: z.string().min(1, "视图名称不能为空"),
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
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;
  const result = await listViews(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = createViewSchema.parse(body);
    const result = await createView(id, data);

    if (!result.success) {
      if (result.error.code === "DUPLICATE") {
        return NextResponse.json({ error: result.error.message }, { status: 409 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "创建视图失败" }, { status: 500 });
  }
}
