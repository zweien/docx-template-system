import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as templateService from "@/lib/services/template.service";
import { createTemplateSchema, templateQuerySchema } from "@/validators/template";

// ── GET /api/templates ──

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
    const query = templateQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const result = await templateService.listTemplates(query);

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
      { error: { code: "INTERNAL_ERROR", message: "获取模板列表失败" } },
      { status: 500 }
    );
  }
}

// ── POST /api/templates ──

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可执行此操作" } },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();

    const name = (formData.get("name") as string) || "";
    const description = (formData.get("description") as string) || undefined;
    const categoryId = (formData.get("categoryId") as string) || undefined;
    const tagIdsStr = (formData.get("tagIds") as string) || undefined;
    const tagIds = tagIdsStr ? tagIdsStr.split(",").filter(Boolean) : undefined;
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请上传文件" } },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".docx")) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "仅支持 .docx 格式文件" } },
        { status: 400 }
      );
    }

    const parsed = createTemplateSchema.parse({ name, description });

    const arrayBuffer = await file.arrayBuffer();
    const result = await templateService.createTemplate(
      { ...parsed, createdById: session.user.id, categoryId, tagIds },
      Buffer.from(arrayBuffer),
      file.name
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "创建模板失败" } },
      { status: 500 }
    );
  }
}
