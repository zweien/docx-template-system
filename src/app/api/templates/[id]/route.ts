import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as templateService from "@/lib/services/template.service";
import { updateTemplateSchema } from "@/validators/template";

// ── GET /api/templates/[id] ──

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const result = await templateService.getTemplate(id);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data });
}

// ── PUT /api/templates/[id] ──

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可执行此操作" } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateTemplateSchema.parse(body);

    // Handle status change separately
    if (parsed.status !== undefined) {
      const statusResult = await templateService.changeStatus(id, parsed.status);
      if (!statusResult.success) {
        return NextResponse.json(
          { error: statusResult.error },
          { status: 400 }
        );
      }
    }

    // Handle name/description update
    if (parsed.name !== undefined || parsed.description !== undefined) {
      const updateData: { name?: string; description?: string } = {};
      if (parsed.name !== undefined) updateData.name = parsed.name;
      if (parsed.description !== undefined) updateData.description = parsed.description;

      const updateResult = await templateService.updateTemplate(id, updateData);
      if (!updateResult.success) {
        return NextResponse.json(
          { error: updateResult.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, data: updateResult.data });
    }

    // If only status was changed, fetch the updated template
    const template = await templateService.getTemplate(id);
    if (!template.success) {
      return NextResponse.json(
        { error: template.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: template.data });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "更新模板失败" } },
      { status: 500 }
    );
  }
}

// ── DELETE /api/templates/[id] ──

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可执行此操作" } },
      { status: 403 }
    );
  }

  const { id } = await params;
  const result = await templateService.deleteTemplate(id);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: null });
}
