import { fireEvent, render, screen } from "@testing-library/react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldType } from "@/generated/prisma/enums";
import type { DataFieldItem } from "@/types/data-table";
import { FieldConfigForm } from "./field-config-form";

const {
  onSubmitMock,
  onOpenChangeMock,
} = vi.hoisted(() => ({
  onSubmitMock: vi.fn(),
  onOpenChangeMock: vi.fn(),
}));

const SelectContext = createContext<{
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
} | null>(null);

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
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

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    disabled,
    onValueChange,
    children,
  }: {
    value?: string;
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    children: ReactNode;
  }) => {
    const [currentValue, setCurrentValue] = useState(value ?? "");
    const resolvedValue = value ?? currentValue;
    const ctx = useMemo(
      () => ({
        value: resolvedValue,
        disabled,
        onValueChange: (next: string) => {
          setCurrentValue(next);
          onValueChange?.(next);
        },
      }),
      [disabled, onValueChange, resolvedValue]
    );

    return <SelectContext.Provider value={ctx}>{children}</SelectContext.Provider>;
  },
  SelectTrigger: ({
    children,
    disabled,
    id,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const ctx = useContext(SelectContext);
    return (
      <button
        type="button"
        id={id}
        disabled={disabled ?? ctx?.disabled}
        data-testid={id}
        {...props}
      >
        {children}
      </button>
    );
  },
  SelectValue: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: ReactNode;
  }) => {
    const ctx = useContext(SelectContext);
    return (
      <button type="button" onClick={() => ctx?.onValueChange(value)}>
        {children}
      </button>
    );
  },
}));

vi.mock("@/generated/prisma/enums", () => ({
  FieldType: {
    TEXT: "TEXT",
    NUMBER: "NUMBER",
    DATE: "DATE",
    SELECT: "SELECT",
    MULTISELECT: "MULTISELECT",
    EMAIL: "EMAIL",
    PHONE: "PHONE",
    FILE: "FILE",
    URL: "URL",
    BOOLEAN: "BOOLEAN",
    AUTO_NUMBER: "AUTO_NUMBER",
    SYSTEM_TIMESTAMP: "SYSTEM_TIMESTAMP",
    SYSTEM_USER: "SYSTEM_USER",
    FORMULA: "FORMULA",
    COUNT: "COUNT",
    LOOKUP: "LOOKUP",
    ROLLUP: "ROLLUP",
    RICH_TEXT: "RICH_TEXT",
    RATING: "RATING",
    CURRENCY: "CURRENCY",
    PERCENTAGE: "PERCENTAGE",
    DURATION: "DURATION",
    RELATION: "RELATION",
    RELATION_SUBTABLE: "RELATION_SUBTABLE",
  },
  RelationCardinality: {
    SINGLE: "SINGLE",
    MULTIPLE: "MULTIPLE",
  },
}));

function buildRelationField(overrides: Partial<DataFieldItem> = {}): DataFieldItem {
  return {
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
    isSystemManagedInverse: false,
    relationSchema: null,
    defaultValue: "",
    sortOrder: 0,
    ...overrides,
  };
}

const availableTables = [
  {
    id: "paper_table_id",
    name: "论文",
    fields: [
      {
        id: "title-id",
        key: "title",
        label: "标题",
        type: FieldType.TEXT,
        required: false,
        sortOrder: 0,
      } as DataFieldItem,
    ],
  },
  {
    id: "author_table_id",
    name: "作者",
    fields: [
      {
        id: "name-id",
        key: "name",
        label: "姓名",
        type: FieldType.TEXT,
        required: false,
        sortOrder: 0,
      } as DataFieldItem,
    ],
  },
];

