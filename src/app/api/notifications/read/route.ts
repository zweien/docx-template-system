import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAsRead } from "@/lib/services/notification.service";
import { markReadSchema } from "@/validators/notification";

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const body = await request.json();
    const validationResult = markReadSchema.safeParse(body);
    if (!validationResult.success) {
      return errorResponse("参数错误", 400, "VALIDATION_ERROR");
    }

    const { notificationIds } = validationResult.data;
    const result = await markAsRead({
      recipientId: session.user.id,
      notificationIds,
    });

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
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return errorResponse("参数错误", 400, "VALIDATION_ERROR");
    }
    return errorResponse("标记已读失败", 500, "INTERNAL_ERROR");
  }
}
