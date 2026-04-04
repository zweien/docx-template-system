import { Badge } from "@/components/ui/badge";
import { FieldType } from "@/generated/prisma/enums";
import type { ReactNode } from "react";
import type { DataFieldItem, RelationSubtableValueItem } from "@/types/data-table";

function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function formatDateValue(value: unknown): string {
  try {
    const date = new Date(value as string);
    return date.toLocaleDateString("zh-CN");
  } catch {
    return String(value);
  }
}

function isRelationSubtableItem(
  item: unknown
): item is RelationSubtableValueItem {
  return (
    item !== null &&
    typeof item === "object" &&
    "targetRecordId" in item
  );
}

function getRelationSubtableItems(
  value: unknown
): RelationSubtableValueItem[] {
  const items = Array.isArray(value) ? value : [value];
  return items.filter(isRelationSubtableItem).sort((left, right) => left.sortOrder - right.sortOrder);
}

export function formatCellValue(
  field: DataFieldItem,
  value: unknown
): ReactNode {
  if (isEmptyCell(value)) {
    return <span className="text-zinc-400">-</span>;
  }

  switch (field.type) {
    case FieldType.NUMBER:
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case FieldType.DATE:
      return formatDateValue(value);
    case FieldType.SELECT:
      return <Badge variant="secondary">{String(value)}</Badge>;
    case FieldType.MULTISELECT:
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {String(item)}
              </Badge>
            ))}
          </div>
        );
      }
      return String(value);
    case FieldType.EMAIL:
      return (
        <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
          {String(value)}
        </a>
      );
    case FieldType.PHONE:
      return <span className="font-mono">{String(value)}</span>;
    case FieldType.RELATION: {
      const displayValue =
        (value as Record<string, unknown>)?.display ?? value;
      return <Badge variant="outline">{String(displayValue)}</Badge>;
    }
    case FieldType.RELATION_SUBTABLE: {
      const items = getRelationSubtableItems(value);

      if (items.length === 0) {
        return <span className="text-zinc-400">-</span>;
      }

      const visibleItems = items.slice(0, 3);
      const hiddenCount = items.length - visibleItems.length;

      return (
        <div className="flex flex-wrap gap-1">
          {visibleItems.map((item) => (
            <Badge
              key={`${item.targetRecordId}-${item.sortOrder}`}
              variant="outline"
              className="text-xs"
            >
              {String(item.displayValue ?? item.targetRecordId)}
            </Badge>
          ))}
          {hiddenCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{hiddenCount}
            </Badge>
          )}
        </div>
      );
    }
    default:
      return String(value);
  }
}

export function formatCellText(field: DataFieldItem, value: unknown): string {
  if (isEmptyCell(value)) {
    return "";
  }

  switch (field.type) {
    case FieldType.DATE:
      return formatDateValue(value);
    case FieldType.RELATION:
      return String((value as Record<string, unknown>)?.display ?? value);
    default:
      return String(value);
  }
}
