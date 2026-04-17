// ── Data change events ──

export interface RecordUpdatedEvent {
  type: "record_updated";
  tableId: string;
  recordId: string;
  fieldKey: string;
  fieldLabel: string;
  value: unknown;
  changedById: string;
  changedByName: string;
  changedAt: string;
}

export interface RecordCreatedEvent {
  type: "record_created";
  tableId: string;
  recordId: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export interface RecordDeletedEvent {
  type: "record_deleted";
  tableId: string;
  recordId: string;
  deletedById: string;
  deletedByName: string;
  deletedAt: string;
}

// ── Presence events ──

export interface UserJoinedEvent {
  type: "user_joined";
  tableId: string;
  userId: string;
  userName: string;
  color: string;
}

export interface UserLeftEvent {
  type: "user_left";
  tableId: string;
  userId: string;
}

export interface PresenceSnapshotEvent {
  type: "presence_snapshot";
  tableId: string;
  users: Array<{ userId: string; userName: string; color: string }>;
  locks: Array<{ recordId: string; fieldKey: string; lockedById: string; lockedByName: string; color: string }>;
}

// ── Cell lock events ──

export interface CellLockedEvent {
  type: "cell_locked";
  tableId: string;
  recordId: string;
  fieldKey: string;
  lockedById: string;
  lockedByName: string;
  color: string;
}

export interface CellUnlockedEvent {
  type: "cell_unlocked";
  tableId: string;
  recordId: string;
  fieldKey: string;
  unlockedById: string;
}

// ── Cursor events ──

export interface CursorMovedEvent {
  type: "cursor_moved";
  tableId: string;
  userId: string;
  userName: string;
  recordId: string;
  fieldKey: string;
  color: string;
}

// ── Union ──

export type RealtimeEvent =
  | RecordUpdatedEvent
  | RecordCreatedEvent
  | RecordDeletedEvent
  | UserJoinedEvent
  | UserLeftEvent
  | PresenceSnapshotEvent
  | CellLockedEvent
  | CellUnlockedEvent
  | CursorMovedEvent;

// ── Client-side types ──

const PALETTE = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export interface OnlineUser {
  userId: string;
  userName: string;
  color: string;
}

export interface CellLock {
  recordId: string;
  fieldKey: string;
  lockedById: string;
  lockedByName: string;
  color: string;
}

export interface ActivityEntry {
  id: string;
  userName: string;
  action: "updated" | "created" | "deleted";
  fieldLabel?: string;
  oldValue?: unknown;
  newValue?: unknown;
  recordId: string;
  timestamp: string;
}
