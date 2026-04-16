"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, Expand, GripVertical, Loader2, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import { BatchActionBar } from "@/components/data/batch-action-bar";
import { BatchEditDialog } from "@/components/data/batch-edit-dialog";
import { FindReplaceBar } from "@/components/data/views/find-replace-bar";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { FieldType } from "@/generated/prisma/enums";
import type {
  AggregateType,
  ConditionalFormatRule,
  DataFieldItem,
  DataRecordItem,
  FilterCondition,
  FilterGroup,
  SortConfig,
} from "@/types/data-table";
import { parseSelectOptions } from "@/types/data-table";
import { ColumnHeader } from "@/components/data/column-header";
import { formatCellValue } from "@/lib/format-cell";
import { useInlineEdit } from "@/hooks/use-inline-edit";
import { useKeyboardNav, type ActiveCell, type CellRange } from "@/hooks/use-keyboard-nav";
import { useUndoManager } from "@/hooks/use-undo-manager";
import { cn } from "@/lib/utils";
import { useSummaryRow } from "@/hooks/use-summary-row";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import {
  TextCellEditor,
  NumberCellEditor,
  DateCellEditor,
  SelectCellEditor,
  MultiselectCellEditor,
  EmailCellEditor,
  PhoneCellEditor,
  FileCellEditor,
  RelationCellEditor,
} from "@/components/data/cell-editors";
import { UrlCellEditor } from "@/components/data/cell-editors/url-cell-editor";
import { BooleanCellEditor } from "@/components/data/cell-editors/boolean-cell-editor";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ColumnResizer } from "@/components/data/column-resizer";
import { useCellContext } from "@/hooks/use-cell-context";
import { CellContextMenu } from "@/components/data/cell-context-menu";
import { toast } from "sonner";

const DEFAULT_COL_WIDTH = 160;
const CHECKBOX_COL_WIDTH = 40;

// ─── Props ──────────────────────────────────────────────────────────────────

interface GridViewProps {
  tableId: string;
  fields: DataFieldItem[];
  records: DataRecordItem[];
  isLoading: boolean;
  isAdmin: boolean;
  filters: FilterGroup[];
  sorts: SortConfig[];
  visibleFields: string[];
  fieldOrder: string[];
  groupBy: string | null;
  onFilterChange: (filter: FilterCondition | null, fieldKey: string) => void;
  onSortChange: (sort: SortConfig | null) => void;
  onSortClear: (fieldKey: string) => void;
  onVisibleFieldsChange: (fields: string[]) => void;
  onFieldOrderChange: (order: string[]) => void;
  onGroupByChange: (fieldKey: string | null) => void;
  onDeleteRecord: (recordId: string) => Promise<void>;
  deletingIds: Set<string>;
  onRefresh: () => void;
  onUpdateRecordField: (recordId: string, fieldKey: string, value: unknown) => void;
  onAddRecord: (record: DataRecordItem) => void;
  onOpenDetail?: (recordId: string) => void;
  onOpenFieldsConfig?: () => void;
  onDeleteField?: (fieldKey: string) => void;
  columnWidths: Record<string, number>;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  frozenFieldCount?: number;
  onFrozenFieldCountChange?: (count: number) => void;
  viewId?: string | null;
  onReorderRecords?: (orderedIds: string[]) => void;
  conditionalFormatRules?: ConditionalFormatRule[];
  onQuickFormat?: (fieldKey: string, value: string) => void;
  columnAggregations?: Record<string, AggregateType>;
  onColumnAggregationsChange?: (aggregations: Record<string, AggregateType>) => void;
  rowHeight?: number;
}

// ─── Grouping helpers ───────────────────────────────────────────────────────

interface GroupedRecords {
  value: string;
  label: string;
  records: DataRecordItem[];
}

function groupRecords(
  records: DataRecordItem[],
  groupField: DataFieldItem
): GroupedRecords[] {
  const map = new Map<string, DataRecordItem[]>();

  for (const record of records) {
    const rawValue = record.data[groupField.key];
    const groupKey = rawValue == null || rawValue === "" ? "(空)" : String(rawValue);

    let list = map.get(groupKey);
    if (!list) {
      list = [];
      map.set(groupKey, list);
    }
    list.push(record);
  }

  const groups: GroupedRecords[] = [];
  for (const [value, groupRecords] of map) {
    groups.push({ value, label: value, records: groupRecords });
  }

  return groups;
}

// ─── Row height style helper ────────────────────────────────────────────────

function getRowHeightClasses(h: number) {
  switch (h) {
    case 24: return { td: "p-0.5", text: "text-xs" };
    case 32: return { td: "p-1", text: "" };
    case 56: return { td: "p-3 whitespace-normal", text: "" };
    default: return { td: "p-2", text: "" }; // 40px
  }
}

// ─── Frozen style helper ──────────────────────────────────────────────────

function getFrozenStyle(
  index: number,
  frozenFieldCount: number,
  orderedFields: DataFieldItem[],
  widths: Record<string, number>
): React.CSSProperties | undefined {
  if (frozenFieldCount <= 0 || index >= frozenFieldCount) return undefined;
  let left = CHECKBOX_COL_WIDTH;
  for (let i = 0; i < index; i++) {
    left += widths[orderedFields[i].key] ?? DEFAULT_COL_WIDTH;
  }
  return {
    position: "sticky",
    left,
    zIndex: index === frozenFieldCount - 1 ? 4 : 3,
    backgroundColor: "hsl(var(--background))",
  };
}

// ─── Draggable column header ────────────────────────────────────────────────

function DraggableColumnHeader({
  id,
  index,
  children,
  columnWidth,
  fieldKey,
  onWidthChange,
  onAutoFit,
  frozenStyle,
  frozenFieldCount,
  onContextMenu,
}: {
  id: string;
  index: number;
  children: React.ReactNode;
  columnWidth: number;
  fieldKey: string;
  onWidthChange: (fieldKey: string, width: number) => void;
  onAutoFit: (fieldKey: string) => void;
  frozenStyle?: React.CSSProperties;
  frozenFieldCount?: number;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { ref, isDragging } = useSortable({ id, index });
  return (
    <th
      ref={ref}
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 relative border-r border-neutral-400",
        isDragging ? "opacity-50 bg-muted" : "cursor-grab active:cursor-grabbing",
        frozenStyle && "bg-background",
        frozenFieldCount && frozenFieldCount > 0 && index === frozenFieldCount - 1 && "frozen-last-col"
      )}
      style={{ width: columnWidth, ...(frozenStyle ?? {}) }}
      onContextMenu={onContextMenu}
    >
      {children}
      <ColumnResizer fieldKey={fieldKey} currentWidth={columnWidth} onWidthChange={onWidthChange} onDoubleClick={onAutoFit} />
    </th>
  );
}

// ─── Draggable row wrapper (drag handle) ─────────────────────────────────────

