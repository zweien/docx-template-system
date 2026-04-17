import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { broadcastToTable } from "@/lib/services/realtime-notify.service";
import { getUserColor } from "@/lib/services/presence.service";

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
    const { recordId, fieldKey } = body as { recordId: string; fieldKey: string };

    if (!recordId || !fieldKey) {
      return Response.json({ error: "参数缺失" }, { status: 400 });
    }

    broadcastToTable(tableId, {
      type: "cursor_moved",
      tableId,
      userId,
      userName,
      recordId,
      fieldKey,
      color: getUserColor(userId),
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "请求失败" }, { status: 500 });
  }
}
