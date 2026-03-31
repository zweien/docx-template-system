import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  deleteConversation,
  renameConversation,
} from "@/lib/services/ai-conversation.service";
import { renameConversationSchema } from "@/validators/ai-agent";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = renameConversationSchema.parse(body);
    const { id } = await params;
    const result = await renameConversation({
      conversationId: id,
      userId: session.user.id,
      title: parsed.title,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const result = await deleteConversation({
    conversationId: id,
    userId: session.user.id,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