function DragHandleRow({
  record,
  index,
  children,
  style,
}: {
  record: DataRecordItem;
  index: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { ref, isDragging } = useSortable({ id: record.id, index });
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50",
        isDragging && "opacity-50 bg-muted"
      )}
      style={style}
    >
      {children}
    </tr>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GridView({
  tableId,
  fields,
  records,
  isLoading,
  isAdmin,
  filters,
  sorts,
  visibleFields,
  fieldOrder,
  groupBy,
  onFilterChange,
  onSortChange,
  onSortClear,
  onVisibleFieldsChange,
  onFieldOrderChange,
  onDeleteRecord,
  deletingIds,
  onRefresh,
  onUpdateRecordField,
  onAddRecord,
  onOpenDetail,
  columnWidths,
  onColumnWidthsChange,
  frozenFieldCount,
  onFrozenFieldCountChange,
  viewId,
  onReorderRecords,
  conditionalFormatRules,
  onQuickFormat,
  onOpenFieldsConfig,
  onDeleteField,
  columnAggregations,
  onColumnAggregationsChange,
  rowHeight,
}: GridViewProps) {
  const frozenFieldCountValue = frozenFieldCount ?? 0;

  // ── Undo manager ─────────────────────────────────────────────────────────
  const undoManager = useUndoManager();

  // ── Summary row ──────────────────────────────────────────────────────────
  const { summaryData } = useSummaryRow({
    tableId,
    filters: filters.length > 0 ? JSON.stringify(filters) : null,
    search: "",
    aggregations: columnAggregations ?? {},
  });

  // Find the filter condition for a given field across all groups
  const findFilterForField = useCallback((fieldKey: string): FilterCondition | null => {
    for (const group of filters) {
      const found = group.conditions.find(c => c.fieldKey === fieldKey)
      if (found) return found
    }
    return null
  }, [filters])

  // ── Cell context menu ────────────────────────────────────────────────────
  const { context, captureCell, captureRowHeader, captureColHeader } = useCellContext();

  const handleInsertRow = useCallback(async (referenceRecordId: string, position: "above" | "below") => {
    try {
      const res = await fetch(`/api/data-tables/${tableId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {} }),
      });
      if (!res.ok) return;
      const newRecord = await res.json();
      if (newRecord.success !== false) {
        if (position === "below") {
          const currentIds = records.map((r) => r.id);
          const refIndex = currentIds.indexOf(referenceRecordId);
          if (refIndex >= 0 && refIndex < currentIds.length - 1) {
            const orderedIds = [
              ...currentIds.slice(0, refIndex + 1),
              newRecord.data.id,
              ...currentIds.slice(refIndex + 1),
            ];
            await fetch(`/api/data-tables/${tableId}/records/reorder`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderedIds }),
            });
          }
        }
        onRefresh();
      }
    } catch {
      toast.error("插入行失败");
    }
  }, [tableId, records, onRefresh]);

  const handleDuplicateRecord = useCallback(async (recordId: string) => {
    const record = records.find((r) => r.id === recordId);
    if (!record) return;
    try {
      const res = await fetch(`/api/data-tables/${tableId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { ...record.data } }),
      });
      if (res.ok) {
        onRefresh();
      }
    } catch {
      toast.error("复制行失败");
    }
  }, [tableId, records, onRefresh]);

  // ── Can drag-sort rows? (only when no sorts, no grouping, has viewId, and admin) ──
  const canDragSort = useMemo(
    () => sorts.length === 0 && !groupBy && !!viewId && isAdmin,
    [sorts, groupBy, viewId, isAdmin]
  );

  // ── Conditional formatting styles ──────────────────────────────────────
  const recordStyles = useMemo(() => {
    if (!conditionalFormatRules || conditionalFormatRules.length === 0) return {};
    const map: Record<string, React.CSSProperties> = {};
    for (const record of records) {
      for (const rule of conditionalFormatRules) {
        const val = record.data[rule.condition.fieldKey];
        let match = false;
        switch (rule.condition.op) {
          case "eq": match = String(val ?? "") === String(rule.condition.value); break;
          case "ne": match = String(val ?? "") !== String(rule.condition.value); break;
          case "contains": match = String(val ?? "").includes(String(rule.condition.value)); break;
          case "notcontains": match = !String(val ?? "").includes(String(rule.condition.value)); break;
          case "startswith": match = String(val ?? "").startsWith(String(rule.condition.value)); break;
          case "endswith": match = String(val ?? "").endsWith(String(rule.condition.value)); break;
          case "isempty": match = val === undefined || val === null || val === ""; break;
          case "isnotempty": match = val !== undefined && val !== null && val !== ""; break;
          case "gt": match = Number(val) > Number(rule.condition.value); break;
          case "lt": match = Number(val) < Number(rule.condition.value); break;
          case "gte": match = Number(val) >= Number(rule.condition.value); break;
          case "lte": match = Number(val) <= Number(rule.condition.value); break;
        }
        if (match) {
          const style: React.CSSProperties = {
            backgroundColor: rule.backgroundColor,
          };
          if (rule.textColor) style.color = rule.textColor;
          map[record.id] = style;
          break; // first matching rule wins
        }
      }
    }
    return map;
  }, [records, conditionalFormatRules]);

  // ── Batch selection state ────────────────────────────────────────────────
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [findBarOpen, setFindBarOpen] = useState(false);

  // ── Collapsed groups state ──────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const tableRef = useRef<HTMLTableElement>(null);

  // ── Keyboard nav: active cell state (for rendering) ──────────────────────
  const [activeCell, setActiveCellState] = useState<ActiveCell | null>(null);
  const stableActiveCell = activeCell;

  const toggleGroup = useCallback((groupValue: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupValue)) {
        next.delete(groupValue);
      } else {
        next.add(groupValue);
      }
      return next;
    });
  }, []);

  // ── Batch toggle handlers ─────────────────────────────────────────────
  const [selectedIdsSet, setSelectedIdsSet] = useState<Set<string>>(new Set());

  const toggleAll = useCallback(() => {
    if (selectedIdsSet.size === records.length) {
      setSelectedIdsSet(new Set());
    } else {
      setSelectedIdsSet(new Set(records.map((r) => r.id)));
    }
  }, [records, selectedIdsSet]);

  const toggleRow = useCallback(
    (recordId: string) => {
      setSelectedIdsSet((prev) => {
        const next = new Set(prev);
        if (next.has(recordId)) {
          next.delete(recordId);
        } else {
          next.add(recordId);
        }
        return next;
      });
    },
    []
  );

  // ── Ordered visible fields ──────────────────────────────────────────────
  const fieldMap = useMemo(
    () => new Map(fields.map((f) => [f.key, f])),
    [fields]
  );

  const orderedVisibleFields = useMemo(
    () =>
      fieldOrder
        .filter((key) => visibleFields.includes(key))
        .map((key) => fieldMap.get(key))
        .filter((f): f is DataFieldItem => f !== undefined),
    [fieldOrder, visibleFields, fieldMap]
  );

  // ── Column width handlers ──────────────────────────────────────────────
  const handleWidthChange = useCallback(
    (fieldKey: string, newWidth: number) => {
      onColumnWidthsChange({ ...columnWidths, [fieldKey]: newWidth });
    },
    [columnWidths, onColumnWidthsChange]
  );

  const handleAutoFit = useCallback(
    (fieldKey: string) => {
      const table = tableRef.current;
      if (!table) return;
      const colIndex = orderedVisibleFields.findIndex((f) => f.key === fieldKey);
      if (colIndex === -1) return;
      // +1 for checkbox column offset
      const domColIndex = colIndex + 1;
      let maxContentWidth = 80;
      const rows = table.querySelectorAll("tbody tr");
      rows.forEach((row) => {
        const cell = row.children[domColIndex] as HTMLElement | undefined;
        if (cell) maxContentWidth = Math.max(maxContentWidth, cell.scrollWidth);
      });
      const headerCell = table.querySelector(`thead th:nth-child(${domColIndex + 1})`) as HTMLElement | undefined;
      if (headerCell) maxContentWidth = Math.max(maxContentWidth, headerCell.scrollWidth);
      handleWidthChange(fieldKey, Math.min(600, maxContentWidth));
    },
    [orderedVisibleFields, handleWidthChange]
  );

  // ── Batch delete handler ──────────────────────────────────────────────
  const handleBatchDelete = useCallback(async () => {
    if (!confirm(`确定删除 ${selectedIdsSet.size} 条记录？`)) return;
    const ids = [...selectedIdsSet];
    setSelectedIdsSet(new Set());
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/data-tables/${tableId}/records/${id}`, {
          method: "DELETE",
        })
      )
    );
    const failedCount = results.filter((r) => r.status === "rejected").length;
    if (failedCount > 0) {
      alert(`${failedCount} 条记录删除失败，请重试`);
    }
    onRefresh();
  }, [selectedIdsSet, tableId, onRefresh]);

  // ── Batch edit handler ────────────────────────────────────────────────
  const handleBatchEdit = useCallback(
    async (fieldKey: string, value: unknown) => {
      const ids = [...selectedIdsSet];
      setSelectedIdsSet(new Set());
      const BATCH_SIZE = 10;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((id) =>
            fetch(`/api/data-tables/${tableId}/records/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fieldKey, value }),
            })
          )
        );
      }
      onRefresh();
    },
    [selectedIdsSet, tableId, onRefresh]
  );

  // ── Column drag end handler ──────────────────────────────────────
  const handleColumnDragEnd = useCallback(
    (event: { operation: { source: { id: string | number } | null; target: { id: string | number } | null }; canceled: boolean }) => {
      if (event.canceled) return;
      const sourceId = event.operation.source?.id;
      const targetId = event.operation.target?.id;
      if (!sourceId || !targetId || sourceId === targetId) return;

      const orderedKeys = orderedVisibleFields.map((f) => f.key);
      const oldIndex = orderedKeys.indexOf(String(sourceId));
      const newIndex = orderedKeys.indexOf(String(targetId));
      if (oldIndex === -1 || newIndex === -1) return;

      // Freeze zone protection: prevent dragging between frozen and non-frozen zones
      const frozenCount = frozenFieldCountValue;
      const sourceInFrozen = oldIndex < frozenCount;
      const targetInFrozen = newIndex < frozenCount;
      if (sourceInFrozen !== targetInFrozen) return;

      const newOrder = [...orderedKeys];
      const [moved] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, moved);
      onFieldOrderChange(newOrder);
    },
    [orderedVisibleFields, onFieldOrderChange, frozenFieldCountValue]
  );

  // ── Row drag end handler ──────────────────────────────────────────────
  const handleRowDragEnd = useCallback(
    (event: { operation: { source: { id: string | number } | null; target: { id: string | number } | null }; canceled: boolean }) => {
      if (event.canceled) return;
      const sourceId = event.operation.source?.id;
      const targetId = event.operation.target?.id;
      if (!sourceId || !targetId || sourceId === targetId) return;

      const orderedIds = records.map((r) => r.id);
      const oldIndex = orderedIds.indexOf(String(sourceId));
      const newIndex = orderedIds.indexOf(String(targetId));
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...orderedIds];
      const [moved] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, moved);

      onReorderRecords?.(newOrder);
    },
    [records, onReorderRecords]
  );

  // ── Grouping ─────────────────────────────────────────────────────────────
  const groupField = useMemo(
    () => (groupBy ? fieldMap.get(groupBy) ?? null : null),
    [groupBy, fieldMap]
  );

  const groupedRecords = useMemo(() => {
    if (!groupField || records.length === 0) return null;
    return groupRecords(records, groupField);
  }, [groupField, records]);

  // ── Virtual scrolling ────────────────────────────────────────────────────
  const flatRecords = useMemo(() => {
    if (groupedRecords) {
      const flat: Array<{
        type: "group" | "record";
        record?: DataRecordItem;
        group?: { value: string; label: string; records: DataRecordItem[] };
      }> = [];
      for (const group of groupedRecords) {
        flat.push({ type: "group", group });
        if (!collapsedGroups.has(group.value)) {
          for (const r of group.records)
            flat.push({ type: "record", record: r });
        }
      }
      return flat;
    }
    return records.map((r) => ({ type: "record" as const, record: r }));
  }, [groupedRecords, collapsedGroups, records]);

  const { startIndex, endIndex, topPadding, bottomPadding, scrollRef } =
    useVirtualRows(flatRecords.length, undefined, rowHeight);
  const visibleFlatRecords = flatRecords.slice(startIndex, endIndex);

  // ── Group row indices (for skipping in keyboard nav) ─────────────────────
  const groupRowIndices = useMemo(() => {
    if (!groupedRecords) return new Set<number>();
    const indices = new Set<number>();
    let flatIndex = 0;
    for (const group of groupedRecords) {
      indices.add(flatIndex); // group header row
      flatIndex +=
        1 + (collapsedGroups.has(group.value) ? 0 : group.records.length);
    }
    return indices;
  }, [groupedRecords, collapsedGroups]);

  // ── Inline editing ─────────────────────────────────────────────────────
  const handleCommit = useCallback(
    async (recordId: string, fieldKey: string, value: unknown) => {
      const response = await fetch(
        `/api/data-tables/${tableId}/records/${recordId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fieldKey, value }),
        }
      );
      if (!response.ok) {
        throw new Error("保存失败");
      }
      onUpdateRecordField(recordId, fieldKey, value);
    },
    [tableId, onUpdateRecordField]
  );

  const handleCommitWithUndo = useCallback(
    async (recordId: string, fieldKey: string, value: unknown) => {
      const record = records.find((r) => r.id === recordId);
      const oldValue = record?.data[fieldKey] ?? null;
      const field = orderedVisibleFields.find((f) => f.key === fieldKey);
      const label = field?.label ?? fieldKey;

      await undoManager.execute({
        type: "UPDATE_CELL",
        description: `编辑了${label}`,
        execute: () => handleCommit(recordId, fieldKey, value),
        undo: () => handleCommit(recordId, fieldKey, oldValue),
      });
    },
    [handleCommit, records, orderedVisibleFields, undoManager]
  );

  const { editingCell, startEditing, commitEdit, cancelEdit } =
    useInlineEdit({ tableId, onCommit: handleCommitWithUndo });

  // ── Fill handle (drag-fill) ──────────────────────────────────────────────
  const [fillRange, setFillRange] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null);
  const [fillMode, setFillMode] = useState<"increment" | "copy">("increment");
  const [fillComplete, setFillComplete] = useState<{
    range: { startRow: number; startCol: number; endRow: number; endCol: number };
    originalValue: unknown;
    fieldKey: string;
    fieldType: string;
    updates: Array<{ recordId: string; fieldKey: string; oldValue: unknown }>;
    anchorRect: { x: number; y: number };
  } | null>(null);

  const READONLY_FIELD_TYPES: readonly string[] = [
    FieldType.AUTO_NUMBER, FieldType.SYSTEM_TIMESTAMP, FieldType.SYSTEM_USER,
    FieldType.FORMULA, FieldType.RELATION_SUBTABLE, FieldType.COUNT,
  ];

  const computeFillValue = useCallback((fieldType: string, originalValue: unknown, step: number, mode: "increment" | "copy"): unknown => {
    if (mode === "copy") return originalValue;
    if (fieldType === FieldType.NUMBER) {
      const num = Number(originalValue);
      return isNaN(num) ? originalValue : num + step;
    }
    if (fieldType === FieldType.DATE) {
      try {
        const d = new Date(originalValue as string);
        if (isNaN(d.getTime())) return originalValue;
        d.setDate(d.getDate() + step);
        return d.toISOString().slice(0, 10);
      } catch {
        return originalValue;
      }
    }
    return originalValue;
  }, []);

  const applyFill = useCallback(
    async (
      range: { startRow: number; startCol: number; endRow: number; endCol: number },
      originalValue: unknown,
      fieldType: string,
      mode: "increment" | "copy",
    ) => {
      const { startRow: sr, startCol: sc, endRow: er, endCol: ec } = range;
      const updates: Array<{ recordId: string; fieldKey: string; value: unknown; oldValue: unknown }> = [];
      const fields = orderedVisibleFields;

      for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) {
          if (r === sr && c === sc) continue;
          const entry = flatRecords[r];
          if (entry?.type !== "record" || !entry.record) continue;
          const f = fields[c];
          if (!f || READONLY_FIELD_TYPES.includes(f.type)) continue;
          const step = r - sr + (c - sc);
          updates.push({
            recordId: entry.record.id,
            fieldKey: f.key,
            value: computeFillValue(f.type, originalValue, step, mode),
            oldValue: entry.record.data[f.key],
          });
        }
      }

      if (updates.length > 0) {
        await undoManager.execute({
          type: "FILL_CELLS",
          description: `填充了${updates.length}个单元格（${mode === "copy" ? "复制" : "递增"}）`,
          execute: async () => { await Promise.all(updates.map((u) => handleCommit(u.recordId, u.fieldKey, u.value))); },
          undo: async () => { await Promise.all(updates.map((u) => handleCommit(u.recordId, u.fieldKey, u.oldValue))); },
        });
      }
      return updates;
    },
    [flatRecords, orderedVisibleFields, computeFillValue, handleCommit, undoManager]
  );

  const handleFillStart = useCallback(
    (e: React.MouseEvent, record: DataRecordItem, field: DataFieldItem) => {
      e.preventDefault();
      e.stopPropagation();

      const startRow = stableActiveCell?.rowIndex ?? 0;
      const startCol = stableActiveCell?.colIndex ?? 0;
      const originalValue = record.data[field.key];
      const isCopyMode = e.ctrlKey || e.metaKey;
      const currentMode = isCopyMode ? "copy" : "increment";

      document.body.style.cursor = "crosshair";
      document.body.style.userSelect = "none";
      setFillComplete(null);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const td = el?.closest("td[data-row][data-col]") as HTMLElement | null;
        if (!td) return;
        const targetRow = parseInt(td.getAttribute("data-row")!, 10);
        const targetCol = parseInt(td.getAttribute("data-col")!, 10);
        if (targetRow >= startRow && targetCol >= startCol) {
          setFillRange({ startRow, startCol, endRow: targetRow, endCol: targetCol });
        }
      };

      const handleMouseUp = async (upEvent: MouseEvent) => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        setFillRange((currentRange) => {
          if (!currentRange) return null;

          const { startRow: sr, startCol: sc, endRow: er, endCol: ec } = currentRange;
          if (sr === er && sc === ec) return null;

          const updatesSnapshot: Array<{ recordId: string; fieldKey: string; oldValue: unknown }> = [];
          const fields = orderedVisibleFields;

          for (let r = sr; r <= er; r++) {
            for (let c = sc; c <= ec; c++) {
              if (r === sr && c === sc) continue;
              const entry = flatRecords[r];
              if (entry?.type !== "record" || !entry.record) continue;
              const f = fields[c];
              if (!f || READONLY_FIELD_TYPES.includes(f.type)) continue;
              updatesSnapshot.push({
                recordId: entry.record.id,
                fieldKey: f.key,
                oldValue: entry.record.data[f.key],
              });
            }
          }

          if (updatesSnapshot.length > 0) {
            setFillMode(currentMode);
            void applyFill(currentRange, originalValue, field.type, currentMode).then(() => {
              const anchorCell = document.querySelector(`td[data-row="${er}"][data-col="${ec}"]`);
              const rect = anchorCell?.getBoundingClientRect();
              if (rect) {
                setFillComplete({
                  range: currentRange,
                  originalValue,
                  fieldKey: field.key,
                  fieldType: field.type,
                  updates: updatesSnapshot,
                  anchorRect: { x: rect.right, y: rect.bottom },
                });
              }
            });
          }

          return null;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [stableActiveCell, flatRecords, orderedVisibleFields, computeFillValue, handleCommit, undoManager, applyFill]
  );

  // Toggle fill mode after completion
  const handleFillModeToggle = useCallback(async () => {
    if (!fillComplete) return;
    const newMode = fillMode === "copy" ? "increment" : "copy";
    setFillMode(newMode);
    // Undo previous fill, then apply with new mode
    await undoManager.undo();
    void applyFill(fillComplete.range, fillComplete.originalValue, fillComplete.fieldType, newMode);
  }, [fillComplete, fillMode, undoManager, applyFill]);

  // Dismiss fill complete popup on click outside
  useEffect(() => {
    if (!fillComplete) return;
    const handleClick = () => setFillComplete(null);
    const handleKeyDown = () => setFillComplete(null);
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [fillComplete]);

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const [selectionRange, setSelectionRangeState] = useState<CellRange | null>(null);
  const { handleKeyDown, setActiveCell: setActiveCellRef, setSelectionRange: setSelectionRangeRef } = useKeyboardNav({
    rowCount: flatRecords.length,
    colCount: orderedVisibleFields.length,
    editingCell,
    onMoveTo: (cell) => setActiveCellState(cell),
    onStartEdit: () => {
      if (!activeCell) return;
      const entry = flatRecords[activeCell.rowIndex];
      if (entry?.type !== "record" || !entry.record) return;
      const field = orderedVisibleFields[activeCell.colIndex];
      if (!field || field.type === FieldType.RELATION_SUBTABLE) return;
      if (field.type === FieldType.BOOLEAN) {
        const currentValue = entry.record.data[field.key];
        const newValue = !(!!currentValue && currentValue !== "false" && currentValue !== 0);
        void handleCommitWithUndo(entry.record.id, field.key, newValue);
      } else {
        startEditing(entry.record.id, field.key);
      }
    },
    onCancelEdit: () => cancelEdit(),
    onClearCell: () => {
      if (!activeCell) return;
      const entry = flatRecords[activeCell.rowIndex];
      if (entry?.type !== "record" || !entry.record) return;
      const field = orderedVisibleFields[activeCell.colIndex];
      if (field && field.type !== FieldType.RELATION_SUBTABLE) {
        handleCommit(entry.record.id, field.key, null);
      }
    },
    onCopyCell: () => {
      if (!activeCell) return null;
      const entry = flatRecords[activeCell.rowIndex];
      if (entry?.type !== "record" || !entry.record) return null;
      const field = orderedVisibleFields[activeCell.colIndex];
      return field ? String(entry.record.data[field.key] ?? "") : null;
    },
    onPasteCell: (text: string) => {
      if (!activeCell) return;
      const entry = flatRecords[activeCell.rowIndex];
      if (entry?.type !== "record" || !entry.record) return;
      const field = orderedVisibleFields[activeCell.colIndex];
      if (!field) return;
      // Validate paste
      if (field.type === FieldType.NUMBER && isNaN(Number(text))) return;
      if (
        field.type === FieldType.SELECT &&
        Array.isArray(field.options) &&
        !field.options.includes(text)
      )
        return;
      handleCommit(
        entry.record.id,
        field.key,
        field.type === FieldType.NUMBER ? Number(text) : text
      );
    },
    onCopyRange: (range: CellRange) => {
      const minRow = Math.min(range.startRow, range.endRow);
      const maxRow = Math.max(range.startRow, range.endRow);
      const minCol = Math.min(range.startCol, range.endCol);
      const maxCol = Math.max(range.startCol, range.endCol);
      const lines: string[] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const entry = flatRecords[r];
        if (entry?.type !== "record" || !entry.record) { lines.push(""); continue; }
        const cells: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          const field = orderedVisibleFields[c];
          cells.push(field ? String(entry.record.data[field.key] ?? "") : "");
        }
        lines.push(cells.join("\t"));
      }
      navigator.clipboard.writeText(lines.join("\n"));
    },
    onPasteRange: (text: string, startRow: number, startCol: number) => {
      const rows = text.split(/\r?\n/).filter(line => line.length > 0);
      const parsed = rows.map(row => row.split("\t"));
      for (let dr = 0; dr < parsed.length; dr++) {
        const targetRow = startRow + dr;
        const entry = flatRecords[targetRow];
        if (!entry || entry.type !== "record" || !entry.record) continue;
        for (let dc = 0; dc < parsed[dr].length; dc++) {
          const targetCol = startCol + dc;
          const field = orderedVisibleFields[targetCol];
          if (!field) continue;
          if (field.type === FieldType.RELATION_SUBTABLE || field.type === FieldType.AUTO_NUMBER || field.type === FieldType.SYSTEM_TIMESTAMP || field.type === FieldType.SYSTEM_USER || field.type === FieldType.FORMULA) continue;
          const rawValue = parsed[dr][dc];
          const value = field.type === FieldType.NUMBER ? Number(rawValue) : rawValue;
          if (field.type === FieldType.NUMBER && isNaN(value as number)) continue;
          handleCommit(entry.record.id, field.key, value);
        }
      }
    },
    onSelectionChange: (range: CellRange | null) => {
      setSelectionRangeState(range);
    },
    isGroupRow: (rowIndex: number) =>
      groupRowIndices.has(rowIndex),
    onUndo: () => void undoManager.undo(),
    onRedo: () => void undoManager.redo(),
    onEditNavigate: (direction) => {
      // Navigate synchronously — the cell editor's onCommit is already in flight
      if (!stableActiveCell) return;
      const { rowIndex, colIndex } = stableActiveCell;
      const maxRow = flatRecords.length - 1;
      const maxCol = orderedVisibleFields.length - 1;
      let nextRow = rowIndex;
      let nextCol = colIndex;

      if (direction === "right") {
        if (colIndex < maxCol) {
          nextCol = colIndex + 1;
        } else {
          let r = rowIndex + 1;
          while (r <= maxRow && groupRowIndices.has(r)) r++;
          if (r <= maxRow) { nextRow = r; nextCol = 0; }
        }
      } else if (direction === "left") {
        if (colIndex > 0) {
          nextCol = colIndex - 1;
        } else {
          let r = rowIndex - 1;
          while (r >= 0 && groupRowIndices.has(r)) r--;
          if (r >= 0) { nextRow = r; nextCol = maxCol; }
        }
      } else if (direction === "down") {
        let r = rowIndex + 1;
        while (r <= maxRow && groupRowIndices.has(r)) r++;
        if (r <= maxRow) nextRow = r;
      }

      if (nextRow !== rowIndex || nextCol !== colIndex) {
        setActiveCell({ rowIndex: nextRow, colIndex: nextCol });
        const entry = flatRecords[nextRow];
        if (entry?.type === "record" && entry.record) {
          const field = orderedVisibleFields[nextCol];
          if (field && field.type !== FieldType.RELATION_SUBTABLE
            && field.type !== FieldType.AUTO_NUMBER
            && field.type !== FieldType.SYSTEM_TIMESTAMP
            && field.type !== FieldType.SYSTEM_USER
            && field.type !== FieldType.FORMULA
            && field.type !== FieldType.BOOLEAN) {
            startEditing(entry.record.id, field.key);
          }
        }
      }
    },
    onExpandRecord: () => {
      if (!stableActiveCell) return;
      const entry = flatRecords[stableActiveCell.rowIndex];
      if (entry?.type === "record" && entry.record && onOpenDetail) {
        onOpenDetail(entry.record.id);
      }
    },
    onInsertNowDate: () => {
      if (!stableActiveCell) return;
      const entry = flatRecords[stableActiveCell.rowIndex];
      if (entry?.type !== "record" || !entry.record) return;
      const field = orderedVisibleFields[stableActiveCell.colIndex];
      if (!field) return;
      if (field.type === FieldType.DATE || field.type === FieldType.TEXT) {
        const now = new Date().toISOString().slice(0, 10);
        void handleCommitWithUndo(entry.record.id, field.key, now);
      }
    },
    onInsertRowBelow: () => {
      if (!isAdmin || !stableActiveCell) return;
      void handleInsertRowBelow(stableActiveCell.rowIndex);
    },
    onCutCell: () => {
      if (!stableActiveCell) return null;
      const entry = flatRecords[stableActiveCell.rowIndex];
      if (entry?.type !== "record" || !entry.record) return null;
      const field = orderedVisibleFields[stableActiveCell.colIndex];
      if (!field) return null;
      const value = entry.record.data[field.key];
      // Clear the cell after copying
      handleCommit(entry.record.id, field.key, null);
      return String(value ?? "");
    },
    onDuplicateRow: () => {
      if (!isAdmin || !stableActiveCell) return;
      const entry = flatRecords[stableActiveCell.rowIndex];
      if (entry?.type !== "record" || !entry.record) return;
      void handleDuplicateRow(entry.record);
    },
    onFindBar: () => setFindBarOpen(true),
  });

  // Wrapper that syncs both ref and state
  const setActiveCell = useCallback(
    (cell: ActiveCell | null) => {
      setActiveCellRef(cell);
      setActiveCellState(cell);
    },
    [setActiveCellRef]
  );

  // ── Quick add row ────────────────────────────────────────────────────────
  const handleQuickAddRow = useCallback(async () => {
    try {
      const res = await fetch(`/api/data-tables/${tableId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {}, skipRequiredValidation: true }),
      });
      if (!res.ok) {
        toast.error("新建行失败");
        return;
      }
      const record = (await res.json()) as DataRecordItem;
      onAddRecord(record);
      // Move activeCell to new row, start editing first editable field
      const newRowIndex = flatRecords.length;
      const firstEditableField = orderedVisibleFields.find(
        (f) => f.type !== FieldType.RELATION_SUBTABLE
          && f.type !== FieldType.AUTO_NUMBER
          && f.type !== FieldType.SYSTEM_TIMESTAMP
          && f.type !== FieldType.SYSTEM_USER
          && f.type !== FieldType.FORMULA
          && f.type !== FieldType.BOOLEAN
      );
      if (firstEditableField) {
        const colIndex = orderedVisibleFields.indexOf(firstEditableField);
        setTimeout(() => {
          setActiveCell({ rowIndex: newRowIndex, colIndex });
          startEditing(record.id, firstEditableField.key);
        }, 0);
      }
    } catch {
      toast.error("新建行失败");
    }
  }, [tableId, onAddRecord, flatRecords.length, orderedVisibleFields, setActiveCell, startEditing]);

  // Insert a new row below the given row index and start editing
  const handleInsertRowBelow = useCallback(async (currentRowIndex: number) => {
    try {
      const res = await fetch(`/api/data-tables/${tableId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {}, skipRequiredValidation: true }),
      });
      if (!res.ok) {
        toast.error("插入行失败");
        return;
      }
      const record = (await res.json()) as DataRecordItem;
      onAddRecord(record);
      // New record is appended to the end; move active cell to it
      const newRowIndex = flatRecords.length;
      const firstEditableField = orderedVisibleFields.find(
        (f) => f.type !== FieldType.RELATION_SUBTABLE
          && f.type !== FieldType.AUTO_NUMBER
          && f.type !== FieldType.SYSTEM_TIMESTAMP
          && f.type !== FieldType.SYSTEM_USER
          && f.type !== FieldType.FORMULA
          && f.type !== FieldType.BOOLEAN
      );
      if (firstEditableField) {
        const colIndex = orderedVisibleFields.indexOf(firstEditableField);
        setTimeout(() => {
          setActiveCell({ rowIndex: newRowIndex, colIndex });
          startEditing(record.id, firstEditableField.key);
        }, 0);
      }
    } catch {
      toast.error("插入行失败");
    }
  }, [tableId, onAddRecord, flatRecords.length, orderedVisibleFields, setActiveCell, startEditing]);

  // Duplicate a row: copy all editable fields into a new row below
  const handleDuplicateRow = useCallback(async (sourceRecord: DataRecordItem) => {
    const readOnlyTypes: Set<FieldType> = new Set([
      FieldType.RELATION_SUBTABLE, FieldType.AUTO_NUMBER,
      FieldType.SYSTEM_TIMESTAMP, FieldType.SYSTEM_USER, FieldType.FORMULA,
    ]);
    const data: Record<string, unknown> = {};
    for (const field of orderedVisibleFields) {
      if (readOnlyTypes.has(field.type)) continue;
      data[field.key] = sourceRecord.data[field.key];
    }
    try {
      const res = await fetch(`/api/data-tables/${tableId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        toast.error("复制行失败");
        return;
      }
      const record = (await res.json()) as DataRecordItem;
      onAddRecord(record);
      const newRowIndex = flatRecords.length;
      const firstEditableField = orderedVisibleFields.find(
        (f) => f.type !== FieldType.RELATION_SUBTABLE
          && f.type !== FieldType.AUTO_NUMBER
          && f.type !== FieldType.SYSTEM_TIMESTAMP
          && f.type !== FieldType.SYSTEM_USER
          && f.type !== FieldType.FORMULA
          && f.type !== FieldType.BOOLEAN
      );
      if (firstEditableField) {
        const colIndex = orderedVisibleFields.indexOf(firstEditableField);
        setTimeout(() => {
          setActiveCell({ rowIndex: newRowIndex, colIndex });
          startEditing(record.id, firstEditableField.key);
        }, 0);
      }
      toast.success("已复制行");
    } catch {
      toast.error("复制行失败");
    }
  }, [tableId, onAddRecord, flatRecords.length, orderedVisibleFields, setActiveCell, startEditing]);

  // Auto-scroll on stableActiveCell change
  useEffect(() => {
    if (!stableActiveCell || !tableRef.current) return;
    const el = tableRef.current.querySelector(
      `[data-row="${stableActiveCell.rowIndex}"][data-col="${stableActiveCell.colIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [stableActiveCell]);

  // Click handler to set activeCell + boolean toggle
  const handleCellClick = useCallback(
    (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, [role="checkbox"], input, select')) return;

      if (e.shiftKey && stableActiveCell) {
        // Shift+click: extend selection
        e.preventDefault();
        const range: CellRange = {
          startRow: stableActiveCell.rowIndex,
          startCol: stableActiveCell.colIndex,
          endRow: rowIndex,
          endCol: colIndex,
        };
        setSelectionRangeRef(range);
        setSelectionRangeState(range);
      } else {
        setActiveCell({ rowIndex, colIndex });
        setSelectionRangeRef(null);
        setSelectionRangeState(null);
      }
      tableRef.current?.focus();

      // Boolean toggle on single click (only without Shift)
      if (!e.shiftKey) {
        const entry = flatRecords[rowIndex];
        if (entry?.type === "record" && entry.record) {
          const field = orderedVisibleFields[colIndex];
          if (field?.type === FieldType.BOOLEAN) {
            const currentValue = entry.record.data[field.key];
            const newValue = !(!!currentValue && currentValue !== "false" && currentValue !== 0);
            void handleCommitWithUndo(entry.record.id, field.key, newValue);
          }
        }
      }
    },
    [setActiveCell, setSelectionRangeRef, stableActiveCell, flatRecords, orderedVisibleFields, handleCommitWithUndo]
  );

  // ── Editor rendering ────────────────────────────────────────────────────
  const renderEditor = useCallback(
    (field: DataFieldItem, record: DataRecordItem) => {
      const originalValue = record.data[field.key];

      switch (field.type) {
        case FieldType.TEXT:
          return (
            <TextCellEditor
              initialValue={String(originalValue ?? "")}
              onCommit={(draft) => void commitEdit(draft)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.NUMBER:
          return (
            <NumberCellEditor
              initialValue={String(originalValue ?? "")}
              onCommit={(draft) => void commitEdit(draft)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.DATE:
          return (
            <DateCellEditor
              initialValue={String(originalValue ?? "")}
              onCommit={(draft) => void commitEdit(draft)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.EMAIL:
          return (
            <EmailCellEditor
              initialValue={String(originalValue ?? "")}
              onCommit={(draft) => void commitEdit(draft)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.PHONE:
          return (
            <PhoneCellEditor
              initialValue={String(originalValue ?? "")}
              onCommit={(draft) => void commitEdit(draft)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.FILE:
          return (
            <FileCellEditor
              initialValue={String(originalValue ?? "")}
              onCommit={(draft) => void commitEdit(draft)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.SELECT:
          return (
            <SelectCellEditor
              value={String(originalValue ?? "")}
              options={parseSelectOptions(field.options)}
              onCommit={(v) => void commitEdit(v)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.MULTISELECT: {
          const arrValue = Array.isArray(originalValue)
            ? (originalValue as string[])
            : [];
          return (
            <MultiselectCellEditor
              value={arrValue}
              options={parseSelectOptions(field.options)}
              onCommit={(v) => void commitEdit(v)}
              onCancel={cancelEdit}
            />
          );
        }
        case FieldType.RELATION: {
          const relValue = originalValue as { id?: string; display?: string } | string | null;
          const relId = relValue && typeof relValue === "object" ? relValue.id ?? null : typeof relValue === "string" ? relValue : null;
          return (
            <RelationCellEditor
              value={relId}
              onCommit={async (v) => {
                // Extract raw ID for API
                const apiValue = v && typeof v === "object" ? v.id : v;
                await commitEdit(apiValue);
                // Override local state with resolved {id, display} object
                if (v && typeof v === "object") {
                  onUpdateRecordField(record.id, field.key, v);
                }
              }}
              onCancel={cancelEdit}
              relationTableId={field.relationTo}
              displayField={field.displayField}
            />
          );
        }
        case FieldType.RELATION_SUBTABLE:
          // Not editable inline
          return null;
        case FieldType.URL:
          return (
            <UrlCellEditor
              initialValue={String(originalValue ?? "")}
              onCommit={(v) => void commitEdit(v)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.BOOLEAN:
          return (
            <BooleanCellEditor
              initialValue={!!originalValue && originalValue !== "false" && originalValue !== 0}
              onCommit={(v) => void commitEdit(v)}
            />
          );
        case FieldType.AUTO_NUMBER:
        case FieldType.SYSTEM_TIMESTAMP:
        case FieldType.SYSTEM_USER:
        case FieldType.FORMULA:
          return null;
        default:
          return null;
      }
    },
    [commitEdit, cancelEdit]
  );

  // ── Cell rendering ──────────────────────────────────────────────────────
  const renderCell = useCallback(
    (field: DataFieldItem, record: DataRecordItem) => {
      const isEditing =
        editingCell?.recordId === record.id &&
        editingCell?.fieldKey === field.key;

      // RELATION_SUBTABLE does not support inline editing
      if (isEditing) {
        return renderEditor(field, record);
      }

      return (
        <span className="block px-1 truncate">
          {formatCellValue(field, record.data[field.key])}
        </span>
      );
    },
    [editingCell, renderEditor]
  );

  // ── Per-record cell-level conditional format map ────────────────────────
  const cellRuleMapByRecord = useMemo(() => {
    if (!conditionalFormatRules || conditionalFormatRules.length === 0) return {};
    const outerMap: Record<string, Record<string, React.CSSProperties>> = {};
    for (const record of records) {
      const innerMap: Record<string, React.CSSProperties> = {};
      for (const rule of conditionalFormatRules) {
        if (rule.scope !== "cell") continue;
        const val = record.data[rule.condition.fieldKey];
        let match = false;
        switch (rule.condition.op) {
          case "eq": match = String(val ?? "") === String(rule.condition.value); break;
          case "ne": match = String(val ?? "") !== String(rule.condition.value); break;
          case "contains": match = String(val ?? "").includes(String(rule.condition.value)); break;
          case "notcontains": match = !String(val ?? "").includes(String(rule.condition.value)); break;
          case "startswith": match = String(val ?? "").startsWith(String(rule.condition.value)); break;
          case "endswith": match = String(val ?? "").endsWith(String(rule.condition.value)); break;
          case "isempty": match = val === undefined || val === null || val === ""; break;
          case "isnotempty": match = val !== undefined && val !== null && val !== ""; break;
          case "gt": match = Number(val) > Number(rule.condition.value); break;
          case "lt": match = Number(val) < Number(rule.condition.value); break;
          case "gte": match = Number(val) >= Number(rule.condition.value); break;
          case "lte": match = Number(val) <= Number(rule.condition.value); break;
        }
        if (match) {
          const style: React.CSSProperties = { backgroundColor: rule.backgroundColor };
          if (rule.textColor) style.color = rule.textColor;
          innerMap[rule.condition.fieldKey] = style;
          break;
        }
      }
      if (Object.keys(innerMap).length > 0) {
        outerMap[record.id] = innerMap;
      }
    }
    return outerMap;
  }, [records, conditionalFormatRules]);

  // ── Record row rendering ────────────────────────────────────────────────
  const renderRecordRow = useCallback(
    (record: DataRecordItem, index: number, flatRowIndex: number) => {
      const rowStyle = recordStyles[record.id];
      const cellRuleMap = cellRuleMapByRecord[record.id] ?? {};

      const rowContent = (
        <>
          <td
            className="w-10 sticky left-0 z-[5] bg-background border-r px-1"
            onContextMenu={(e) => captureRowHeader(e, record.id, flatRowIndex)}
          >
            <Checkbox
              checked={selectedIdsSet.has(record.id)}
              onCheckedChange={() => toggleRow(record.id)}
            />
          </td>
          {canDragSort && (
            <td className="w-8 px-1 text-muted-foreground cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4 mx-auto" />
            </td>
          )}
          {orderedVisibleFields.map((field, fieldIndex) => {
            const frozenTdStyle = getFrozenStyle(fieldIndex, frozenFieldCountValue, orderedVisibleFields, columnWidths);
            const rhClasses = getRowHeightClasses(rowHeight ?? 40);
            const isActive =
              stableActiveCell?.rowIndex === flatRowIndex &&
              stableActiveCell?.colIndex === fieldIndex;
            const isInRange = selectionRange &&
              flatRowIndex >= Math.min(selectionRange.startRow, selectionRange.endRow) &&
              flatRowIndex <= Math.max(selectionRange.startRow, selectionRange.endRow) &&
              fieldIndex >= Math.min(selectionRange.startCol, selectionRange.endCol) &&
              fieldIndex <= Math.max(selectionRange.startCol, selectionRange.endCol);
            const isFillTarget = fillRange &&
              !isActive &&
              flatRowIndex >= fillRange.startRow &&
              flatRowIndex <= fillRange.endRow &&
              fieldIndex >= fillRange.startCol &&
              fieldIndex <= fillRange.endCol;
            const cellStyle = cellRuleMap[field.key];
            const mergedStyle: React.CSSProperties = {
              ...(frozenTdStyle ?? {}),
              ...(cellStyle ?? {}),
            };
            return (
              <td
                key={field.id}
                data-row={flatRowIndex}
                data-col={fieldIndex}
                style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
                className={cn(
                  "align-middle overflow-hidden border-r border-neutral-400", rhClasses.td,
                  (rowHeight ?? 40) < 56 && "whitespace-nowrap",
                  rhClasses.text,
                  frozenTdStyle && "bg-background",
                  frozenFieldCountValue > 0 &&
                    fieldIndex === frozenFieldCountValue - 1 &&
                    "frozen-last-col relative",
                  isActive && "outline outline-2 outline-primary outline-offset-[-2px] relative",
                  isInRange && !isActive && "bg-primary/20 outline outline-1 outline-offset-[-1px] outline-primary/40",
                  isFillTarget && "bg-primary/15"
                )}
                onClick={(e) => handleCellClick(flatRowIndex, fieldIndex, e)}
                onDoubleClick={() => {
                  const canEdit = field.type !== FieldType.RELATION_SUBTABLE
                    && field.type !== FieldType.AUTO_NUMBER
                    && field.type !== FieldType.SYSTEM_TIMESTAMP
                    && field.type !== FieldType.SYSTEM_USER
                    && field.type !== FieldType.FORMULA
                    && field.type !== FieldType.BOOLEAN
                    && field.type !== FieldType.COUNT;
                  if (canEdit) {
                    startEditing(record.id, field.key);
                  }
                }}
                onContextMenu={(e) => captureCell(e, record.id, field.key, flatRowIndex, fieldIndex)}
              >
                {renderCell(field, record)}
                {isActive && !READONLY_FIELD_TYPES.includes(field.type) && !editingCell && (
                  <div
                    className="absolute bottom-0 right-0 w-2 h-2 bg-primary cursor-crosshair z-10"
                    onMouseDown={(e) => handleFillStart(e, record, field)}
                  />
                )}
              </td>
            );
          })}
          <td className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0">
            <div className="flex gap-1">
              {onOpenDetail && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => onOpenDetail(record.id)}
                  title="查看详情"
                >
                  <Expand className="h-3 w-3" />
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-red-600"
                  onClick={() => void onDeleteRecord(record.id)}
                  disabled={deletingIds.has(record.id)}
                >
                  {deletingIds.has(record.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              )}
            </div>
          </td>
        </>
      );

      if (canDragSort) {
        return (
          <DragHandleRow key={record.id} record={record} index={index} style={rowStyle}>
            {rowContent}
          </DragHandleRow>
        );
      }

      return (
        <tr key={record.id} className="border-b transition-colors hover:bg-primary/8 data-[state=selected]:bg-muted" style={rowStyle}>
          {rowContent}
        </tr>
      );
    },
    [
      orderedVisibleFields,
      renderCell,
      isAdmin,
      onDeleteRecord,
      deletingIds,
      onOpenDetail,
      frozenFieldCountValue,
      columnWidths,
      canDragSort,
      selectedIdsSet,
      toggleRow,
      stableActiveCell,
      handleCellClick,
      startEditing,
      recordStyles,
      cellRuleMapByRecord,
      captureRowHeader,
      captureCell,
      rowHeight,
      fillRange,
      editingCell,
      handleFillStart,
    ]
  );

  // ── Column count ────────────────────────────────────────────────────────
  const colCount = orderedVisibleFields.length + 1 + (canDragSort ? 1 : 0) + 1; // +1 for checkbox col

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-md border flex-1 min-h-0 flex flex-col overflow-hidden gap-0">
      {selectedIdsSet.size > 0 && (
        <BatchActionBar
          selectedCount={selectedIdsSet.size}
          onBatchDelete={handleBatchDelete}
          onBatchEdit={() => setBatchEditOpen(true)}
          onClearSelection={() => setSelectedIdsSet(new Set())}
        />
      )}
      <BatchEditDialog
        open={batchEditOpen}
        onOpenChange={setBatchEditOpen}
        fields={orderedVisibleFields}
        onApply={handleBatchEdit}
      />
      <CellContextMenu
        context={context}
        fields={orderedVisibleFields}
        records={records}
        isAdmin={isAdmin}
        frozenCount={frozenFieldCountValue}
        onEditCell={(recordId, fieldKey) => startEditing(recordId, fieldKey)}
        onCopyCellValue={(recordId, fieldKey) => {
          const record = records.find((r) => r.id === recordId);
          if (record) {
            navigator.clipboard.writeText(String(record.data[fieldKey] ?? ""));
            toast.success("已复制");
          }
        }}
        onInsertRow={handleInsertRow}
        onDeleteRecord={(recordId) => void onDeleteRecord(recordId)}
        onDuplicateRecord={handleDuplicateRecord}
        onFilterByCell={(fieldKey, value) => {
          const newFilter: FilterCondition = { fieldKey, op: "eq", value };
          onFilterChange(newFilter, fieldKey);
        }}
        onSortColumn={(fieldKey, order) => onSortChange({ fieldKey, order })}
        onToggleFreeze={(colIndex, frozenCount) => {
          const newCount = colIndex < frozenCount ? colIndex : colIndex + 1;
          onFrozenFieldCountChange?.(newCount);
        }}
        onHideColumn={(fieldKey) => {
          onVisibleFieldsChange(visibleFields.filter((f) => f !== fieldKey));
        }}
        onAutoFitColumn={(fieldKey) => handleAutoFit(fieldKey)}
        onOpenDetail={onOpenDetail}
        onEditField={(fieldKey) => {
          const field = fields.find((f) => f.key === fieldKey);
          if (field) {
            onOpenFieldsConfig?.();
          }
        }}
        onDeleteField={(fieldKey) => {
          // 删除字段会清除所有数据，引导管理员去字段配置页面操作
          onOpenFieldsConfig?.();
        }}
        onAddConditionalFormat={(fieldKey, value) => {
          onQuickFormat?.(fieldKey, value);
        }}
      >
      <div className="flex items-center gap-1 px-2 py-1 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!undoManager.canUndo || undoManager.isExecuting}
          onClick={() => void undoManager.undo()}
          title={undoManager.lastDescription ? `撤销: ${undoManager.lastDescription}` : "撤销"}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!undoManager.canRedo || undoManager.isExecuting}
          onClick={() => void undoManager.redo()}
          title="重做"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto relative" ref={scrollRef}>
        <FindReplaceBar
          open={findBarOpen}
          onClose={() => setFindBarOpen(false)}
          rows={flatRecords.map(e => e.type === "record" && e.record ? { id: e.record.id, data: e.record.data } : null)}
          fieldKeys={orderedVisibleFields.map(f => f.key)}
          onNavigateTo={(flatRowIndex, colIndex) => setActiveCell({ rowIndex: flatRowIndex, colIndex })}
          onReplace={(recordId, fieldKey, newValue) => handleCommit(recordId, fieldKey, newValue)}
        />
        <table
          className="w-full caption-bottom text-sm outline-none select-none"
          style={{ tableLayout: "fixed" }}
          ref={tableRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <colgroup>
            <col style={{ width: CHECKBOX_COL_WIDTH }} />
            {canDragSort && <col style={{ width: 32 }} />}
            {orderedVisibleFields.map((field) => (
              <col key={field.key} style={{ width: columnWidths[field.key] ?? DEFAULT_COL_WIDTH }} />
            ))}
            <col style={{ width: 80 }} />
          </colgroup>
          <DragDropProvider onDragEnd={handleColumnDragEnd}>
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 sticky top-0 z-10 bg-background">
              <th className="w-10 h-10 sticky left-0 z-[13] bg-background border-r px-1">
                <Checkbox
                  checked={records.length > 0 && selectedIdsSet.size === records.length}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = !!(selectedIdsSet.size > 0 && selectedIdsSet.size < records.length);
                    }
                  }}
                  onCheckedChange={toggleAll}
                />
              </th>
              {canDragSort && (
                <th className="h-10 px-1 w-8" />
              )}
              {orderedVisibleFields.map((field, index) => {
                const frozenStyle = getFrozenStyle(index, frozenFieldCountValue, orderedVisibleFields, columnWidths);
                return (
                <DraggableColumnHeader
                  key={field.id}
                  id={field.key}
                  index={index}
                  columnWidth={columnWidths[field.key] ?? DEFAULT_COL_WIDTH}
                  fieldKey={field.key}
                  onWidthChange={handleWidthChange}
                  onAutoFit={handleAutoFit}
                  frozenStyle={frozenStyle}
                  frozenFieldCount={frozenFieldCountValue}
                  onContextMenu={(e) => captureColHeader(e, field.key, index)}
                >
                  <ColumnHeader
                    field={field}
                    filter={
                      findFilterForField(field.key)
                    }
                    sort={sorts.find((s) => s.fieldKey === field.key) ?? null}
                    onFilterChange={(filter) =>
                      onFilterChange(filter, field.key)
                    }
                    onSortChange={(sort) => {
                      if (sort) {
                        onSortChange(sort);
                      } else {
                        onSortClear(field.key);
                      }
                    }}
                    frozenFieldCount={frozenFieldCountValue}
                    index={index}
                    onFrozenFieldCountChange={onFrozenFieldCountChange}
                  />
                </DraggableColumnHeader>
              );
              })}
              <th className="h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 w-[80px]">操作</th>
            </tr>
          </thead>
        </DragDropProvider>
        <tbody className="[&_tr:last-child]:border-0">
          <DragDropProvider onDragEnd={canDragSort ? handleRowDragEnd : undefined}>
          {isLoading ? (
            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              <td colSpan={colCount} className="align-middle whitespace-nowrap p-0 border-0">
                <TableSkeleton
                  rows={5}
                  columns={orderedVisibleFields.length}
                />
              </td>
            </tr>
          ) : records.length === 0 ? (
            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              <td colSpan={colCount} className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 text-center py-8">
                暂无记录
              </td>
            </tr>
          ) : (
            <>
              {/* Top padding for virtual scroll */}
              {topPadding > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={colCount} style={{ height: topPadding, padding: 0 }} />
                </tr>
              )}
              {/* Visible rows only */}
              {visibleFlatRecords.map((entry, visibleIdx) => {
                const globalIdx = startIndex + visibleIdx;
                if (entry.type === "group" && entry.group) {
                  const group = entry.group;
                  const isCollapsed = collapsedGroups.has(group.value);
                  return (
                    <tr
                      key={`group-${group.value}`}
                      className="border-b transition-colors bg-muted/50 hover:bg-muted/70 cursor-pointer select-none sticky top-[41px] z-[5]"
                      onClick={() => toggleGroup(group.value)}
                    >
                      <td colSpan={colCount} className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 py-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          <span>{group.label}</span>
                          <span className="text-xs">({group.records.length})</span>
                        </div>
                      </td>
                    </tr>
                  );
                }
                if (entry.record) {
                  return renderRecordRow(
                    entry.record,
                    visibleIdx,
                    globalIdx
                  );
                }
                return null;
              })}
              {/* Bottom padding for virtual scroll */}
              {bottomPadding > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={colCount} style={{ height: bottomPadding, padding: 0 }} />
                </tr>
              )}
              {/* Quick add row */}
              {isAdmin && (
                <tr
                  className="border-b hover:bg-primary/5 cursor-pointer group"
                  onClick={handleQuickAddRow}
                >
                  <td className="w-10 sticky left-0 z-[5] bg-background border-r" />
                  {canDragSort && <td className="w-8" />}
                  <td
                    colSpan={orderedVisibleFields.length + 1}
                    className="p-1 align-middle text-muted-foreground text-sm"
                  >
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted/50 transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                      <span className="opacity-60 group-hover:opacity-100 transition-opacity">新建行</span>
                    </span>
                  </td>
                </tr>
              )}
            </>
          )}
          </DragDropProvider>
        </tbody>
        {Object.keys(columnAggregations ?? {}).length > 0 && (
          <tfoot>
            <tr className="border-t bg-muted/30 sticky bottom-0 z-[5]">
              <td className="p-2 text-xs text-muted-foreground w-10" />
              {orderedVisibleFields.map((field) => {
                const agg = columnAggregations?.[field.key];
                if (!agg) return <td key={field.key} className="p-2 border-r border-neutral-400" />;
                const summary = summaryData[field.key];
                return (
                  <td
                    key={field.key}
                    className="p-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted/50 border-r border-neutral-400"
                    style={{ width: columnWidths[field.key] ?? DEFAULT_COL_WIDTH }}
                    onClick={() => {
                      const cycle = getAvailableAggTypes(field.type);
                      const currentIndex = cycle.indexOf(agg);
                      const next = cycle[(currentIndex + 1) % cycle.length];
                      onColumnAggregationsChange?.({ ...columnAggregations, [field.key]: next });
                    }}
                  >
                    <span className="font-medium">{getAggLabel(agg)}</span>
                    {summary && (
                      <span className="ml-1 font-mono">{formatSummaryValue(summary.value, agg)}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
        </table>
      </div>
      </CellContextMenu>
      {/* Fill mode toggle popup */}
      {fillComplete && (
        <div
          className="fixed z-50 bg-popover text-popover-foreground border rounded-md shadow-md flex items-center gap-1 p-1"
          style={{ left: fillComplete.anchorRect.x + 4, top: fillComplete.anchorRect.y + 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant={fillMode === "copy" ? "default" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleFillModeToggle}
          >
            复制
          </Button>
          <Button
            variant={fillMode === "increment" ? "default" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleFillModeToggle}
          >
            递增
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Summary row helpers ────────────────────────────────────────────────────

function getAvailableAggTypes(fieldType: string): AggregateType[] {
  switch (fieldType) {
    case "NUMBER": case "FORMULA": return ["sum", "avg", "min", "max", "count"];
    case "BOOLEAN": return ["checked", "unchecked", "count"];
    case "DATE": case "SYSTEM_TIMESTAMP": return ["earliest", "latest", "count"];
    default: return ["count"];
  }
}

function getAggLabel(type: AggregateType): string {
  const labels: Record<AggregateType, string> = {
    count: "计数", sum: "求和", avg: "平均",
    min: "最小", max: "最大", earliest: "最早", latest: "最新",
    checked: "已选", unchecked: "未选",
  };
  return labels[type];
}

function formatSummaryValue(value: number | string, type: AggregateType): string {
  if (type === "earliest" || type === "latest") {
    try { return new Date(value).toLocaleDateString("zh-CN"); } catch { return String(value); }
  }
  if (typeof value === "number") {
    return type === "count" || type === "checked" || type === "unchecked"
      ? String(value)
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}
