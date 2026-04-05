import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  notification: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
  documentCollectionTask: {
    findFirst: vi.fn(),
  },
  documentCollectionAssignee: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("notification.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNotifications", () => {
    it("批量创建通知应成功", async () => {
      dbMock.notification.createMany.mockResolvedValue({ count: 2 });

      const service = await import("./notification.service");
      const result = await service.createNotifications([
        {
          recipientId: "user-1",
          taskId: "task-1",
          type: "TASK_ASSIGNED",
          title: "新任务",
          content: "您被分配了一个新任务",
        },
        {
          recipientId: "user-2",
          taskId: "task-1",
          type: "TASK_ASSIGNED",
          title: "新任务",
          content: "您被分配了一个新任务",
        },
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(2);
      }
      expect(dbMock.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            recipientId: "user-1",
            taskId: "task-1",
            type: "TASK_ASSIGNED",
            title: "新任务",
            content: "您被分配了一个新任务",
          },
          {
            recipientId: "user-2",
            taskId: "task-1",
            type: "TASK_ASSIGNED",
            title: "新任务",
            content: "您被分配了一个新任务",
          },
        ],
      });
    });

    it("空数组应返回 0 而不调用 createMany", async () => {
      const service = await import("./notification.service");
      const result = await service.createNotifications([]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
      expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    });

    it("数据库错误应返回错误结果", async () => {
      dbMock.notification.createMany.mockRejectedValue(new Error("DB error"));

      const service = await import("./notification.service");
      const result = await service.createNotifications([
        {
          recipientId: "user-1",
          taskId: "task-1",
          type: "TASK_ASSIGNED",
          title: "新任务",
          content: "您被分配了一个新任务",
        },
      ]);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CREATE_FAILED");
      }
    });
  });

  describe("getUnreadCount", () => {
    it("应返回用户的未读通知数", async () => {
      dbMock.notification.count.mockResolvedValue(5);

      const service = await import("./notification.service");
      const result = await service.getUnreadCount("user-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(5);
      }
      expect(dbMock.notification.count).toHaveBeenCalledWith({
        where: { recipientId: "user-1", isRead: false },
      });
    });

    it("无未读通知时应返回 0", async () => {
      dbMock.notification.count.mockResolvedValue(0);

      const service = await import("./notification.service");
      const result = await service.getUnreadCount("user-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
    });

    it("数据库错误应返回错误结果", async () => {
      dbMock.notification.count.mockRejectedValue(new Error("DB error"));

      const service = await import("./notification.service");
      const result = await service.getUnreadCount("user-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("QUERY_FAILED");
      }
    });
  });

  describe("markAsRead", () => {
    it("应标记指定通知为已读（带 recipientId 过滤）", async () => {
      dbMock.notification.updateMany.mockResolvedValue({ count: 2 });

      const service = await import("./notification.service");
      const result = await service.markAsRead({
        recipientId: "user-1",
        notificationIds: ["notif-1", "notif-2"],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(2);
      }
      expect(dbMock.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["notif-1", "notif-2"] },
          recipientId: "user-1",
        },
        data: { isRead: true },
      });
    });

    it("空 notificationIds 应返回 0 而不调用 updateMany", async () => {
      const service = await import("./notification.service");
      const result = await service.markAsRead({
        recipientId: "user-1",
        notificationIds: [],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
      expect(dbMock.notification.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("markAllAsRead", () => {
    it("应标记用户所有未读通知为已读", async () => {
      dbMock.notification.updateMany.mockResolvedValue({ count: 3 });

      const service = await import("./notification.service");
      const result = await service.markAllAsRead("user-1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(3);
      }
      expect(dbMock.notification.updateMany).toHaveBeenCalledWith({
        where: { recipientId: "user-1", isRead: false },
        data: { isRead: true },
      });
    });
  });

  describe("checkAndGenerateDueReminders", () => {
    // 2026-04-06 is the "today" for all tests in this describe block
    const todayStart = new Date("2026-04-06T00:00:00.000Z");
    const _todayEnd = new Date("2026-04-06T23:59:59.999Z");

    it("应为今日到期的未提交任务生成 DUE_TODAY 通知", async () => {
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([
        {
          id: "asg-1",
          userId: "user-1",
          taskId: "task-1",
          task: {
            id: "task-1",
            title: "季度资料收集",
            dueAt: new Date("2026-04-06T14:00:00.000Z"),
            status: "ACTIVE",
          },
        },
      ]);
      // Dedup check: no existing notification today
      dbMock.notification.findFirst.mockResolvedValue(null);
      dbMock.notification.createMany.mockResolvedValue({ count: 1 });

      const service = await import("./notification.service");
      const result = await service.checkAndGenerateDueReminders({
        userId: "user-1",
        now: todayStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.created).toBe(1);
      }
      expect(dbMock.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            recipientId: "user-1",
            taskId: "task-1",
            type: "DUE_TODAY",
          }),
        ],
      });
    });

    it("应为逾期未提交任务生成 OVERDUE 通知", async () => {
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([
        {
          id: "asg-2",
          userId: "user-2",
          taskId: "task-2",
          task: {
            id: "task-2",
            title: "月度报告",
            dueAt: new Date("2026-04-05T10:00:00.000Z"),
            status: "ACTIVE",
          },
        },
      ]);
      dbMock.notification.findFirst.mockResolvedValue(null);
      dbMock.notification.createMany.mockResolvedValue({ count: 1 });

      const service = await import("./notification.service");
      const result = await service.checkAndGenerateDueReminders({
        userId: "user-2",
        now: todayStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.created).toBe(1);
      }
      expect(dbMock.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            recipientId: "user-2",
            taskId: "task-2",
            type: "OVERDUE",
          }),
        ],
      });
    });

    it("已去重：今天已有相同通知时不应重复生成", async () => {
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([
        {
          id: "asg-1",
          userId: "user-1",
          taskId: "task-1",
          task: {
            id: "task-1",
            title: "季度资料收集",
            dueAt: new Date("2026-04-06T14:00:00.000Z"),
            status: "ACTIVE",
          },
        },
      ]);
      // Dedup check: already exists today
      dbMock.notification.findFirst.mockResolvedValue({
        id: "notif-existing",
      });

      const service = await import("./notification.service");
      const result = await service.checkAndGenerateDueReminders({
        userId: "user-1",
        now: todayStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.created).toBe(0);
      }
      expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    });

    it("应跳过 CLOSED 状态的任务", async () => {
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([
        {
          id: "asg-3",
          userId: "user-3",
          taskId: "task-3",
          task: {
            id: "task-3",
            title: "已关闭任务",
            dueAt: new Date("2026-04-06T10:00:00.000Z"),
            status: "CLOSED",
          },
        },
      ]);

      const service = await import("./notification.service");
      const result = await service.checkAndGenerateDueReminders({
        userId: "user-3",
        now: todayStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.created).toBe(0);
      }
      expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    });

    it("应跳过已提交的 assignee（查询已过滤）", async () => {
      // The query filters by submittedAt: null, so submitted assignees should not appear
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([]);

      const service = await import("./notification.service");
      const result = await service.checkAndGenerateDueReminders({
        userId: "user-1",
        now: todayStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.created).toBe(0);
      }
    });

    it("应使用正确的查询参数过滤 assignee", async () => {
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([]);

      const service = await import("./notification.service");
      await service.checkAndGenerateDueReminders({
        userId: "user-1",
        now: todayStart,
      });

      // The service uses local date components from `now`, so compute expected range the same way
      const nowDate = new Date(todayStart);
      const _expectedStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0);
      const expectedEnd = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 23, 59, 59, 999);

      expect(dbMock.documentCollectionAssignee.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          submittedAt: null,
          task: {
            status: "ACTIVE",
            dueAt: { lte: expectedEnd },
          },
        },
        include: {
          task: { select: { id: true, title: true, dueAt: true, status: true } },
        },
      });
    });

    it("dedup 查询应使用正确的条件", async () => {
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([
        {
          id: "asg-1",
          userId: "user-1",
          taskId: "task-1",
          task: {
            id: "task-1",
            title: "季度资料收集",
            dueAt: new Date("2026-04-06T14:00:00.000Z"),
            status: "ACTIVE",
          },
        },
      ]);
      dbMock.notification.findFirst.mockResolvedValue(null);
      dbMock.notification.createMany.mockResolvedValue({ count: 1 });

      const service = await import("./notification.service");
      await service.checkAndGenerateDueReminders({
        userId: "user-1",
        now: todayStart,
      });

      // The service uses local date components from `now`, so compute expected range the same way
      const nowDate = new Date(todayStart);
      const _expectedStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0);
      const expectedEnd = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 23, 59, 59, 999);

      expect(dbMock.notification.findFirst).toHaveBeenCalledWith({
        where: {
          recipientId: "user-1",
          taskId: "task-1",
          type: "DUE_TODAY",
          createdAt: { gte: _expectedStart, lt: expectedEnd },
        },
      });
    });

    it("应批量生成多个通知", async () => {
      dbMock.documentCollectionAssignee.findMany.mockResolvedValue([
        {
          id: "asg-1",
          userId: "user-1",
          taskId: "task-1",
          task: {
            id: "task-1",
            title: "任务A",
            dueAt: new Date("2026-04-06T10:00:00.000Z"),
            status: "ACTIVE",
          },
        },
        {
          id: "asg-2",
          userId: "user-1",
          taskId: "task-2",
          task: {
            id: "task-2",
            title: "任务B",
            dueAt: new Date("2026-04-05T10:00:00.000Z"),
            status: "ACTIVE",
          },
        },
      ]);
      // No existing notifications
      dbMock.notification.findFirst.mockResolvedValue(null);
      dbMock.notification.createMany.mockResolvedValue({ count: 2 });

      const service = await import("./notification.service");
      const result = await service.checkAndGenerateDueReminders({
        userId: "user-1",
        now: todayStart,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.created).toBe(2);
      }
    });
  });

  describe("sendManualRemind", () => {
    it("创建者可以手动催办，仅通知未提交的 assignee", async () => {
      dbMock.documentCollectionTask.findFirst.mockResolvedValue({
        id: "task-1",
        title: "季度资料收集",
        status: "ACTIVE",
        createdById: "creator-1",
        assignees: [
          {
            userId: "user-1",
            submittedAt: null,
          },
          {
            userId: "user-2",
            submittedAt: new Date("2026-04-05T10:00:00.000Z"),
          },
        ],
      });
      dbMock.notification.createMany.mockResolvedValue({ count: 1 });

      const service = await import("./notification.service");
      const result = await service.sendManualRemind({
        taskId: "task-1",
        senderId: "creator-1",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(1);
      }
      expect(dbMock.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            recipientId: "user-1",
            taskId: "task-1",
            type: "MANUAL_REMIND",
          }),
        ],
      });
    });

    it("非创建者催办应返回 NOT_FOUND", async () => {
      dbMock.documentCollectionTask.findFirst.mockResolvedValue({
        id: "task-1",
        title: "季度资料收集",
        status: "ACTIVE",
        createdById: "creator-1",
        assignees: [],
      });

      const service = await import("./notification.service");
      const result = await service.sendManualRemind({
        taskId: "task-1",
        senderId: "other-user",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
      expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    });

    it("已关闭的任务应返回 TASK_CLOSED 错误", async () => {
      dbMock.documentCollectionTask.findFirst.mockResolvedValue({
        id: "task-1",
        title: "季度资料收集",
        status: "CLOSED",
        createdById: "creator-1",
        assignees: [],
      });

      const service = await import("./notification.service");
      const result = await service.sendManualRemind({
        taskId: "task-1",
        senderId: "creator-1",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("TASK_CLOSED");
      }
      expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    });

    it("所有 assignee 都已提交时不应创建通知", async () => {
      dbMock.documentCollectionTask.findFirst.mockResolvedValue({
        id: "task-1",
        title: "季度资料收集",
        status: "ACTIVE",
        createdById: "creator-1",
        assignees: [
          {
            userId: "user-1",
            submittedAt: new Date("2026-04-05T10:00:00.000Z"),
          },
          {
            userId: "user-2",
            submittedAt: new Date("2026-04-05T12:00:00.000Z"),
          },
        ],
      });

      const service = await import("./notification.service");
      const result = await service.sendManualRemind({
        taskId: "task-1",
        senderId: "creator-1",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
      expect(dbMock.notification.createMany).not.toHaveBeenCalled();
    });

    it("任务不存在时应返回 NOT_FOUND", async () => {
      dbMock.documentCollectionTask.findFirst.mockResolvedValue(null);

      const service = await import("./notification.service");
      const result = await service.sendManualRemind({
        taskId: "nonexistent",
        senderId: "creator-1",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("催办通知应包含正确的标题和内容", async () => {
      dbMock.documentCollectionTask.findFirst.mockResolvedValue({
        id: "task-1",
        title: "季度资料收集",
        status: "ACTIVE",
        createdById: "creator-1",
        assignees: [
          {
            userId: "user-1",
            submittedAt: null,
          },
        ],
      });
      dbMock.notification.createMany.mockResolvedValue({ count: 1 });

      const service = await import("./notification.service");
      await service.sendManualRemind({
        taskId: "task-1",
        senderId: "creator-1",
      });

      expect(dbMock.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            recipientId: "user-1",
            taskId: "task-1",
            type: "MANUAL_REMIND",
            title: "催办提醒",
            content: expect.stringContaining("季度资料收集"),
          }),
        ],
      });
    });
  });
});
