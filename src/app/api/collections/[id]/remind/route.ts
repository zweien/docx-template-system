import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendManualRemind } from "@/lib/services/notification.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  const { id } = await params;
  const result = await sendManualRemind({
    taskId: id,
    senderId: session.user.id,
  });

  if (!result.success) {
    const status =
      result.error.code === "NOT_FOUND"
        ? 404
        : result.error.code === "TASK_CLOSED"
        ? 400
        : 500;
    return errorResponse(result.error.message, status, result.error.code);
  }

  return NextResponse.json({
    success: true,
    data: { remindedCount: result.data },
  });
}
