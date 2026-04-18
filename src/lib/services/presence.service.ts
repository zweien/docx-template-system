import { broadcastToTable } from "@/lib/services/realtime-notify.service";
import type { OnlineUser, CellLock } from "@/types/realtime";
import { getUserColor } from "@/types/realtime";

interface PresenceEntry {
  userName: string;
  color: string;
  joinedAt: number;
}

interface LockEntry {
  recordId: string;
  fieldKey: string;
  lockedById: string;
  lockedByName: string;
  color: string;
  lockedAt: number;
}

const presence = new Map<string, Map<string, PresenceEntry>>();
const locks = new Map<string, Map<string, LockEntry>>();

function getPresenceMap(tableId: string): Map<string, PresenceEntry> {
  let map = presence.get(tableId);
  if (!map) {
    map = new Map();
    presence.set(tableId, map);
  }
  return map;
}

function getLockMap(tableId: string): Map<string, LockEntry> {
  let map = locks.get(tableId);
  if (!map) {
    map = new Map();
    locks.set(tableId, map);
  }
  return map;
}

function lockKey(recordId: string, fieldKey: string): string {
  return `${recordId}:${fieldKey}`;
}

export function joinPresence(tableId: string, userId: string, userName: string): OnlineUser {
  const color = getUserColor(userId);
  getPresenceMap(tableId).set(userId, { userName, color, joinedAt: Date.now() });
  broadcastToTable(tableId, { type: "user_joined", tableId, userId, userName, color });
  return { userId, userName, color };
}

export function leavePresence(tableId: string, userId: string): void {
  getPresenceMap(tableId).delete(userId);
  releaseAllLocksForUser(tableId, userId);
  broadcastToTable(tableId, { type: "user_left", tableId, userId });
}

export function getOnlineUsers(tableId: string): OnlineUser[] {
  const map = presence.get(tableId);
  if (!map) return [];
  return Array.from(map.entries()).map(([userId, entry]) => ({
    userId,
    userName: entry.userName,
    color: entry.color,
  }));
}

export function getLocksForTable(tableId: string): CellLock[] {
  const map = locks.get(tableId);
  if (!map) return [];
  return Array.from(map.values()).map((entry) => ({
    recordId: entry.recordId,
    fieldKey: entry.fieldKey,
    lockedById: entry.lockedById,
    lockedByName: entry.lockedByName,
    color: entry.color,
  }));
}

export function acquireLock(
  tableId: string,
  recordId: string,
  fieldKey: string,
  userId: string,
  userName: string
): { acquired: boolean; lockedBy?: { userId: string; userName: string } } {
  const key = lockKey(recordId, fieldKey);
  const map = getLockMap(tableId);
  const existing = map.get(key);
  if (existing && existing.lockedById !== userId) {
    return { acquired: false, lockedBy: { userId: existing.lockedById, userName: existing.lockedByName } };
  }
  const color = getUserColor(userId);
  map.set(key, { recordId, fieldKey, lockedById: userId, lockedByName: userName, color, lockedAt: Date.now() });
  broadcastToTable(tableId, { type: "cell_locked", tableId, recordId, fieldKey, lockedById: userId, lockedByName: userName, color });
  return { acquired: true };
}

export function releaseLock(tableId: string, recordId: string, fieldKey: string, userId: string): void {
  const key = lockKey(recordId, fieldKey);
  const map = locks.get(tableId);
  if (!map) return;
  const entry = map.get(key);
  if (!entry || entry.lockedById !== userId) return;
  map.delete(key);
  broadcastToTable(tableId, { type: "cell_unlocked", tableId, recordId, fieldKey, unlockedById: userId });
}

export function releaseAllLocksForUser(tableId: string, userId: string): void {
  const map = locks.get(tableId);
  if (!map) return;
  for (const [key, entry] of map) {
    if (entry.lockedById === userId) {
      map.delete(key);
      broadcastToTable(tableId, { type: "cell_unlocked", tableId, recordId: entry.recordId, fieldKey: entry.fieldKey, unlockedById: userId });
    }
  }
}

// Stale-lock reaper: remove locks older than 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [tableId, map] of locks) {
    for (const [key, entry] of map) {
      if (entry.lockedAt < cutoff) {
        map.delete(key);
        broadcastToTable(tableId, { type: "cell_unlocked", tableId, recordId: entry.recordId, fieldKey: entry.fieldKey, unlockedById: entry.lockedById });
      }
    }
  }
}, 60_000);
