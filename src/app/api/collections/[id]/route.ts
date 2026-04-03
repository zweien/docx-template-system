import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  closeDocumentCollectionTask,
  getDocumentCollectionTaskDetail,
} from "@/lib/services/document-collection-task.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  const { id } = await params;
  const result = await getDocumentCollectionTaskDetail({
    taskId: id,
    userId: session.user.id,
  });

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 500;
    return errorResponse(result.error.message, status, result.error.code);
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const body = (await request.json()) as { action?: string };
    if (body.action !== "close") {
      return errorResponse("不支持的操作", 400, "VALIDATION_ERROR");
    }

    const { id } = await params;
    const result = await closeDocumentCollectionTask({
      taskId: id,
      userId: session.user.id,
    });

    if (!result.success) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 500;
      return errorResponse(result.error.message, status, result.error.code);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch {
    return errorResponse("关闭任务失败", 500, "INTERNAL_ERROR");
  }
}
