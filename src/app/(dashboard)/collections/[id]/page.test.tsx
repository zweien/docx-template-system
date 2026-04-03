import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getDocumentCollectionTaskDetailMock = vi.fn();
const listDocumentCollectionSubmissionVersionsMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/document-collection-task.service", () => ({
  getDocumentCollectionTaskDetail: getDocumentCollectionTaskDetailMock,
}));

vi.mock("@/lib/services/document-collection-submission.service", () => ({
  listDocumentCollectionSubmissionVersions: listDocumentCollectionSubmissionVersionsMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("CollectionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("发起人应可按 assigneeId 查询并查看指定提交人的版本历史", async () => {
    authMock.mockResolvedValue({ user: { id: "creator-1" } });
    getDocumentCollectionTaskDetailMock.mockResolvedValue({
      success: true,
      data: {
        id: "task-1",
        title: "季度资料收集",
        instruction: "请上传盖章文件",
        dueAt: new Date("2026-04-10T10:00:00.000Z"),
        status: "ACTIVE",
        renameRule: "{姓名}_{原始文件名}",
        renameVariables: {},
        createdById: "creator-1",
        createdByName: "创建者",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        attachments: [],
        viewerRole: "creator",
        assignees: [
          {
            id: "asg-1",
            taskId: "task-1",
            userId: "user-1",
            userName: "张三",
            userEmail: "zhangsan@example.com",
            latestVersionId: null,
            latestVersion: null,
            submittedAt: null,
            versionCount: 0,
            status: "PENDING",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          },
          {
            id: "asg-2",
            taskId: "task-1",
            userId: "user-2",
            userName: "李四",
            userEmail: "lisi@example.com",
            latestVersionId: "ver-2",
            latestVersion: {
              id: "ver-2",
              assigneeId: "asg-2",
              version: 2,
              fileName: "ver-2.docx",
              originalFileName: "合同.pdf",
              storagePath: "/uploads/collections/submissions/ver-2.pdf",
              fileSize: 2048,
              mimeType: "application/pdf",
              submittedById: "user-2",
              submittedByName: "李四",
              submittedAt: new Date("2026-04-02T10:00:00.000Z"),
              note: "第二版",
              isLate: false,
            },
            submittedAt: new Date("2026-04-02T10:00:00.000Z"),
            versionCount: 2,
            status: "SUBMITTED",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-02T10:00:00.000Z"),
          },
        ],
      },
    });
    listDocumentCollectionSubmissionVersionsMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: "ver-2",
          assigneeId: "asg-2",
          version: 2,
          fileName: "ver-2.pdf",
          originalFileName: "合同.pdf",
          storagePath: "/uploads/collections/submissions/ver-2.pdf",
          fileSize: 2048,
          mimeType: "application/pdf",
          submittedById: "user-2",
          submittedByName: "李四",
          submittedAt: new Date("2026-04-02T10:00:00.000Z"),
          note: "第二版",
          isLate: false,
        },
      ],
    });

    const { default: CollectionDetailPage } = await import("./page");

    render(
      await CollectionDetailPage({
        params: Promise.resolve({ id: "task-1" }),
        searchParams: Promise.resolve({ assigneeId: "asg-2" }),
      } as never)
    );

    expect(listDocumentCollectionSubmissionVersionsMock).toHaveBeenCalledWith({
      taskId: "task-1",
      userId: "creator-1",
      assigneeId: "asg-2",
    });
    expect(screen.getByRole("link", { name: "ver-2.pdf" })).toHaveAttribute(
      "href",
      "/api/collections/task-1/submissions/ver-2/download"
    );
  });
});
