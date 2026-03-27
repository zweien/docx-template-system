import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as tagService from "@/lib/services/tag.service";

interface RouteParams {
  params: Promise<{ id: string }>;
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
  const result = await tagService.deleteTag(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
