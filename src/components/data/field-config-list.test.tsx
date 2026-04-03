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

  it("新建未保存的 RELATION_SUBTABLE 字段可回退到预览反向字段名", () => {
    render(
      <FieldConfigList
        tableId="paper_table_id"
        fields={[
          {
            id: "",
            key: "authors",
            label: "作者",
            type: FieldType.RELATION_SUBTABLE,
            required: false,
            relationTo: "paper_table_id",
            displayField: "title",
            relationCardinality: "SINGLE",
            inverseRelationCardinality: "MULTIPLE",
            inverseFieldId: null,
            inverseFieldKey: null,
            isSystemManagedInverse: false,
            relationSchema: { version: 1, fields: [] },
            defaultValue: undefined,
            sortOrder: 0,
          },
        ]}
        availableTables={availableTables}
      />
    );

    expect(screen.getByText("反向字段: authors_inverse / MULTIPLE")).toBeInTheDocument();
  });

  it("已持久化的 RELATION_SUBTABLE 字段缺失 inverseFieldKey 时显示横线", () => {
    render(
      <FieldConfigList
        tableId="paper_table_id"
        fields={[
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
            inverseFieldKey: null,
            isSystemManagedInverse: false,
            relationSchema: { version: 1, fields: [] },
            defaultValue: undefined,
            sortOrder: 0,
          },
        ]}
        availableTables={availableTables}
      />
    );

    expect(screen.getByText("反向字段: - / MULTIPLE")).toBeInTheDocument();
    expect(screen.queryByText("反向字段: authors_inverse / MULTIPLE")).not.toBeInTheDocument();
  });
});
