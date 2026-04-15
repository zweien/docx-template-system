import { NextRequest, NextResponse } from "next/server";
import { resolvePublicForm } from "@/lib/services/form-share.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolvePublicForm(token);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.code === "NOT_FOUND" || result.error.code === "EXPIRED" ? 404 : 400 }
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
