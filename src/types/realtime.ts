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

export type RealtimeEvent =
  | RecordUpdatedEvent
  | RecordCreatedEvent
  | RecordDeletedEvent;

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
