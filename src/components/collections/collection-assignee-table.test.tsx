import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollectionAssigneeTable } from "./collection-assignee-table";

describe("CollectionAssigneeTable", () => {
  it("应为每个提交人提供历史版本入口和最新文件下载链接", () => {
    render(
      <CollectionAssigneeTable
        taskId="task-1"
        selectedAssigneeId="asg-1"
        assignees={[
          {
            id: "asg-1",
            taskId: "task-1",
            userId: "user-1",
            userName: "张三",
            userEmail: "zhangsan@example.com",
            latestVersionId: "ver-1",
            latestVersion: {
              id: "ver-1",
              assigneeId: "asg-1",
              version: 1,
              fileName: "ver-1.docx",
              originalFileName: "材料.docx",
              storagePath: "/uploads/collections/submissions/ver-1.docx",
              fileSize: 120,
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              submittedById: "user-1",
              submittedByName: "张三",
              submittedAt: new Date("2026-04-02T10:00:00.000Z"),
              note: null,
              isLate: false,
            },
            submittedAt: new Date("2026-04-02T10:00:00.000Z"),
            versionCount: 1,
            status: "SUBMITTED",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-02T10:00:00.000Z"),
          },
        ]}
      />
    );

    expect(screen.getByRole("link", { name: "材料.docx" })).toHaveAttribute(
      "href",
      "/api/collections/task-1/submissions/ver-1/download"
    );
    expect(screen.getByRole("link", { name: "查看历史" })).toHaveAttribute(
      "href",
      "/collections/task-1?assigneeId=asg-1"
    );
  });
});
