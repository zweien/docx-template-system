import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as categoryService from "@/lib/services/category.service";
import { createCategorySchema } from "@/validators/category";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const result = await categoryService.listCategories();
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "权限不足" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const validated = createCategorySchema.parse(body);
    const result = await categoryService.createCategory(validated);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "数据验证失败", details: error }, { status: 400 });
    }
    return NextResponse.json({ error: "创建分类失败" }, { status: 500 });
  }
}
