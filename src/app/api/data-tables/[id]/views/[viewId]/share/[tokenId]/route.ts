import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteShareToken } from "@/lib/services/form-share.service";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string; tokenId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { tokenId } = await params;
  const result = await deleteShareToken(tokenId, session.user.id, session.user.name);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
