import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { subscribeToTable } from "@/lib/services/realtime-notify.service";
import { joinPresence, leavePresence, getOnlineUsers, getLocksForTable } from "@/lib/services/presence.service";
import type { RealtimeEvent } from "@/types/realtime";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const token = await getToken({ req: request as never });
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: tableId } = await params;
  const userId = (token as { sub?: string }).sub ?? "";
  const userName = (token as { name?: string }).name ?? "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Join presence and notify others
      joinPresence(tableId, userId, userName);

      // Send initial connected message
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", tableId, userId })}\n\n`
        )
      );

      // Send presence snapshot so the new client knows who's online
      const snapshotUsers = getOnlineUsers(tableId);
      const snapshotLocks = getLocksForTable(tableId);
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "presence_snapshot", tableId, users: snapshotUsers, locks: snapshotLocks })}\n\n`
        )
      );

      const unsubscribe = subscribeToTable(tableId, (event: RealtimeEvent) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // stream already closed
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "heartbeat", ts: Date.now() })}\n\n`
            )
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      request.signal.addEventListener("abort", () => {
        leavePresence(tableId, userId);
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
