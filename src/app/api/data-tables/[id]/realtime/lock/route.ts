import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { acquireLock, releaseLock } from "@/lib/services/presence.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const { id: tableId } = await params;
  const userId = session.user.id;
  const userName = session.user.name ?? "";

  try {
    const body = await request.json();
    const { action, recordId, fieldKey } = body as {
      action: "acquire" | "release";
      recordId: string;
      fieldKey: string;
    };

    if (!recordId || !fieldKey || !action) {
      return Response.json({ error: "参数缺失" }, { status: 400 });
    }

    if (action === "acquire") {
      const result = acquireLock(tableId, recordId, fieldKey, userId, userName);
      if (!result.acquired) {
        return Response.json({ acquired: false, lockedBy: result.lockedBy });
      }
      return Response.json({ acquired: true });
    }

    if (action === "release") {
      releaseLock(tableId, recordId, fieldKey, userId);
      return Response.json({ released: true });
    }

    return Response.json({ error: "无效操作" }, { status: 400 });
  } catch {
    return Response.json({ error: "请求失败" }, { status: 500 });
  }
}
