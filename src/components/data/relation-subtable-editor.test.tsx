import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem, RelationSubtableValueItem } from "@/types/data-table";
import { RelationSubtableEditor } from "./relation-subtable-editor";

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children: ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("./relation-target-picker", () => ({
  RelationTargetPicker: ({
    value,
    onChange,
  }: {
    value: { id: string; label: string } | null;
    onChange: (next: { id: string; label: string } | null) => void;
  }) => (
    <select
      aria-label="目标记录"
      value={value?.id ?? ""}
      onChange={(event) => {
        const nextId = event.target.value;
        onChange(
          nextId
            ? { id: nextId, label: nextId === "target-1" ? "张三" : "李四" }
            : null
        );
      }}
    >
      <option value="">请选择</option>
      <option value="target-1">张三</option>
      <option value="target-2">李四</option>
    </select>
  ),
}));

function buildRelationField(
  overrides: Partial<DataFieldItem> = {}
): DataFieldItem {
  return {
    id: "field-1",
    key: "authors",
    label: "作者",
    type: FieldType.RELATION_SUBTABLE,
    required: false,
    relationTo: "author-table",
    displayField: "name",
    relationCardinality: "MULTIPLE",
    relationSchema: {
      version: 1,
      fields: [
        {
          key: "role",
          label: "角色",
          type: FieldType.TEXT,
          required: false,
          sortOrder: 0,
        },
        {
          key: "rank",
          label: "排序号",
          type: FieldType.NUMBER,
          required: false,
          sortOrder: 1,
        },
      ],
    },
    defaultValue: "",
    sortOrder: 0,
    ...overrides,
  };
}

function RelationSubtableEditorHarness({
  field,
  initialValue,
  onValueChange,
}: {
  field: DataFieldItem;
  initialValue: RelationSubtableValueItem[];
  onValueChange?: (next: RelationSubtableValueItem[]) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <div>
      <RelationSubtableEditor
        field={field}
        value={value}
        onChange={(nextValue) => {
          onValueChange?.(nextValue);
          setValue(nextValue);
        }}
      />
      <pre data-testid="relation-value">{JSON.stringify(value)}</pre>
    </div>
  );
}

describe("RelationSubtableEditor", () => {
  it("adds/removes relation rows and edits relation attributes", async () => {
    render(
      <RelationSubtableEditorHarness
        field={buildRelationField()}
        initialValue={[
          {
            targetRecordId: "target-1",
            displayValue: "张三",
            attributes: { role: "第一作者", rank: 1 },
            sortOrder: 0,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "添加关联记录" }));

    const rows = screen.getAllByTestId("relation-row");
    expect(rows).toHaveLength(2);

    let secondRow = rows[1];
    fireEvent.change(within(secondRow).getByLabelText("目标记录"), {
      target: { value: "target-2" },
    });

    secondRow = screen.getAllByTestId("relation-row")[1];
    fireEvent.change(within(secondRow).getByPlaceholderText("输入角色"), {
      target: { value: "通讯作者" },
    });

    secondRow = screen.getAllByTestId("relation-row")[1];
    fireEvent.change(within(secondRow).getByPlaceholderText("输入排序号"), {
      target: { value: "2" },
    });

    fireEvent.click(within(rows[0]).getByRole("button", { name: "删除" }));

    expect(screen.getAllByTestId("relation-row")).toHaveLength(1);
    expect(screen.getByTestId("relation-value").textContent).toBe(
      JSON.stringify([
        {
          targetRecordId: "target-2",
          displayValue: "李四",
          attributes: { role: "通讯作者", rank: 2 },
          sortOrder: 0,
        },
      ])
    );
  });

  it("prevents adding more than one row when cardinality is SINGLE", async () => {
    render(
      <RelationSubtableEditorHarness
        field={buildRelationField({ relationCardinality: "SINGLE" })}
        initialValue={[]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "添加关联记录" }));

    expect(screen.getAllByTestId("relation-row")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "添加关联记录" })
    ).toBeDisabled();
  });

  it("moves rows by current array order and rewrites sortOrder from indices", async () => {
    const onValueChange = vi.fn();

    render(
      <RelationSubtableEditorHarness
        field={buildRelationField()}
        initialValue={[
          {
            targetRecordId: "target-1",
            displayValue: "张三",
            attributes: { role: "第一作者", rank: 1 },
            sortOrder: 0,
          },
          {
            targetRecordId: "target-2",
            displayValue: "李四",
            attributes: { role: "通讯作者", rank: 2 },
            sortOrder: 1,
          },
        ]}
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(
      within(screen.getAllByTestId("relation-row")[0]).getByRole("button", {
        name: "下移",
      })
    );

    expect(onValueChange).toHaveBeenLastCalledWith([
      {
        targetRecordId: "target-2",
        displayValue: "李四",
        attributes: { role: "通讯作者", rank: 2 },
        sortOrder: 0,
      },
      {
        targetRecordId: "target-1",
        displayValue: "张三",
        attributes: { role: "第一作者", rank: 1 },
        sortOrder: 1,
      },
    ]);

    fireEvent.click(
      within(screen.getAllByTestId("relation-row")[1]).getByRole("button", {
        name: "上移",
      })
    );

    expect(onValueChange).toHaveBeenLastCalledWith([
      {
        targetRecordId: "target-1",
        displayValue: "张三",
        attributes: { role: "第一作者", rank: 1 },
        sortOrder: 0,
      },
      {
        targetRecordId: "target-2",
        displayValue: "李四",
        attributes: { role: "通讯作者", rank: 2 },
        sortOrder: 1,
      },
    ]);
  });
});
