import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updatePlaceholder, updatePlaceholderSource } from "@/lib/services/placeholder.service";
import { updatePlaceholderSchema, updatePlaceholderSourceSchema } from "@/validators/placeholder";
import { ZodError } from "zod";

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

    // Use source-specific schema if only source fields are present
    const hasOnlySourceFields =
      body.sourceTableId !== undefined ||
      body.sourceField !== undefined ||
      body.enablePicker !== undefined;
    const hasGeneralFields =
      body.label !== undefined ||
      body.inputType !== undefined ||
      body.required !== undefined ||
      body.defaultValue !== undefined ||
      body.sortOrder !== undefined ||
      body.description !== undefined;

    if (hasOnlySourceFields && !hasGeneralFields) {
      const validated = updatePlaceholderSourceSchema.parse(body);
      const result = await updatePlaceholderSource(id, validated);
      if (!result.success) {
        return NextResponse.json({ error: result.error.message }, { status: 400 });
      }
      return NextResponse.json(result.data);
    }

    // General update
    const validated = updatePlaceholderSchema.parse(body);
    const result = await updatePlaceholder(id, validated);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: `数据验证失败: ${errorMessages}` },
        { status: 400 }
      );
    }
    console.error("更新占位符失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
