import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as draftService from "@/lib/services/draft.service";
import { saveDraftSchema } from "@/validators/draft";

// ── GET /api/drafts/[id] ──

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
  const result = await draftService.getDraft(id);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (!result.data) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "草稿不存在" } },
      { status: 404 }
    );
  }

  // Verify ownership
  if (result.data.userId !== session.user.id) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "无权访问此草稿" } },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

// ── PUT /api/drafts/[id] ──

export async function PUT(
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

  try {
    const body = await request.json();
    const parsed = saveDraftSchema.parse(body);

    const result = await draftService.updateDraft(
      id,
      session.user.id,
      parsed.formData
    );

    if (!result.success) {
      const status =
        result.error.code === "NOT_FOUND"
          ? 404
          : result.error.code === "FORBIDDEN"
            ? 403
            : 400;
      return NextResponse.json({ error: result.error }, { status });
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
      { error: { code: "INTERNAL_ERROR", message: "更新草稿失败" } },
      { status: 500 }
    );
  }
}

// ── DELETE /api/drafts/[id] ──

export async function DELETE(
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
  const result = await draftService.deleteDraft(id, session.user.id);

  if (!result.success) {
    const status =
      result.error.code === "NOT_FOUND"
        ? 404
        : result.error.code === "FORBIDDEN"
          ? 403
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: null });
}
