import { db } from "@/lib/db";
import type { ServiceResult } from "@/types/data-table";
import type { NotificationType, NotificationItem } from "@/types/notification";

// ========== Types ==========

type CreateNotificationInput = {
  recipientId: string;
  taskId?: string | null;
  type: NotificationType;
  title: string;
  content: string;
};

type MarkAsReadInput = {
  recipientId: string;
  notificationIds: string[];
};

type CheckDueRemindersInput = {
  userId: string;
  now?: Date;
};

type SendManualRemindInput = {
  taskId: string;
  senderId: string;
};

// ========== Helpers ==========

function getTodayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ========== Service Functions ==========

export async function createNotifications(
  items: CreateNotificationInput[]
): Promise<ServiceResult<number>> {
  try {
    if (items.length === 0) {
      return { success: true, data: 0 };
    }

    const result = await db.notification.createMany({
      data: items.map((item) => ({
        recipientId: item.recipientId,
        taskId: item.taskId ?? null,
        type: item.type,
        title: item.title,
        content: item.content,
      })),
    });

    return { success: true, data: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建通知失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}

export async function getUnreadCount(
  recipientId: string
): Promise<ServiceResult<number>> {
  try {
    const count = await db.notification.count({
      where: { recipientId, isRead: false },
    });
    return { success: true, data: count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询未读数失败";
    return { success: false, error: { code: "QUERY_FAILED", message } };
  }
}

export async function markAsRead(
  input: MarkAsReadInput
): Promise<ServiceResult<number>> {
  try {
    if (input.notificationIds.length === 0) {
      return { success: true, data: 0 };
    }

    const result = await db.notification.updateMany({
      where: {
        id: { in: input.notificationIds },
        recipientId: input.recipientId,
      },
      data: { isRead: true },
    });

    return { success: true, data: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "标记已读失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function markAllAsRead(
  recipientId: string
): Promise<ServiceResult<number>> {
  try {
    const result = await db.notification.updateMany({
      where: { recipientId, isRead: false },
      data: { isRead: true },
    });
    return { success: true, data: result.count };
  } catch (error) {
    const message = error instanceof Error ? error.message : "标记已读失败";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

export async function checkAndGenerateDueReminders(
  input: CheckDueRemindersInput
): Promise<ServiceResult<{ created: number }>> {
  try {
    const now = input.now ?? new Date();
    const { start: todayStart, end: todayEnd } = getTodayRange(now);

    // Query unsubmitted assignees for tasks due by end of today
    const assignments = await db.documentCollectionAssignee.findMany({
      where: {
        userId: input.userId,
        submittedAt: null,
        task: {
          status: "ACTIVE",
          dueAt: { lte: todayEnd },
        },
      },
      include: {
        task: { select: { id: true, title: true, dueAt: true, status: true } },
      },
    });

    const toCreate: CreateNotificationInput[] = [];

    for (const assignment of assignments) {
      const task = assignment.task;
      const dueDate = new Date(task.dueAt);

      // Determine notification type based on due date
      let type: NotificationType;
      let title: string;
      let content: string;

      if (dueDate < todayStart) {
        type = "OVERDUE";
        title = "任务逾期提醒";
        content = `「${task.title}」已于 ${formatDate(dueDate)} 到期，请尽快提交。`;
      } else {
        type = "DUE_TODAY";
        title = "任务到期提醒";
        content = `「${task.title}」将于今天 (${formatDate(dueDate)}) 到期，请及时提交。`;
      }

      // Dedup: check if same notification already exists today
      const existing = await db.notification.findFirst({
        where: {
          recipientId: input.userId,
          taskId: task.id,
          type,
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      });

      if (!existing) {
        toCreate.push({
          recipientId: input.userId,
          taskId: task.id,
          type,
          title,
          content,
        });
      }
    }

    if (toCreate.length === 0) {
      return { success: true, data: { created: 0 } };
    }

    await db.notification.createMany({
      data: toCreate.map((item) => ({
        recipientId: item.recipientId,
        taskId: item.taskId ?? null,
        type: item.type,
        title: item.title,
        content: item.content,
      })),
    });

    return { success: true, data: { created: toCreate.length } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "检查到期提醒失败";
    return { success: false, error: { code: "CHECK_FAILED", message } };
  }
}

export async function sendManualRemind(
  input: SendManualRemindInput
): Promise<ServiceResult<number>> {
  try {
    const task = await db.documentCollectionTask.findFirst({
      where: { id: input.taskId },
      include: {
        assignees: {
          select: { userId: true, submittedAt: true },
        },
      },
    });

    if (!task || task.createdById !== input.senderId) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "任务不存在" },
      };
    }

    if (task.status === "CLOSED") {
      return {
        success: false,
        error: { code: "TASK_CLOSED", message: "任务已关闭，无法催办" },
      };
    }

    // Only remind unsubmitted assignees
    const unsubmittedAssignees = task.assignees.filter(
      (assignee) => assignee.submittedAt === null
    );

    if (unsubmittedAssignees.length === 0) {
      return { success: true, data: 0 };
    }

    const notifications = unsubmittedAssignees.map((assignee) => ({
      recipientId: assignee.userId,
      taskId: input.taskId,
      type: "MANUAL_REMIND" as NotificationType,
      title: "催办提醒",
      content: `「${task.title}」的创建者提醒您尽快提交文档。`,
    }));

    await db.notification.createMany({ data: notifications });

    return { success: true, data: notifications.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "催办失败";
    return { success: false, error: { code: "REMIND_FAILED", message } };
  }
}
