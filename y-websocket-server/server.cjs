/**
 * y-websocket collaboration server (CJS)
 *
 * Accepts WebSocket connections with room as path: /draft-{id}?token={jwt}
 * Validates NextAuth JWT, checks draft access via PostgreSQL,
 * and syncs Yjs documents using y-protocols.
 *
 * Dependencies: jose, pg, y-protocols, y-leveldb, ws, lib0
 */

"use strict";

const { WebSocketServer } = require("ws");
const { jwtVerify } = require("jose");
const pg = require("pg");

const {
  readSyncMessage,
  writeUpdate,
} = require("y-protocols/dist/sync.cjs");
const {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} = require("y-protocols/dist/awareness.cjs");

const encoding = require("lib0/encoding");
const decoding = require("lib0/decoding");

const { LeveldbPersistence } = require("y-leveldb");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.Y_WS_PORT || "8072", 10);
const PERSISTENCE_DIR = process.env.Y_WS_PERSISTENCE_DIR || "./y-websocket-db";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!NEXTAUTH_SECRET) {
  console.error("FATAL: NEXTAUTH_SECRET env var is required");
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL env var is required");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// PostgreSQL pool
// ---------------------------------------------------------------------------

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function canAccessDraft(userId, draftId) {
  const result = await pool.query(
    'SELECT "userId", "collaboratorIds" FROM "ReportDraft" WHERE id = $1',
    [draftId]
  );
  if (result.rows.length === 0) return false;
  const row = result.rows[0];
  if (row.userId === userId) return true;
  const collaborators = row.collaboratorIds || [];
  return collaborators.includes(userId);
}

// ---------------------------------------------------------------------------
// JWT verification
// ---------------------------------------------------------------------------

const secretKey = new TextEncoder().encode(NEXTAUTH_SECRET);

async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secretKey);
  return payload;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const persistence = new LeveldbPersistence(PERSISTENCE_DIR);

// ---------------------------------------------------------------------------
// Room management
// ---------------------------------------------------------------------------

const rooms = new Map();
const docs = new Map();
const awarenessMap = new Map();
const connMeta = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcast(roomName, message, exclude = null) {
  const conns = rooms.get(roomName);
  if (!conns) return;
  const buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
  for (const conn of conns) {
    if (conn !== exclude && conn.readyState === conn.OPEN) {
      conn.send(buf);
    }
  }
}

// ---------------------------------------------------------------------------
// Sync protocol: encode helpers
// ---------------------------------------------------------------------------

const WS_MSG_SYNC = 0;
const WS_MSG_AWARENESS = 1;
const WS_MSG_AUTH = 2;

function encodeUpdate(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WS_MSG_SYNC);
  writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

function encodeAwarenessMessage(awareness, clients) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WS_MSG_AWARENESS);
  const update = encodeAwarenessUpdate(awareness, clients);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

// ---------------------------------------------------------------------------
// Doc observer — broadcast updates when the doc changes
// ---------------------------------------------------------------------------

function setupDocObserver(roomName, doc) {
  doc.on("update", (update, origin) => {
    if (origin !== null) {
      const msg = encodeUpdate(update);
      broadcast(roomName, msg, origin);
    }
  });
}

// ---------------------------------------------------------------------------
// Awareness observer — broadcast awareness changes
// ---------------------------------------------------------------------------

