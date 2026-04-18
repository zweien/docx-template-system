export type NotificationType = "TASK_ASSIGNED" | "DUE_TODAY" | "OVERDUE" | "MANUAL_REMIND" | "COMMENT_MENTION" | "COMMENT_REPLY";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  taskId: string | null;
  isRead: boolean;
  createdAt: Date;
};
