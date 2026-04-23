import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldType } from "@/generated/prisma/enums";
import { exportToExcel } from "@/lib/services/export.service";
import type { DataFieldItem } from "@/types/data-table";

const { getTableMock, findManyMock } = vi.hoisted(() => ({
  getTableMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/services/data-table.service", () => ({
  getTable: getTableMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    dataRecord: {
      findMany: findManyMock,
    },
  },
}));

function buildField(partial: Partial<DataFieldItem>): DataFieldItem {
  return {
    id: partial.id ?? `field-${partial.key ?? "title"}`,
    key: partial.key ?? "title",
    label: partial.label ?? "标题",
    type: partial.type ?? FieldType.TEXT,
    required: partial.required ?? false,
    sortOrder: partial.sortOrder ?? 0,
    ...partial,
  };
}

describe("exportToExcel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports rows using visible field order and relation display text", async () => {
    getTableMock.mockResolvedValue({
      success: true,
      data: {
        id: "table-1",
        name: "论文",
        description: null,
        icon: null,
        businessKeys: [],
        fields: [
          buildField({ key: "title", label: "标题", type: FieldType.TEXT, sortOrder: 0 }),
          buildField({ key: "authors", label: "作者", type: FieldType.RELATION, sortOrder: 1 }),
          buildField({ key: "status", label: "状态", type: FieldType.SELECT, sortOrder: 2 }),
        ],
      },
    });
    findManyMock.mockResolvedValue([
      {
        id: "rec-1",
        data: {
          title: "论文 A",
          authors: [
            { id: "author-1", displayValue: "张三" },
            { id: "author-2", displayValue: "李四" },
          ],
          status: "已发布",
        },
        createdAt: new Date("2026-04-24T00:00:00.000Z"),
        updatedAt: new Date("2026-04-24T00:00:00.000Z"),
      },
    ]);

    const result = await exportToExcel("table-1", {
      visibleFields: ["authors", "title"],
      fieldOrder: ["authors", "status", "title"],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("expected success");
    }

    const workbook = XLSX.read(result.data, { type: "buffer" });
    const worksheet = workbook.Sheets["论文"];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
      header: 1,
      raw: false,
    });

    expect(rows).toEqual([
      ["作者", "标题"],
      ["张三, 李四", "论文 A"],
    ]);
  });
});
