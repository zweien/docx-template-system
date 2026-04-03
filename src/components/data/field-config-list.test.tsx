import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem, DataTableListItem } from "@/types/data-table";
import { FieldConfigList } from "./field-config-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("./field-config-form", () => ({
  FieldConfigForm: () => null,
}));

describe("FieldConfigList", () => {
  it("优先展示 RELATION_SUBTABLE 字段真实 inverseFieldKey", () => {
    const fields: DataFieldItem[] = [
      {
        id: "field-1",
        key: "authors",
        label: "作者",
        type: FieldType.RELATION_SUBTABLE,
        required: false,
        relationTo: "paper_table_id",
        displayField: "title",
        relationCardinality: "SINGLE",
        inverseRelationCardinality: "MULTIPLE",
        inverseFieldId: "field-2",
        inverseFieldKey: "paper_authors_inverse",
        isSystemManagedInverse: false,
        relationSchema: {
          version: 1,
          fields: [],
        },
        defaultValue: undefined,
        sortOrder: 0,
      },
    ];

    const availableTables: DataTableListItem[] = [
      {
        id: "paper_table_id",
        name: "论文",
        description: null,
        icon: null,
        fieldCount: 1,
        recordCount: 0,
        createdAt: new Date("2026-04-03T00:00:00.000Z"),
      },
    ];

    render(<FieldConfigList tableId="paper_table_id" fields={fields} availableTables={availableTables} />);

    const summaryNodes = screen.getAllByText((_, element) =>
      element?.textContent?.includes("paper_authors_inverse / MULTIPLE") ?? false
    );
    expect(
      summaryNodes.some((node) => node.className.includes("space-y-1"))
    ).toBe(true);
  });
});
