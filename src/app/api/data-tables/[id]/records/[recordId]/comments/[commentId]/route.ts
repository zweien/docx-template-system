import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
  updateComment,
  resolveComment,
  deleteComment,
} from "@/lib/services/data-record-comment.service";

type RouteParams = { params: Promise<{ id: string; recordId: string; commentId: string }> };

const updateSchema = z.object({
  content: z.string().min(1, "评论内容不能为空"),
});

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { commentId } = await params;
  const body = await request.json();

  if (body.action === "resolve") {
    const result = await resolveComment(commentId, session.user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json(result.data);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await updateComment(commentId, session.user.id, parsed.data.content);
  if (!result.success) {
    const status = result.error.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(result.data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { commentId } = await params;
  const result = await deleteComment(commentId, session.user.id);
  if (!result.success) {
    const status = result.error.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
