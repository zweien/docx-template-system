import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  checkAndGenerateDueReminders,
  getNotifications,
} from "@/lib/services/notification.service";
import { notificationListQuerySchema } from "@/validators/notification";

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const queryResult = notificationListQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );
    if (!queryResult.success) {
      return errorResponse("参数错误", 400, "VALIDATION_ERROR");
    }

    const { page, pageSize } = queryResult.data;

    // Lazy-load check for due reminders
    await checkAndGenerateDueReminders({ userId: session.user.id });

    // Get notifications
    const result = await getNotifications({
      recipientId: session.user.id,
      page,
      pageSize,
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
    return errorResponse("获取通知列表失败", 500, "INTERNAL_ERROR");
  }
}
