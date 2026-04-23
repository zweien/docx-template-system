import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAutomation } from "@/lib/services/automation.service";
import { subscribeToAutomation } from "@/lib/services/automation-realtime.service";
import type { AutomationRealtimeEvent } from "@/types/automation-realtime";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: automationId } = await params;
  const automation = await getAutomation(automationId, session.user.id);
  if (!automation.success) {
    return new Response("Not Found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", automationId })}\n\n`
        )
      );

      const unsubscribe = subscribeToAutomation(
        automationId,
        (event: AutomationRealtimeEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // stream already closed
          }
        }
      );

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
