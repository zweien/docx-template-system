import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
  listComments,
  createComment,
  getUnresolvedCount,
} from "@/lib/services/data-record-comment.service";

type RouteParams = { params: Promise<{ id: string; recordId: string }> };

const createSchema = z.object({
  content: z.string().min(1, "评论内容不能为空"),
  parentId: z.string().optional(),
  mentions: z.array(z.string()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { recordId } = await params;
  const url = new URL(request.url);

  // Batch unresolved count endpoint
  const idsParam = url.searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").filter(Boolean);
    const counts = await getUnresolvedCount(ids);
    return NextResponse.json(Object.fromEntries(counts));
  }

  const result = await listComments(recordId);
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json(result.data);
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { recordId } = await params;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await createComment(session.user.id, {
    recordId,
    ...parsed.data,
  });
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json(result.data, { status: 201 });
}
