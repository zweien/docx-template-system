/**
 * y-websocket collaboration server
 *
 * Accepts WebSocket connections with ?room=draft-{id}&token={jwt}
 * Validates NextAuth JWT, checks draft access via PostgreSQL,
 * and syncs Yjs documents using y-protocols.
 *
 * Dependencies: jose, pg (own), y-protocols / y-leveldb / ws / lib0 (hoisted from parent)
 */

import { WebSocketServer } from "ws";
import { jwtVerify } from "jose";
import pg from "pg";

// -- y-protocols (CJS, hoisted from parent node_modules) --
import {
  readSyncMessage,
  writeSyncStep1,
  writeUpdate,
} from "y-protocols/dist/sync.cjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/dist/awareness.cjs";

// -- lib0 encoding --
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

// -- y-leveldb persistence --
import { LeveldbPersistence } from "y-leveldb";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.Y_WS_PORT || "8070", 10);
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

/**
 * Check if a user (by userId) can access a report draft.
 * Returns true if user is the owner or in collaboratorIds.
 */
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

/**
 * Map<roomName, Set<ws>> — all WebSocket connections per room.
 */
const rooms = new Map();

/**
 * Map<roomName, Y.Doc> — the Yjs document per room (loaded from persistence).
 */
const docs = new Map();

/**
 * Map<roomName, Awareness> — awareness instances per room.
 */
const awarenessMap = new Map();

/**
 * Map<ws, { roomName, userId, awarenessClientId? }> — metadata per connection.
 * awarenessClientId is populated when the client first sends an awareness update.
 */
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
// Sync protocol: encode/decode helpers
// ---------------------------------------------------------------------------

// y-websocket wire protocol message types
const WS_MSG_SYNC = 0;
const WS_MSG_AWARENESS = 1;
const WS_MSG_AUTH = 2;

/**
 * Encode a sync step-1 message (server → client).
 */
function encodeSyncStep1(doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WS_MSG_SYNC);
  writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

/**
 * Encode an update message (server → all other clients).
 */
function encodeUpdate(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WS_MSG_SYNC);
  writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

/**
 * Encode an awareness update message (server → all other clients).
 */
function encodeAwarenessMessage(awareness, clients) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WS_MSG_AWARENESS);
  encodeAwarenessUpdate(encoder, awareness, clients);
  return encoding.toUint8Array(encoder);
}

// ---------------------------------------------------------------------------
// Doc observer — broadcast updates when the doc changes
// ---------------------------------------------------------------------------

function setupDocObserver(roomName, doc) {
  doc.on("update", (update, origin) => {
    // Only broadcast if the update came from a remote client (not persistence load)
    if (origin !== null) {
      const msg = encodeUpdate(update);
      broadcast(roomName, msg);
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
  // Parse query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = url.searchParams.get("room");
  const token = url.searchParams.get("token");

  if (!roomName || !token) {
    ws.close(4001, "Missing room or token query parameter");
    return;
  }

  // Validate room name format: draft-{id}
  const draftMatch = roomName.match(/^draft-(.+)$/);
  if (!draftMatch) {
    ws.close(4002, "Invalid room name format");
    return;
  }
  const draftId = draftMatch[1];

  // Verify JWT
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

  // Check draft access
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

  // Get or create Yjs Doc
  let doc = docs.get(roomName);
  if (!doc) {
    doc = await persistence.getYDoc(roomName);
    docs.set(roomName, doc);
    setupDocObserver(roomName, doc);
  }

  // Get or create Awareness
  let awareness = awarenessMap.get(roomName);
  if (!awareness) {
    awareness = new Awareness(doc);
    awarenessMap.set(roomName, awareness);
    setupAwarenessObserver(roomName, awareness);
  }

  // Add to room connections
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  const conns = rooms.get(roomName);
  conns.add(ws);

  // Store connection metadata
  // awarenessClientId is populated when the client first sends an awareness update
  connMeta.set(ws, { roomName, userId });

  console.log(
    `[room=${roomName}] Client connected: userId=${userId}, clients=${conns.size}`
  );

  // Send initial sync step 1 to new client
  try {
    ws.send(encodeSyncStep1(doc));
  } catch (err) {
    console.error(`[room=${roomName}] Failed to send sync step 1:`, err);
  }

  // --- Handle incoming messages ---
  ws.on("message", (raw) => {
    try {
      const data = Buffer.isBuffer(raw) ? raw : new Uint8Array(raw);
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case WS_MSG_SYNC: {
          // Sync message from client: read and apply
          readSyncMessage(decoder, doc, ws);
          break;
        }
        case WS_MSG_AWARENESS: {
          // Awareness update from client
          const update = decoding.readVarUint8Array(decoder);
          // Extract clientID from awareness update (first 4 bytes are clientID)
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
          // Auth / queryAwareness — respond with current awareness
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, WS_MSG_AWARENESS);
          encodeAwarenessUpdate(
            encoder,
            awareness,
            Array.from(awareness.getStates().keys())
          );
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

      // Remove awareness state for disconnected client
      if (meta.awarenessClientId) {
        removeAwarenessStates(awareness, [meta.awarenessClientId]);
      }

      // Clean up empty rooms
      if (roomConns.size === 0) {
        rooms.delete(rName);
        const roomAwareness = awarenessMap.get(rName);
        if (roomAwareness) {
          roomAwareness.destroy();
          awarenessMap.delete(rName);
        }
        // Keep the doc in cache for a while in case clients reconnect.
        // Uncomment the following to immediately clear:
        // docs.delete(rName);
        // persistence.clearDocument(rName);
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

// Graceful shutdown
function shutdown() {
  console.log("\nShutting down y-websocket server...");
  wss.close(() => {
    pool.end().then(() => {
      console.log("PostgreSQL pool closed.");
      process.exit(0);
    });
  });
  // Force exit after 5 seconds
  setTimeout(() => process.exit(1), 5000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
