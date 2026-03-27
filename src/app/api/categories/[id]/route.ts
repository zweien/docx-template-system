import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as categoryService from "@/lib/services/category.service";
import { updateCategorySchema } from "@/validators/category";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const validated = updateCategorySchema.parse(body);
    const result = await categoryService.updateCategory(id, validated);
    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "数据验证失败", details: error }, { status: 400 });
    }
    return NextResponse.json({ error: "更新分类失败" }, { status: 500 });
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
  const { id } = await params;
  const result = await categoryService.deleteCategory(id);
  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    if (result.error.code === "HAS_TEMPLATES") {
      return NextResponse.json({ error: result.error.message }, { status: 409 });
    }
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
