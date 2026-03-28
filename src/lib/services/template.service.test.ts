import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  template: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("template.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getTemplate 应返回 TABLE 占位符的列定义", async () => {
    dbMock.template.findUnique.mockResolvedValue({
      id: "tpl-1",
      name: "员工月报模板",
      fileName: "monthly.docx",
      originalFileName: "monthly.docx",
      fileSize: 1024,
      status: "PUBLISHED",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
      categoryId: null,
      description: null,
      createdById: "user-1",
      createdBy: { name: "Admin" },
      dataTableId: null,
      dataTable: null,
      fieldMapping: null,
      category: null,
      tags: [],
      currentVersion: null,
      placeholders: [
        {
          id: "ph-1",
          key: "工作内容",
          label: "工作内容",
          inputType: "TABLE",
          required: false,
          defaultValue: null,
          sortOrder: 0,
          sourceTableId: null,
          sourceField: null,
          enablePicker: false,
          columns: [
            { key: "日期", label: "日期" },
            { key: "事项", label: "事项" },
          ],
          description: null,
        },
      ],
    });

    const service = await import("./template.service");
    const result = await service.getTemplate("tpl-1");

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.placeholders).toEqual([
      expect.objectContaining({
        key: "工作内容",
        inputType: "TABLE",
        columns: [
          { key: "日期", label: "日期" },
          { key: "事项", label: "事项" },
        ],
      }),
    ]);
  });
});
