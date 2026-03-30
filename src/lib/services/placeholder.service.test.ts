import { beforeEach, describe, expect, it, vi } from "vitest";

const parseStructuredPlaceholdersMock = vi.fn();

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

vi.mock("@/lib/docx-parser", () => ({
  parseStructuredPlaceholders: parseStructuredPlaceholdersMock,
}));

describe("placeholder.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parsePlaceholders 应创建 CHOICE_SINGLE 占位符并带 choiceConfig", async () => {
    dbMock.template.findUnique.mockResolvedValue({
      id: "tpl-1",
      filePath: "/tmp/template.docx",
    });
    dbMock.placeholder.deleteMany.mockResolvedValue({ count: 0 });
    dbMock.placeholder.createMany.mockResolvedValue({ count: 2 });
    dbMock.placeholder.findMany.mockResolvedValue([
      {
        id: "ph-1",
        key: "姓名",
        label: "姓名",
        inputType: "TEXT",
        required: false,
        defaultValue: null,
        sortOrder: 0,
        sourceTableId: null,
        sourceField: null,
        enablePicker: false,
        columns: null,
        choiceConfig: null,
        description: null,
      },
      {
        id: "ph-2",
        key: "性别",
        label: "性别",
        inputType: "CHOICE_SINGLE",
        required: false,
        defaultValue: null,
        sortOrder: 1,
        sourceTableId: null,
        sourceField: null,
        enablePicker: false,
        columns: null,
        choiceConfig: {
          mode: "single",
          options: [
            { value: "男", label: "男" },
            { value: "女", label: "女" },
          ],
          marker: {
            template: "□",
            checked: "☑",
            unchecked: "☐",
          },
        },
        description: null,
      },
    ]);

    parseStructuredPlaceholdersMock.mockResolvedValue({
      simplePlaceholders: ["姓名"],
      tableBlocks: [],
      choiceBlocks: [
        {
          key: "性别",
          mode: "single",
          options: [
            { value: "男", label: "男", paragraphIndex: 1, markerText: "□" },
            { value: "女", label: "女", paragraphIndex: 2, markerText: "□" },
          ],
        },
      ],
    });

    const service = await import("./placeholder.service");
    const result = await service.parsePlaceholders("tpl-1");

    expect(result.success).toBe(true);
    expect(dbMock.placeholder.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          key: "性别",
          inputType: "CHOICE_SINGLE",
          choiceConfig: {
            mode: "single",
            options: [
              { value: "男", label: "男" },
              { value: "女", label: "女" },
            ],
            marker: {
              template: "□",
              checked: "☑",
              unchecked: "☐",
            },
          },
        }),
      ]),
    });
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