function setupAwarenessObserver(roomName, awareness) {
  awareness.on("change", ({ added, updated, removed }) => {
    const changedClients = added.concat(updated, removed);
    if (changedClients.length === 0) return;
    const msg = encodeAwarenessMessage(awareness, changedClients);
    broadcast(roomName, msg);
  });
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

async function handleConnection(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // y-websocket WebsocketProvider sends room as URL path (e.g., /draft-{id}?token=...)
  const roomName = url.searchParams.get("room") || url.pathname.replace(/^\//, "");
  const token = url.searchParams.get("token");

  if (!roomName || !token) {
    ws.close(4001, "Missing room or token query parameter");
    return;
  }

  const draftMatch = roomName.match(/^draft-(.+)$/);
  if (!draftMatch) {
    ws.close(4002, "Invalid room name format");
    return;
  }
  const draftId = draftMatch[1];

  let user;
  try {
    user = await verifyToken(token);
  } catch (_err) {
    ws.close(4003, "Invalid or expired token");
    return;
  }

  const userId = user.sub || user.id;
  if (!userId) {
    ws.close(4004, "Token does not contain user id");
    return;
  }

  try {
    const hasAccess = await canAccessDraft(userId, draftId);
    if (!hasAccess) {
      ws.close(4005, "Access denied to draft");
      return;
    }
  } catch (err) {
    console.error(`[room=${roomName}] DB error checking draft access:`, err);
    ws.close(4006, "Internal server error");
    return;
  }

  // --- Authorized, set up room ---

  if (!docs.has(roomName)) {
    docs.set(roomName, null); // prevent concurrent creation
  }
  let doc = docs.get(roomName);
  if (!doc) {
    doc = await persistence.getYDoc(roomName);
    docs.set(roomName, doc);
    setupDocObserver(roomName, doc);
  }

  if (!awarenessMap.has(roomName)) {
    awarenessMap.set(roomName, null);
  }
  let awareness = awarenessMap.get(roomName);
  if (!awareness) {
    awareness = new Awareness(doc);
    awarenessMap.set(roomName, awareness);
    setupAwarenessObserver(roomName, awareness);
  }

  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  const conns = rooms.get(roomName);
  conns.add(ws);

  connMeta.set(ws, { roomName, userId });

  console.log(
    `[room=${roomName}] Client connected: userId=${userId}, clients=${conns.size}`
  );

  // Send current awareness states to newly connected client
  if (awareness.getStates().size > 0) {
    const msg = encodeAwarenessMessage(awareness, Array.from(awareness.getStates().keys()));
    ws.send(msg);
  }

  // --- Handle incoming messages ---
  ws.on("message", (raw) => {
    try {
      const data = Buffer.isBuffer(raw) ? raw : new Uint8Array(raw);
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case WS_MSG_SYNC: {
          const replyEncoder = encoding.createEncoder();
          encoding.writeVarUint(replyEncoder, WS_MSG_SYNC);
          readSyncMessage(decoder, replyEncoder, doc, ws);
          if (encoding.length(replyEncoder) > 1) {
            ws.send(encoding.toUint8Array(replyEncoder));
          }
          break;
        }
        case WS_MSG_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          if (!update || update.byteLength < 4) break;
          const clientID = new DataView(
            update.buffer,
            update.byteOffset
          ).getUint32(0, true);
          const meta = connMeta.get(ws);
          if (meta && !meta.awarenessClientId) {
            meta.awarenessClientId = clientID;
          }
          applyAwarenessUpdate(awareness, update, ws);
          break;
        }
        case WS_MSG_AUTH: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, WS_MSG_AWARENESS);
          const update = encodeAwarenessUpdate(
            awareness,
            Array.from(awareness.getStates().keys())
          );
          encoding.writeVarUint8Array(encoder, update);
          ws.send(encoding.toUint8Array(encoder));
          break;
        }
        default:
          console.warn(`[room=${roomName}] Unknown message type: ${messageType}`);
      }
    } catch (err) {
      console.error(`[room=${roomName}] Error processing message:`, err);
    }
  });

  // --- Handle disconnect ---
  ws.on("close", () => {
    const meta = connMeta.get(ws);
    if (!meta) return;

    const { roomName: rName } = meta;
    const roomConns = rooms.get(rName);
    if (roomConns) {
      roomConns.delete(ws);
      console.log(
        `[room=${rName}] Client disconnected: userId=${meta.userId}, clients=${roomConns.size}`
      );

      if (meta.awarenessClientId) {
        removeAwarenessStates(awareness, [meta.awarenessClientId]);
      }

      if (roomConns.size === 0) {
        rooms.delete(rName);
        const roomAwareness = awarenessMap.get(rName);
        if (roomAwareness) {
          roomAwareness.destroy();
          awarenessMap.delete(rName);
        }
      }
    }
    connMeta.delete(ws);
  });

  ws.on("error", (err) => {
    console.error(`[room=${roomName}] WebSocket error:`, err.message);
  });
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ port: PORT });
wss.on("connection", handleConnection);
wss.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`FATAL: Port ${PORT} is already in use`);
  } else {
    console.error("WebSocketServer error:", err);
  }
  process.exit(1);
});

wss.on("listening", () => {
  console.log(`y-websocket server listening on ws://localhost:${PORT}`);
  console.log(`Persistence directory: ${PERSISTENCE_DIR}`);
});

function shutdown() {
  console.log("\nShutting down y-websocket server...");
  wss.close(() => {
    pool.end().then(() => {
      console.log("PostgreSQL pool closed.");
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
