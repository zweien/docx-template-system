import { Client } from "pg";
import { pool } from "@/lib/db";
import type { AutomationRealtimeEvent } from "@/types/automation-realtime";

type AutomationRealtimeListener = (event: AutomationRealtimeEvent) => void;

const CHANNEL = "automation_run_events";
const listeners = new Map<string, Set<AutomationRealtimeListener>>();
let listenClient: Client | null = null;
let initPromise: Promise<void> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconnect(): void {
  if (reconnectTimer || listeners.size === 0) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void ensureListening();
  }, 3000);
}

async function ensureListening(): Promise<void> {
  if (listenClient) {
    return;
  }

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);

    client.on("notification", (msg) => {
      if (!msg.payload) {
        return;
      }

      try {
        const event = JSON.parse(msg.payload) as AutomationRealtimeEvent;
        const scopedListeners = listeners.get(event.automationId);
        if (!scopedListeners) {
          return;
        }

        for (const listener of scopedListeners) {
          listener(event);
        }
      } catch {
        // ignore malformed events
      }
    });

    client.on("error", () => {
      listenClient = null;
      initPromise = null;
      scheduleReconnect();
    });

    client.on("end", () => {
      listenClient = null;
      initPromise = null;
      scheduleReconnect();
    });

    listenClient = client;
  })();

  await initPromise;
}

export async function publishAutomationRealtimeEvent(
  event: AutomationRealtimeEvent
): Promise<void> {
  await pool.query(`SELECT pg_notify($1, $2)`, [CHANNEL, JSON.stringify(event)]);
}

export function subscribeToAutomation(
  automationId: string,
  listener: AutomationRealtimeListener
): () => void {
  if (!listeners.has(automationId)) {
    listeners.set(automationId, new Set());
  }

  listeners.get(automationId)?.add(listener);
  void ensureListening();

  return () => {
    const scopedListeners = listeners.get(automationId);
    if (!scopedListeners) {
      return;
    }

    scopedListeners.delete(listener);
    if (scopedListeners.size === 0) {
      listeners.delete(automationId);
    }
  };
}

export function broadcastToAutomation(
  automationId: string,
  event: AutomationRealtimeEvent
): void {
  const scopedListeners = listeners.get(automationId);
  if (!scopedListeners) {
    return;
  }

  for (const listener of scopedListeners) {
    listener(event);
  }
}

export function shutdownAutomationRealtime(): void {
  if (listenClient) {
    void listenClient.end();
    listenClient = null;
    initPromise = null;
  }

  listeners.clear();
}
