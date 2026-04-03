import type {
  DocumentCollectionSubmissionStatus,
  DocumentCollectionTaskStatus,
  DocumentCollectionViewerRole,
} from "@/types/document-collection";

interface ViewerRoleInput {
  createdById: string;
  assignees: Array<{ userId: string }>;
  userId: string;
}

interface DeriveStatusInput {
  dueAt: Date;
  taskStatus: DocumentCollectionTaskStatus;
  submittedAt: Date | null;
  latestVersion: { isLate: boolean } | null;
  now?: Date;
}

export function canManageDocumentCollectionTask(input: {
  createdById: string;
  userId: string;
}): boolean {
  return input.createdById === input.userId;
}

export function getDocumentCollectionViewerRole(
  input: ViewerRoleInput
): DocumentCollectionViewerRole | null {
  if (canManageDocumentCollectionTask(input)) {
    return "creator";
  }

  if (input.assignees.some((assignee) => assignee.userId === input.userId)) {
    return "assignee";
  }

  return null;
}

export function canViewDocumentCollectionTask(input: ViewerRoleInput): boolean {
  return getDocumentCollectionViewerRole(input) !== null;
}

export function deriveDocumentCollectionSubmissionStatus(
  input: DeriveStatusInput
): DocumentCollectionSubmissionStatus {
  if (!input.latestVersion) {
    void input.dueAt;
    void input.taskStatus;
    void input.submittedAt;
    void input.now;
    return "PENDING";
  }

  if (input.latestVersion.isLate) {
    return "LATE";
  }

  if (input.latestVersion) {
    return "SUBMITTED";
  }

  return "PENDING";
}
