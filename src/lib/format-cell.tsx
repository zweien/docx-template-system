import { Badge } from "@/components/ui/badge";
import { FieldType } from "@/generated/prisma/enums";
import type { ReactNode } from "react";
import type { DataFieldItem, RelationSubtableValueItem, SelectOption } from "@/types/data-table";
import { parseSelectOptions, SELECT_COLORS } from "@/types/data-table";
import { FileIcon } from "lucide-react";

type ColorPair = { bg: string; fg: string };

/** Build a color lookup map from field.options */
function buildColorMap(field: DataFieldItem): Map<string, ColorPair> {
  const options = parseSelectOptions(field.options);
  const map = new Map<string, ColorPair>();
  for (const opt of options) {
    map.set(opt.label, { bg: opt.color, fg: findFg(opt.color) });
  }
  return map;
}

/** Find matching foreground color for a given background hex */
function findFg(bgHex: string): string {
  const preset = SELECT_COLORS.find((c) => c.bg === bgHex);
  return preset?.fg ?? "#374151";
}

/** Get color pair for a select value, with hash-based fallback */
function getSelectColor(value: string, colorMap: Map<string, ColorPair>): ColorPair {
  if (colorMap.has(value)) return colorMap.get(value)!;
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  const preset = SELECT_COLORS[Math.abs(hash) % SELECT_COLORS.length];
  return { bg: preset.bg, fg: preset.fg };
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
      const { bg, fg } = getSelectColor(String(value), colorMap);
      return (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium max-w-full truncate"
          style={{ backgroundColor: bg, color: fg }}
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
              const { bg, fg } = getSelectColor(String(item), colorMap);
              return (
                <span
                  key={index}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: bg, color: fg }}
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
      if (Array.isArray(value)) {
        const items = value.filter(
          (v): v is Record<string, unknown> => v != null && typeof v === "object"
        );
        if (items.length === 0) return <span className="text-zinc-400">-</span>;
        const visibleItems = items.slice(0, 3);
        const hiddenCount = items.length - visibleItems.length;
        return (
          <div className="flex flex-wrap gap-1">
            {visibleItems.map((item, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {String(item.display ?? item.displayValue ?? item.id ?? "-")}
              </Badge>
            ))}
            {hiddenCount > 0 && (
              <Badge variant="secondary" className="text-xs">+{hiddenCount}</Badge>
            )}
          </div>
        );
      }
      const obj = value as Record<string, unknown> | null;
      const displayValue =
        obj?.display ?? obj?.displayValue ?? value;
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
    case FieldType.COUNT:
      if (value === null || value === undefined) return <span className="text-zinc-400">0</span>;
      return <span className="text-muted-foreground">{Number(value).toLocaleString()}</span>;
    case FieldType.LOOKUP:
      if (value === null || value === undefined) return <span className="text-zinc-400">-</span>;
      if (Array.isArray(value)) {
        return <span className="text-muted-foreground">{value.join(", ")}</span>;
      }
      return <span className="text-muted-foreground">{String(value)}</span>;
    case FieldType.ROLLUP:
      if (value === null || value === undefined) return <span className="text-zinc-400">-</span>;
      if (typeof value === "number") return <span className="text-muted-foreground">{value.toLocaleString()}</span>;
      if (Array.isArray(value)) return <span className="text-muted-foreground">{value.join(", ")}</span>;
      return <span className="text-muted-foreground">{String(value)}</span>;
    case FieldType.RICH_TEXT:
      if (value === null || value === undefined) return <span className="text-zinc-400">-</span>;
      return <span className="text-muted-foreground">{extractRichTextPlainText(value)}</span>;
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
    case FieldType.RELATION: {
      const obj = value as Record<string, unknown> | null;
      return String(obj?.display ?? obj?.displayValue ?? value);
    }
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
    default:
      return String(value);
  }
}

function extractRichTextPlainText(value: unknown): string {
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
    .map((n) => richTextNodeToText(n))
    .join("");
}
