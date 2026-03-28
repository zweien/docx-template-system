import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  template: {
    findUnique: vi.fn(),
  },
  placeholder: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("placeholder.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updatePlaceholders 在 TABLE 未传 columns 时应保留已有列定义", async () => {
    dbMock.placeholder.findMany
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          id: "ph-2",
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
      ]);

    dbMock.placeholder.deleteMany.mockResolvedValue({ count: 1 });
    dbMock.placeholder.createMany.mockResolvedValue({ count: 1 });

    const service = await import("./placeholder.service");
    const result = await service.updatePlaceholders("tpl-1", [
      {
        key: "工作内容",
        label: "工作内容",
        inputType: "TABLE",
        required: false,
        defaultValue: null,
        sortOrder: 0,
      },
    ]);

    expect(result.success).toBe(true);
    expect(dbMock.placeholder.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          key: "工作内容",
          inputType: "TABLE",
          columns: [
            { key: "日期", label: "日期" },
            { key: "事项", label: "事项" },
          ],
        }),
      ],
    });
  });
});
