"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, Expand, GripVertical, Loader2, Trash2 } from "lucide-react";
import { BatchActionBar } from "@/components/data/batch-action-bar";
import { BatchEditDialog } from "@/components/data/batch-edit-dialog";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { FieldType } from "@/generated/prisma/enums";
import type {
  DataFieldItem,
  DataRecordItem,
  FilterCondition,
  SortConfig,
} from "@/types/data-table";
import { ColumnHeader } from "@/components/data/column-header";
import { formatCellValue } from "@/lib/format-cell";
import { useInlineEdit } from "@/hooks/use-inline-edit";
import { useKeyboardNav, type ActiveCell } from "@/hooks/use-keyboard-nav";
import { cn } from "@/lib/utils";
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
import { TableSkeleton } from "@/components/ui/skeleton";
import { ColumnResizer } from "@/components/data/column-resizer";

const DEFAULT_COL_WIDTH = 160;
const CHECKBOX_COL_WIDTH = 40;

// ─── Props ──────────────────────────────────────────────────────────────────

interface GridViewProps {
  tableId: string;
  fields: DataFieldItem[];
  records: DataRecordItem[];
  isLoading: boolean;
  isAdmin: boolean;
  filters: FilterCondition[];
  sorts: SortConfig[];
  visibleFields: string[];
  fieldOrder: string[];
  groupBy: string | null;
  onFilterChange: (filter: FilterCondition | null, fieldKey: string) => void;
  onSortChange: (sort: SortConfig | null) => void;
  onVisibleFieldsChange: (fields: string[]) => void;
  onFieldOrderChange: (order: string[]) => void;
  onGroupByChange: (fieldKey: string | null) => void;
  onDeleteRecord: (recordId: string) => Promise<void>;
  deletingIds: Set<string>;
  onRefresh: () => void;
  onOpenDetail?: (recordId: string) => void;
  columnWidths: Record<string, number>;
  onColumnWidthsChange: (widths: Record<string, number>) => void;
  frozenFieldCount?: number;
  onFrozenFieldCountChange?: (count: number) => void;
  viewId?: string | null;
  page?: number;
  onReorderRecords?: (orderedIds: string[]) => void;
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
}) {
  const { ref, isDragging } = useSortable({ id, index });
  return (
    <th
      ref={ref}
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 relative",
        isDragging ? "opacity-50 bg-muted" : "cursor-grab active:cursor-grabbing",
        frozenStyle && "bg-background",
        frozenFieldCount && frozenFieldCount > 0 && index === frozenFieldCount - 1 && "frozen-last-col"
      )}
      style={{ width: columnWidth, ...(frozenStyle ?? {}) }}
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
}: {
  record: DataRecordItem;
  index: number;
  children: React.ReactNode;
}) {
  const { ref, isDragging } = useSortable({ id: record.id, index });
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50",
        isDragging && "opacity-50 bg-muted"
      )}
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
  onFieldOrderChange,
  onDeleteRecord,
  deletingIds,
  onRefresh,
  onOpenDetail,
  columnWidths,
  onColumnWidthsChange,
  frozenFieldCount,
  onFrozenFieldCountChange,
  viewId,
  page,
  onReorderRecords,
}: GridViewProps) {
  const frozenFieldCountValue = frozenFieldCount ?? 0;

  // ── Can drag-sort rows? (only when no sorts, no grouping, has viewId, and admin) ──
  const canDragSort = useMemo(
    () => sorts.length === 0 && !groupBy && !!viewId && isAdmin,
    [sorts, groupBy, viewId, isAdmin]
  );

  // ── Batch selection state ────────────────────────────────────────────────
  const [batchEditOpen, setBatchEditOpen] = useState(false);

  // ── Collapsed groups state ──────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );
  const tableRef = useRef<HTMLTableElement>(null);

  // ── Keyboard nav: active cell state (for rendering) ──────────────────────
  const [activeCell, setActiveCellState] = useState<ActiveCell | null>(null);

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
  // selectedIds is scoped to current page; we store {page, ids} so page
  // changes automatically clear the selection.
  const [selectionState, setSelectionState] = useState<{
    page: number | undefined;
    ids: Set<string>;
  }>({ page, ids: new Set() });

  // Keep in sync with prop changes
  const currentSelectedIds =
    selectionState.page === page ? selectionState.ids : new Set<string>();
  const updateSelectedIds = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      setSelectionState((prev) => ({
        page,
        ids: updater(prev.page === page ? prev.ids : new Set()),
      }));
    },
    [page]
  );

  const toggleAll = useCallback(() => {
    const current =
      selectionState.page === page ? selectionState.ids : new Set<string>();
    if (current.size === records.length) {
      updateSelectedIds(() => new Set());
    } else {
      updateSelectedIds(() => new Set(records.map((r) => r.id)));
    }
  }, [records, page, selectionState, updateSelectedIds]);

  const toggleRow = useCallback(
    (recordId: string) => {
      updateSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(recordId) ? next.delete(recordId) : next.add(recordId);
        return next;
      });
    },
    [updateSelectedIds]
  );

  const selectedIdsSet = currentSelectedIds;

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
    updateSelectedIds(() => new Set());
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
  }, [selectedIdsSet, tableId, onRefresh, updateSelectedIds]);

  // ── Batch edit handler ────────────────────────────────────────────────
  const handleBatchEdit = useCallback(
    async (fieldKey: string, value: unknown) => {
      const ids = [...selectedIdsSet];
      updateSelectedIds(() => new Set());
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
    [selectedIdsSet, tableId, onRefresh, updateSelectedIds]
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

  // ── Flat records for keyboard nav (maps flat index → record or group) ────
  const flatRecords = useMemo(() => {
    if (groupedRecords) {
      const flat: Array<{
        type: "group" | "record";
        record?: DataRecordItem;
      }> = [];
      for (const group of groupedRecords) {
        flat.push({ type: "group" });
        if (!collapsedGroups.has(group.value)) {
          for (const r of group.records)
            flat.push({ type: "record", record: r });
        }
      }
      return flat;
    }
    return records.map((r) => ({ type: "record" as const, record: r }));
  }, [groupedRecords, collapsedGroups, records]);

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
      onRefresh();
    },
    [tableId, onRefresh]
  );

  const { editingCell, startEditing, commitEdit, cancelEdit, isCommitting } =
    useInlineEdit({ tableId, onCommit: handleCommit });

  // ── Keyboard navigation ──────────────────────────────────────────────────
  const { handleKeyDown, setActiveCell: setActiveCellRef } = useKeyboardNav({
    rowCount: flatRecords.length,
    colCount: orderedVisibleFields.length,
    editingCell,
    onMoveTo: (cell) => setActiveCellState(cell),
    onStartEdit: () => {
      if (!activeCell) return;
      const entry = flatRecords[activeCell.rowIndex];
      if (entry?.type !== "record" || !entry.record) return;
      const field = orderedVisibleFields[activeCell.colIndex];
      if (field && field.type !== FieldType.RELATION_SUBTABLE) {
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
        field.options &&
        !field.options.includes(text)
      )
        return;
      handleCommit(
        entry.record.id,
        field.key,
        field.type === FieldType.NUMBER ? Number(text) : text
      );
    },
    isGroupRow: (rowIndex: number) =>
      groupRowIndices.has(rowIndex),
  });

  // Wrapper that syncs both ref and state
  const setActiveCell = useCallback(
    (cell: ActiveCell | null) => {
      setActiveCellRef(cell);
      setActiveCellState(cell);
    },
    [setActiveCellRef]
  );

  // Auto-scroll on activeCell change
  useEffect(() => {
    if (!activeCell || !tableRef.current) return;
    const el = tableRef.current.querySelector(
      `[data-row="${activeCell.rowIndex}"][data-col="${activeCell.colIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeCell]);

  // Clear activeCell on page change
  useEffect(() => {
    setActiveCell(null);
  }, [page]);

  // Click handler to set activeCell
  const handleCellClick = useCallback(
    (rowIndex: number, colIndex: number, e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, [role="checkbox"], input, select')) return;
      setActiveCell({ rowIndex, colIndex });
      tableRef.current?.focus();
    },
    [setActiveCell]
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
              options={field.options ?? []}
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
              options={field.options ?? []}
              onCommit={(v) => void commitEdit(v)}
              onCancel={cancelEdit}
            />
          );
        }
        case FieldType.RELATION:
          return (
            <RelationCellEditor
              value={String(originalValue ?? "")}
              onCommit={(v) => void commitEdit(v)}
              onCancel={cancelEdit}
            />
          );
        case FieldType.RELATION_SUBTABLE:
          // Not editable inline
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
      const canEdit = field.type !== FieldType.RELATION_SUBTABLE;

      if (isEditing) {
        return renderEditor(field, record);
      }

      return (
        <span
          className={`block truncate ${
            canEdit ? "cursor-pointer hover:bg-muted/30 rounded px-1" : ""
          }`}
          onClick={
            canEdit
              ? (e: React.MouseEvent) => {
                  e.stopPropagation();
                  startEditing(record.id, field.key);
                }
              : undefined
          }
        >
          {formatCellValue(field, record.data[field.key])}
        </span>
      );
    },
    [editingCell, renderEditor, startEditing]
  );

  // ── Record row rendering ────────────────────────────────────────────────
  const renderRecordRow = useCallback(
    (record: DataRecordItem, index: number, flatRowIndex: number) => {
      const rowContent = (
        <>
          <td className="w-10 sticky left-0 z-[5] bg-background border-r px-1">
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
            const isActive =
              activeCell?.rowIndex === flatRowIndex &&
              activeCell?.colIndex === fieldIndex;
            return (
              <td
                key={field.id}
                data-row={flatRowIndex}
                data-col={fieldIndex}
                style={frozenTdStyle}
                className={cn(
                  "p-2 align-middle whitespace-nowrap",
                  frozenTdStyle && "bg-background",
                  frozenFieldCountValue > 0 &&
                    fieldIndex === frozenFieldCountValue - 1 &&
                    "frozen-last-col relative",
                  isActive && "ring-2 ring-primary ring-inset"
                )}
                onClick={(e) => handleCellClick(flatRowIndex, fieldIndex, e)}
              >
                {renderCell(field, record)}
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
          <DragHandleRow key={record.id} record={record} index={index}>
            {rowContent}
          </DragHandleRow>
        );
      }

      return (
        <tr key={record.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
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
      activeCell,
      handleCellClick,
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
          onClearSelection={() => updateSelectedIds(() => new Set())}
        />
      )}
      <BatchEditDialog
        open={batchEditOpen}
        onOpenChange={setBatchEditOpen}
        fields={orderedVisibleFields}
        onApply={handleBatchEdit}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          className="w-full caption-bottom text-sm outline-none"
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
                >
                  <ColumnHeader
                    field={field}
                    filter={
                      filters.find((f) => f.fieldKey === field.key) ?? null
                    }
                    sort={sorts.find((s) => s.fieldKey === field.key) ?? null}
                    onFilterChange={(filter) =>
                      onFilterChange(filter, field.key)
                    }
                    onSortChange={onSortChange}
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
          ) : groupedRecords ? (
            // ── Grouped rendering ────────────────────────────────────────
            (() => {
              let flatIdx = 0;
              return groupedRecords.map((group) => {
                const groupHeaderFlatIdx = flatIdx;
                const isCollapsed = collapsedGroups.has(group.value);
                flatIdx += 1; // group header row
                const startRecordFlatIdx = flatIdx;
                if (!isCollapsed) {
                  flatIdx += group.records.length;
                }
                return (
                  <Fragment key={`group-${group.value}`}>
                    <tr
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
                    {!isCollapsed &&
                      group.records.map((record, idx) =>
                        renderRecordRow(record, idx, startRecordFlatIdx + idx)
                      )}
                  </Fragment>
                );
              });
            })()
          ) : (
            // ── Flat rendering ────────────────────────────────────────────
            records.map((record, idx) => renderRecordRow(record, idx, idx))
          )}
          </DragDropProvider>
        </tbody>
        </table>
      </div>
    </div>
  );
}