describe("FieldConfigForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("已持久化字段会锁定 key、type 和关系结构字段", () => {
    render(
      <FieldConfigForm
        open
        onOpenChange={onOpenChangeMock}
        field={buildRelationField({ id: "field-1" })}
        availableTables={availableTables}
        onSubmit={onSubmitMock}
      />
    );

    expect(screen.getByPlaceholderText("例如：project_name")).toBeDisabled();
    expect(screen.getByTestId("field-type-select")).toBeDisabled();
    expect(screen.getByTestId("relation-table-select")).toBeDisabled();
    expect(screen.getByTestId("relation-cardinality-select")).toBeDisabled();
    expect(screen.getByTestId("inverse-relation-cardinality-select")).toBeDisabled();
    expect(screen.getByTestId("relation-display-field-select")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "添加边属性" })).not.toBeDisabled();
  });

  it("系统反向字段提交时保持原结构性值", () => {
    render(
      <FieldConfigForm
        open
        onOpenChange={onOpenChangeMock}
        field={buildRelationField({
          id: "field-1",
          key: "paper_authors_inverse",
          label: "论文作者（反向）",
          relationTo: "paper_table_id",
          displayField: "title",
          relationCardinality: "MULTIPLE",
          inverseRelationCardinality: "MULTIPLE",
          inverseFieldId: "field-2",
          isSystemManagedInverse: true,
          relationSchema: {
            version: 1,
            fields: [
              {
                key: "author_name",
                label: "作者姓名",
                type: FieldType.TEXT,
                required: true,
                sortOrder: 0,
              },
            ],
          },
        })}
        availableTables={availableTables}
        onSubmit={onSubmitMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSubmitMock).toHaveBeenCalledTimes(1);
    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: FieldType.RELATION_SUBTABLE,
        relationTo: "paper_table_id",
        relationCardinality: "MULTIPLE",
        inverseRelationCardinality: "MULTIPLE",
        inverseFieldId: "field-2",
        isSystemManagedInverse: true,
        relationSchema: {
          version: 1,
          fields: [
            expect.objectContaining({
              key: "author_name",
              label: "作者姓名",
              type: FieldType.TEXT,
              required: true,
              sortOrder: 0,
            }),
          ],
        },
      })
    );
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("正向字段边属性重复 key 会阻止提交", () => {
    render(
      <FieldConfigForm
        open
        onOpenChange={onOpenChangeMock}
        field={buildRelationField({ id: "", relationSchema: { version: 1, fields: [] } })}
        availableTables={availableTables}
        onSubmit={onSubmitMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "添加边属性" }));
    fireEvent.click(screen.getByRole("button", { name: "添加边属性" }));

    const keyInputs = screen.getAllByLabelText("子字段标识");
    const labelInputs = screen.getAllByLabelText("子字段名称");

    fireEvent.change(keyInputs[0], { target: { value: "author_name" } });
    fireEvent.change(labelInputs[0], { target: { value: "作者姓名" } });
    fireEvent.change(keyInputs[1], { target: { value: "author_name" } });
    fireEvent.change(labelInputs[1], { target: { value: "作者姓名2" } });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSubmitMock).not.toHaveBeenCalled();
    expect(screen.getByText("边属性子字段标识不能重复")).toBeInTheDocument();
  });

  it("边属性上移下移会改变提交顺序", () => {
    render(
      <FieldConfigForm
        open
        onOpenChange={onOpenChangeMock}
        field={buildRelationField({
          id: "",
          relationSchema: {
            version: 1,
            fields: [
              {
                key: "author_name",
                label: "作者姓名",
                type: FieldType.TEXT,
                required: false,
                sortOrder: 0,
              },
              {
                key: "author_role",
                label: "作者角色",
                type: FieldType.TEXT,
                required: false,
                sortOrder: 1,
              },
            ],
          },
        })}
        availableTables={availableTables}
        onSubmit={onSubmitMock}
      />
    );

    fireEvent.click(screen.getAllByRole("button", { name: "下移" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        relationSchema: {
          version: 1,
          fields: [
            expect.objectContaining({
              key: "author_role",
              sortOrder: 0,
            }),
            expect.objectContaining({
              key: "author_name",
              sortOrder: 1,
            }),
          ],
        },
      })
    );
  });

  it("切换到货币字段时会正确回填并提交小数位配置", () => {
    const currencyField: DataFieldItem = {
      id: "currency-field-id",
      key: "budget",
      label: "预算",
      type: FieldType.CURRENCY,
      required: false,
      options: { currencyCode: "USD", currencyDecimals: 0 },
      sortOrder: 0,
    };

    const { rerender } = render(
      <FieldConfigForm
        open
        onOpenChange={onOpenChangeMock}
        field={null}
        availableTables={availableTables}
        onSubmit={onSubmitMock}
      />
    );

    rerender(
      <FieldConfigForm
        open
        onOpenChange={onOpenChangeMock}
        field={currencyField}
        availableTables={availableTables}
        onSubmit={onSubmitMock}
      />
    );

    const decimalsInput = screen.getByLabelText("小数位数") as HTMLInputElement;
    expect(decimalsInput.value).toBe("0");

    fireEvent.change(decimalsInput, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: FieldType.CURRENCY,
        options: { currencyCode: "USD", currencyDecimals: 3 },
      })
    );
  });
});
