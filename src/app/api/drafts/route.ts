import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as draftService from "@/lib/services/draft.service";
import { saveDraftSchema } from "@/validators/draft";

// ── GET /api/drafts ──

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const result = await draftService.listDrafts(session.user.id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}

// ── POST /api/drafts ──

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = saveDraftSchema.parse(body);

    const result = await draftService.saveDraft(
      session.user.id,
      parsed.templateId,
      parsed.formData
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
      { error: { code: "INTERNAL_ERROR", message: "保存草稿失败" } },
      { status: 500 }
    );
  }
}
