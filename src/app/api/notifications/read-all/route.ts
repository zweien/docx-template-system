import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAllAsRead } from "@/lib/services/notification.service";

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PATCH(_request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  const result = await markAllAsRead(session.user.id);

  if (!result.success) {
    const status =
      result.error.code === "NOT_FOUND"
        ? 404
        : result.error.code.endsWith("_FAILED")
        ? 500
        : 500;
    return errorResponse(result.error.message, status, result.error.code);
  }

  return NextResponse.json({ success: true, data: result.data });
}
