import { Badge } from "@/components/ui/badge";
import { FieldType } from "@/generated/prisma/enums";
import type { ReactNode } from "react";
import type { DataFieldItem, RelationSubtableValueItem, SelectOption } from "@/types/data-table";
import { parseSelectOptions, SELECT_COLORS } from "@/types/data-table";
import { FileIcon } from "lucide-react";

/** Build a color lookup map from field.options */
function buildColorMap(field: DataFieldItem): Map<string, string> {
  const options = parseSelectOptions(field.options);
  const map = new Map<string, string>();
  for (const opt of options) {
    map.set(opt.label, opt.color);
  }
  return map;
}

/** Get color for a select value, fallback to hash-based color */
function getSelectColor(value: string, colorMap: Map<string, string>): string {
  if (colorMap.has(value)) return colorMap.get(value)!;
  // Fallback: deterministic color based on string hash
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  return SELECT_COLORS[Math.abs(hash) % SELECT_COLORS.length].hex;
}

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

function getFileName(path: string): string {
  if (!path) return "";
  return path.split("/").pop() || path;
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
    case FieldType.FILE:
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-blue-600 hover:underline max-w-[180px]"
          onClick={(e) => e.stopPropagation()}
        >
          <FileIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{getFileName(String(value))}</span>
        </a>
      );
    case FieldType.SELECT: {
      const colorMap = buildColorMap(field);
      const color = getSelectColor(String(value), colorMap);
      return (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium max-w-full truncate"
          style={{ backgroundColor: color }}
        >
          {String(value)}
        </span>
      );
    }
    case FieldType.MULTISELECT: {
      if (Array.isArray(value)) {
        const colorMap = buildColorMap(field);
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, index) => {
              const color = getSelectColor(String(item), colorMap);
              return (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: color }}
                >
                  {String(item)}
                </span>
              );
            })}
          </div>
        );
      }
      return String(value);
    }
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
    case FieldType.URL:
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline truncate block max-w-[200px]"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </a>
      );
    case FieldType.BOOLEAN:
      return value === true || value === 1 ? (
        <div className="w-4 h-4 rounded border-2 bg-green-500 border-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <div className="w-4 h-4 rounded border-2 bg-white border-zinc-300" />
      );
    case FieldType.AUTO_NUMBER:
      return <span className="text-muted-foreground font-mono">{String(value)}</span>;
    case FieldType.SYSTEM_TIMESTAMP:
      return <span className="text-muted-foreground text-xs">{formatDateValue(value)}</span>;
    case FieldType.SYSTEM_USER:
      return <span className="text-muted-foreground text-xs">{String(value)}</span>;
    case FieldType.FORMULA:
      if (value === null || value === undefined) return <span className="text-zinc-400">-</span>;
      if (typeof value === "number") return value.toLocaleString();
      return String(value);
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
    case FieldType.URL:
    case FieldType.BOOLEAN:
    case FieldType.AUTO_NUMBER:
    case FieldType.SYSTEM_TIMESTAMP:
    case FieldType.SYSTEM_USER:
    case FieldType.FORMULA:
      return String(value ?? "");
    default:
      return String(value);
  }
}
