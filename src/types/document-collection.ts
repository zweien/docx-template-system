export type DocumentCollectionTaskStatus = "ACTIVE" | "CLOSED";

export type DocumentCollectionSubmissionStatus = "PENDING" | "SUBMITTED" | "LATE";

export type DocumentCollectionListScope = "created" | "assigned" | "all";

export type DocumentCollectionListStatus = "active" | "closed";

export type DocumentCollectionRenameVariables = Record<string, string>;

export type DocumentCollectionViewerRole = "creator" | "assignee";

export interface DocumentCollectionCreateAttachmentInput {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}

export interface DocumentCollectionAttachmentItem {
  id: string;
  taskId: string;
  fileName: string;
  originalFileName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: Date;
}

export interface DocumentCollectionVersionItem {
  id: string;
  assigneeId: string;
  version: number;
  fileName: string;
  originalFileName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  submittedById: string;
  submittedByName: string;
  submittedAt: Date;
  note: string | null;
  isLate: boolean;
}

export interface DocumentCollectionAssigneeItem {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userEmail: string;
  latestVersionId: string | null;
  latestVersion: DocumentCollectionVersionItem | null;
  submittedAt: Date | null;
  versionCount: number;
  status: DocumentCollectionSubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentCollectionTaskItem {
  id: string;
  title: string;
  instruction: string;
  dueAt: Date;
  status: DocumentCollectionTaskStatus;
  renameRule: string;
  renameVariables: DocumentCollectionRenameVariables;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentCollectionTaskListItem extends DocumentCollectionTaskItem {
  assigneeCount: number;
  submittedCount: number;
  pendingCount: number;
  lateCount: number;
  latestActivityAt: Date | null;
  myStatus: DocumentCollectionSubmissionStatus | null;
}

export interface DocumentCollectionTaskDetail extends DocumentCollectionTaskItem {
  attachments: DocumentCollectionAttachmentItem[];
  assignees: DocumentCollectionAssigneeItem[];
}

export interface DocumentCollectionTaskDetailView extends DocumentCollectionTaskDetail {
  viewerRole: DocumentCollectionViewerRole;
}

export interface DocumentCollectionTaskListQuery {
  scope?: DocumentCollectionListScope;
  status?: DocumentCollectionListStatus;
  search?: string;
}

export interface DocumentCollectionCreateTaskInput {
  title: string;
  instruction: string;
  dueAt: Date;
  assigneeIds: string[];
  renameRule: string;
  renameVariables: DocumentCollectionRenameVariables;
  attachments?: DocumentCollectionCreateAttachmentInput[];
}

export interface DocumentCollectionSubmissionNoteInput {
  note?: string;
}
