import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { subscribeToTable } from "@/lib/services/realtime-notify.service";
import type { RealtimeEvent } from "@/types/realtime";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // Authenticate: try cookie-based first, then query param token
  let token = await getToken({ req: request as never });
  if (!token) {
    const urlToken = request.nextUrl.searchParams.get("token");
    if (!urlToken) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const { id: tableId } = await params;
  const userId = (token as { sub?: string } | null)?.sub ?? "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", tableId, userId })}\n\n`
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
