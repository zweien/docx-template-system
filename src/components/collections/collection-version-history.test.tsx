import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollectionVersionHistory } from "./collection-version-history";

describe("CollectionVersionHistory", () => {
  it("应渲染版本列表与备注", () => {
    render(
      <CollectionVersionHistory
        taskId="task-1"
        versions={[
          {
            id: "ver-2",
            assigneeId: "asg-1",
            version: 2,
            fileName: "营业执照_v2.docx",
            originalFileName: "营业执照.docx",
            storagePath: "/uploads/collections/submissions/ver-2.docx",
            fileSize: 1024,
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            submittedById: "user-1",
            submittedByName: "张三",
            submittedAt: new Date("2026-04-02T08:00:00.000Z"),
            note: "补充盖章版本",
            isLate: false,
          },
          {
            id: "ver-1",
            assigneeId: "asg-1",
            version: 1,
            fileName: "营业执照_v1.docx",
            originalFileName: "营业执照.docx",
            storagePath: "/uploads/collections/submissions/ver-1.docx",
            fileSize: 512,
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            submittedById: "user-1",
            submittedByName: "张三",
            submittedAt: new Date("2026-04-01T08:00:00.000Z"),
            note: null,
            isLate: true,
          },
        ]}
      />
    );

    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("补充盖章版本")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "营业执照_v1.docx" })).toHaveAttribute(
      "href",
      "/api/collections/task-1/submissions/ver-1/download"
    );
    expect(screen.getByText("逾期提交")).toBeInTheDocument();
  });
});
