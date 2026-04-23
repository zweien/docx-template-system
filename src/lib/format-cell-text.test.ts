import { FieldType } from "@/generated/prisma/enums";
import { describe, expect, it } from "vitest";
import { formatCellText } from "@/lib/format-cell-text";
import type { DataFieldItem } from "@/types/data-table";

function buildField(partial: Partial<DataFieldItem>): DataFieldItem {
  return {
    id: partial.id ?? "field-1",
    key: partial.key ?? "title",
    label: partial.label ?? "标题",
    type: partial.type ?? FieldType.TEXT,
    required: partial.required ?? false,
    sortOrder: partial.sortOrder ?? 0,
    ...partial,
  };
}

describe("formatCellText", () => {
  it("formats relation arrays as comma-separated display text", () => {
    const field = buildField({
      key: "authors",
      label: "作者",
      type: FieldType.RELATION,
    });

    expect(
      formatCellText(field, [
        { id: "author-1", displayValue: "张三" },
        { id: "author-2", display: "李四" },
        { id: "author-3" },
      ])
    ).toBe("张三, 李四, author-3");
  });

  it("formats relation subtable values in sort order", () => {
    const field = buildField({
      key: "paperAuthors",
      label: "作者",
      type: FieldType.RELATION_SUBTABLE,
    });

    expect(
      formatCellText(field, [
        { targetRecordId: "author-2", displayValue: "李四", attributes: {}, sortOrder: 1 },
        { targetRecordId: "author-1", displayValue: "张三", attributes: {}, sortOrder: 0 },
      ])
    ).toBe("张三, 李四");
  });

  it("formats multiselect values with spaces after commas", () => {
    const field = buildField({
      key: "tags",
      label: "标签",
      type: FieldType.MULTISELECT,
    });

    expect(formatCellText(field, ["A", "B", "C"])).toBe("A, B, C");
  });
});
