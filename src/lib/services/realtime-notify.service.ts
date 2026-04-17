import { Client } from "pg";
import { pool } from "@/lib/db";
import type { RealtimeEvent } from "@/types/realtime";

type RealtimeListener = (event: RealtimeEvent) => void;

const CHANNEL = "table_changes";
const listeners = new Map<string, Set<RealtimeListener>>();
let listenClient: Client | null = null;
let initPromise: Promise<void> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (listeners.size === 0) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void ensureListening();
  }, 3000);
}

async function ensureListening(): Promise<void> {
  if (listenClient) return;

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);

    client.on("notification", (msg) => {
      if (!msg.payload) return;
      try {
        const event = JSON.parse(msg.payload) as RealtimeEvent;
        const tableListeners = listeners.get(event.tableId);
        if (tableListeners) {
          for (const fn of tableListeners) {
            fn(event);
          }
        }
      } catch {
        // ignore malformed payloads
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

export async function publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
  const payload = JSON.stringify(event);
  await pool.query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload]);
}

export function subscribeToTable(
  tableId: string,
  listener: RealtimeListener
): () => void {
  if (!listeners.has(tableId)) {
    listeners.set(tableId, new Set());
  }
  listeners.get(tableId)!.add(listener);

  // Lazy-init LISTEN connection on first subscription
  void ensureListening();

  return () => {
    const tableListeners = listeners.get(tableId);
    if (tableListeners) {
      tableListeners.delete(listener);
      if (tableListeners.size === 0) {
        listeners.delete(tableId);
      }
    }
  };
}

export function broadcastToTable(tableId: string, event: RealtimeEvent): void {
  const tableListeners = listeners.get(tableId);
  if (tableListeners) {
    for (const fn of tableListeners) {
      fn(event);
    }
  }
}

export function shutdownRealtimeNotify(): void {
  if (listenClient) {
    void listenClient.end();
    listenClient = null;
    initPromise = null;
  }
  listeners.clear();
}
