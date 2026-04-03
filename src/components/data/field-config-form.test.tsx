import { fireEvent, render, screen } from "@testing-library/react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
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

describe("FieldConfigForm", () => {
  it("renders relation subtable config and locks structural fields for inverse fields", () => {
    render(
      <FieldConfigForm
        open
        onOpenChange={onOpenChangeMock}
        field={buildRelationField({
          key: "paper_authors_inverse",
          label: "论文作者（反向）",
          relationCardinality: "MULTIPLE",
          inverseRelationCardinality: "MULTIPLE",
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
        availableTables={[
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
        ]}
        onSubmit={onSubmitMock}
      />
    );

    expect(screen.getByText("边属性")).toBeInTheDocument();
    expect(screen.getByTestId("relation-table-select")).toBeDisabled();
    expect(screen.getByTestId("relation-cardinality-select")).toBeDisabled();
    expect(screen.getByTestId("inverse-relation-cardinality-select")).toBeDisabled();
    const previewInputs = screen.getAllByDisplayValue("paper_authors_inverse");
    expect(previewInputs.some((element) => element.id === "inverse-field-preview")).toBe(true);
  });

  it("allows editing relation schema subfields for forward relation fields", () => {
    render(
      <FieldConfigForm
        open
        onOpenChange={onOpenChangeMock}
        field={buildRelationField()}
        availableTables={[
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
        ]}
        onSubmit={onSubmitMock}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "添加边属性" }));
    fireEvent.change(screen.getByLabelText("子字段标识"), {
      target: { value: "author_name" },
    });
    fireEvent.change(screen.getByLabelText("子字段名称"), {
      target: { value: "作者姓名" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSubmitMock).toHaveBeenCalledTimes(1);
    expect(onSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: FieldType.RELATION_SUBTABLE,
        relationTo: "paper_table_id",
        relationCardinality: "SINGLE",
        inverseRelationCardinality: "MULTIPLE",
        relationSchema: {
          version: 1,
          fields: [
            expect.objectContaining({
              key: "author_name",
              label: "作者姓名",
              type: FieldType.TEXT,
              required: false,
              sortOrder: 0,
            }),
          ],
        },
      })
    );
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });
});
