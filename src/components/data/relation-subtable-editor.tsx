"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { FieldType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DataFieldItem,
  RelationSchemaField,
  RelationSubtableValueItem,
} from "@/types/data-table";
import { RelationTargetPicker } from "./relation-target-picker";

interface RelationSubtableEditorProps {
  field: DataFieldItem;
  value: RelationSubtableValueItem[];
  onChange: (next: RelationSubtableValueItem[]) => void;
}

function sortRowsBySortOrder(
  value: RelationSubtableValueItem[]
): RelationSubtableValueItem[] {
  return [...value]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => ({
      targetRecordId: item.targetRecordId,
      displayValue: item.displayValue,
      attributes: { ...(item.attributes ?? {}) },
      sortOrder: item.sortOrder,
    }));
}

function normalizeRowsByCurrentOrder(
  value: RelationSubtableValueItem[]
): RelationSubtableValueItem[] {
  return value
    .map((item, index) => ({
      targetRecordId: item.targetRecordId,
      displayValue: item.displayValue,
      attributes: { ...(item.attributes ?? {}) },
      sortOrder: index,
    }));
}

function toInputValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

function parseAttributeValue(
  schemaField: RelationSchemaField,
  rawValue: string
): unknown {
  if (rawValue === "") {
    return schemaField.type === FieldType.MULTISELECT ? [] : null;
  }

  if (schemaField.type === FieldType.NUMBER) {
    return Number(rawValue);
  }

  if (schemaField.type === FieldType.MULTISELECT) {
    return rawValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return rawValue;
}

export function RelationSubtableEditor({
  field,
  value,
  onChange,
}: RelationSubtableEditorProps) {
  const rows = normalizeRowsByCurrentOrder(sortRowsBySortOrder(value));
  const schemaFields = [...(field.relationSchema?.fields ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder
  );
  const isSingle = field.relationCardinality === "SINGLE";
  const canAddRow = !isSingle || rows.length === 0;

  const emitRows = (nextRows: RelationSubtableValueItem[]) => {
    onChange(
      normalizeRowsByCurrentOrder(
        isSingle ? nextRows.slice(0, 1) : nextRows
      )
    );
  };

  const handleAddRow = () => {
    if (!canAddRow) {
      return;
    }

    const nextAttributes = Object.fromEntries(
      schemaFields.map((schemaField) => [
        schemaField.key,
        schemaField.type === FieldType.MULTISELECT ? [] : null,
      ])
    );

    emitRows([
      ...rows,
      {
        targetRecordId: "",
        displayValue: undefined,
        attributes: nextAttributes,
        sortOrder: rows.length,
      },
    ]);
  };

  const handleRemoveRow = (rowIndex: number) => {
    emitRows(rows.filter((_, index) => index !== rowIndex));
  };

  const handleMoveRow = (rowIndex: number, direction: -1 | 1) => {
    const targetIndex = rowIndex + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) {
      return;
    }

    const nextRows = [...rows];
    const [movingRow] = nextRows.splice(rowIndex, 1);
    nextRows.splice(targetIndex, 0, movingRow);
    emitRows(nextRows);
  };

  const handleTargetChange = (
    rowIndex: number,
    nextTarget: { id: string; label: string } | null
  ) => {
    emitRows(
      rows.map((item, index) =>
        index === rowIndex
          ? {
              ...item,
              targetRecordId: nextTarget?.id ?? "",
              displayValue: nextTarget?.label,
            }
          : item
      )
    );
  };

  const handleAttributeChange = (
    rowIndex: number,
    schemaField: RelationSchemaField,
    rawValue: string
  ) => {
    emitRows(
      rows.map((item, index) =>
        index === rowIndex
          ? {
              ...item,
              attributes: {
                ...item.attributes,
                [schemaField.key]: parseAttributeValue(schemaField, rawValue),
              },
            }
          : item
      )
    );
  };

  const renderAttributeInput = (
    rowIndex: number,
    schemaField: RelationSchemaField,
    item: RelationSubtableValueItem
  ) => {
    const inputId = `${field.key}-${rowIndex}-${schemaField.key}`;
    const currentValue = item.attributes?.[schemaField.key];

    if (schemaField.type === FieldType.SELECT) {
      return (
        <div key={schemaField.key} className="grid gap-1">
          <Label htmlFor={inputId} className="text-xs text-zinc-500">
            {schemaField.label}
          </Label>
          <Select
            value={toInputValue(currentValue)}
            onValueChange={(nextValue) =>
              handleAttributeChange(
                rowIndex,
                schemaField,
                nextValue ?? ""
              )
            }
          >
            <SelectTrigger id={inputId} className="w-full">
              <SelectValue placeholder={`选择${schemaField.label}`} />
            </SelectTrigger>
            <SelectContent>
              {(schemaField.options ?? []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div key={schemaField.key} className="grid gap-1">
        <Label htmlFor={inputId} className="text-xs text-zinc-500">
          {schemaField.label}
        </Label>
        <Input
          id={inputId}
          type={
            schemaField.type === FieldType.NUMBER
              ? "number"
              : schemaField.type === FieldType.DATE
                ? "date"
                : schemaField.type === FieldType.EMAIL
                  ? "email"
                  : schemaField.type === FieldType.PHONE
                    ? "tel"
                    : "text"
          }
          step={schemaField.type === FieldType.NUMBER ? "any" : undefined}
          value={toInputValue(currentValue)}
          onChange={(event) =>
            handleAttributeChange(
              rowIndex,
              schemaField,
              event.target.value
            )
          }
          placeholder={
            schemaField.type === FieldType.FILE
              ? "文件路径"
              : schemaField.type === FieldType.MULTISELECT
                ? "多个值用逗号分隔"
                : `输入${schemaField.label}`
          }
        />
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{field.label}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRow}
          disabled={!canAddRow}
        >
          <Plus className="h-4 w-4" />
          添加关联记录
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          暂无关联记录
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((item, rowIndex) => (
            <div
              key={`${item.targetRecordId || "new"}-${rowIndex}`}
              data-testid="relation-row"
              className="rounded-md border bg-card p-3"
            >
              <div className="grid gap-3 md:grid-cols-[minmax(180px,1.2fr)_minmax(0,2fr)_auto]">
                <div className="grid gap-1">
                  <Label
                    htmlFor={`${field.key}-${rowIndex}-target`}
                    className="text-xs text-zinc-500"
                  >
                    目标记录
                  </Label>
                  <RelationTargetPicker
                    value={
                      item.targetRecordId
                        ? {
                            id: item.targetRecordId,
                            label:
                              item.displayValue ?? item.targetRecordId,
                          }
                        : null
                    }
                    onChange={(nextTarget) =>
                      handleTargetChange(rowIndex, nextTarget)
                    }
                    relationTableId={field.relationTo ?? ""}
                    displayField={field.displayField ?? "id"}
                    triggerId={`${field.key}-${rowIndex}-target`}
                    placeholder={`选择${field.label}`}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {schemaFields.map((schemaField) =>
                    renderAttributeInput(rowIndex, schemaField, item)
                  )}
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => handleMoveRow(rowIndex, -1)}
                    disabled={rowIndex === 0}
                    aria-label="上移"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => handleMoveRow(rowIndex, 1)}
                    disabled={rowIndex === rows.length - 1}
                    aria-label="下移"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleRemoveRow(rowIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
