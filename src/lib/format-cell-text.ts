import { FieldType } from "@/generated/prisma/enums";
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

function isRelationSubtableItem(item: unknown): item is RelationSubtableValueItem {
  return item !== null && typeof item === "object" && "targetRecordId" in item;
}

function getRelationSubtableItems(value: unknown): RelationSubtableValueItem[] {
  const items = Array.isArray(value) ? value : [value];
  return items
    .filter(isRelationSubtableItem)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function formatRelationDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return String(record.display ?? record.displayValue ?? record.id ?? "");
  }

  return String(value);
}

function formatRelationArrayValue(items: unknown[]): string {
  const displayValues = items
    .map((item) => formatRelationDisplayValue(item))
    .filter((item) => item.length > 0);

  return displayValues.join(", ");
}

export function extractRichTextPlainText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return richTextDocToText(parsed);
    } catch {
      return value.length > 100 ? value.slice(0, 100) + "..." : value;
    }
  }
  if (typeof value === "object") {
    const text = richTextDocToText(value as Record<string, unknown>);
    return text.length > 100 ? text.slice(0, 100) + "..." : text;
  }
  return String(value);
}

function richTextDocToText(doc: Record<string, unknown>): string {
  if (!doc?.content || !Array.isArray(doc.content)) return "";
  return (doc.content as Array<Record<string, unknown>>)
    .map((node) => richTextNodeToText(node))
    .join(" ")
    .trim();
}

function richTextNodeToText(node: Record<string, unknown>): string {
  if (node.type === "text") return (node.text as string) || "";
  if (!node.content || !Array.isArray(node.content)) return "";
  return (node.content as Array<Record<string, unknown>>)
    .map((childNode) => richTextNodeToText(childNode))
    .join("");
}

export function formatCellText(field: DataFieldItem, value: unknown): string {
  if (isEmptyCell(value)) {
    return "";
  }

  switch (field.type) {
    case FieldType.MULTISELECT:
      return Array.isArray(value) ? value.map((item) => String(item)).join(", ") : String(value);
    case FieldType.DATE:
      return formatDateValue(value);
    case FieldType.RELATION:
      return Array.isArray(value)
        ? formatRelationArrayValue(value)
        : formatRelationDisplayValue(value);
    case FieldType.RELATION_SUBTABLE:
      return getRelationSubtableItems(value)
        .map((item) => String(item.displayValue ?? item.targetRecordId))
        .join(", ");
    case FieldType.URL:
    case FieldType.BOOLEAN:
    case FieldType.AUTO_NUMBER:
    case FieldType.SYSTEM_TIMESTAMP:
    case FieldType.SYSTEM_USER:
    case FieldType.FORMULA:
    case FieldType.COUNT:
    case FieldType.LOOKUP:
    case FieldType.ROLLUP:
    case FieldType.RICH_TEXT:
      return extractRichTextPlainText(value);
    case FieldType.RATING:
      return `${Number(value)}/${(field.options as Record<string, unknown>)?.ratingMax ?? 5}`;
    case FieldType.CURRENCY: {
      const code = (field.options as Record<string, unknown>)?.currencyCode as string ?? "CNY";
      const decimals =
        (field.options as Record<string, unknown>)?.currencyDecimals as number ?? 2;
      const symbol = { CNY: "\u00a5", USD: "$", EUR: "\u20ac" }[code] ?? code;
      return `${symbol}${Number(value).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;
    }
    case FieldType.PERCENTAGE: {
      const decimals =
        (field.options as Record<string, unknown>)?.percentageDecimals as number ?? 0;
      return `${(Number(value) * 100).toFixed(decimals)}%`;
    }
    case FieldType.DURATION: {
      const format = (field.options as Record<string, unknown>)?.durationFormat as string ?? "hh:mm";
      const totalSeconds = Math.round(Number(value));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const pad = (num: number) => String(num).padStart(2, "0");
      if (format === "hh:mm:ss") return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      if (format === "mm:ss") return `${pad(Math.floor(totalSeconds / 60))}:${pad(seconds)}`;
      return `${pad(hours)}:${pad(minutes)}`;
    }
    default:
      return String(value);
  }
}

export { formatDateValue, isEmptyCell };
