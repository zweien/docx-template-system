"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
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
  onDeleteRecord,
  deletingIds,
  onRefresh,
  onOpenDetail,
}: GridViewProps) {
  // ── Collapsed groups state ──────────────────────────────────────────────
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

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

  // ── Grouping ────────────────────────────────────────────────────────────
  const groupField = useMemo(
    () => (groupBy ? fieldMap.get(groupBy) ?? null : null),
    [groupBy, fieldMap]
  );

  const groupedRecords = useMemo(() => {
    if (!groupField || records.length === 0) return null;
    return groupRecords(records, groupField);
  }, [groupField, records]);

  // ── Inline editing ─────────────────────────────────────────────────────
  const handleCommit = useCallback(
    async (recordId: string, fieldKey: string, value: unknown) => {
      const response = await fetch(
        `/api/data-tables/${tableId}/records/${recordId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { [fieldKey]: value } }),
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
          className={`block truncate max-w-[200px] ${
            canEdit ? "cursor-pointer hover:bg-muted/30 rounded px-1" : ""
          }`}
          onClick={
            canEdit
              ? () => startEditing(record.id, field.key)
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
    (record: DataRecordItem) => (
      <TableRow
        key={record.id}
        className={onOpenDetail ? "cursor-pointer" : undefined}
        onClick={(e) => {
          // Don't open detail when clicking on a cell (inline edit) or action buttons
          const target = e.target as HTMLElement;
          if (target.closest("button") || target.closest("input")) return;
          onOpenDetail?.(record.id);
        }}
      >
        {orderedVisibleFields.map((field) => (
          <TableCell key={field.id} className="max-w-[200px]">
            {renderCell(field, record)}
          </TableCell>
        ))}
        {isAdmin && (
          <TableCell>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  void onDeleteRecord(record.id);
                }}
                disabled={deletingIds.has(record.id)}
              >
                {deletingIds.has(record.id) ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>
    ),
    [
      orderedVisibleFields,
      renderCell,
      isAdmin,
      onDeleteRecord,
      deletingIds,
      onOpenDetail,
    ]
  );

  // ── Column count ────────────────────────────────────────────────────────
  const colCount = orderedVisibleFields.length + (isAdmin ? 1 : 0);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {orderedVisibleFields.map((field) => (
              <TableHead key={field.id}>
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
                />
              </TableHead>
            ))}
            {isAdmin && (
              <TableHead className="w-[80px]">操作</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={colCount} className="p-0 border-0">
                <TableSkeleton
                  rows={5}
                  columns={orderedVisibleFields.length}
                />
              </TableCell>
            </TableRow>
          ) : records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center py-8">
                暂无记录
              </TableCell>
            </TableRow>
          ) : groupedRecords ? (
            // ── Grouped rendering ────────────────────────────────────────
            groupedRecords.map((group) => {
              const isCollapsed = collapsedGroups.has(group.value);
              return (
                <Fragment key={`group-${group.value}`}>
                  <TableRow
                    className="bg-muted/50 hover:bg-muted/70 cursor-pointer select-none"
                    onClick={() => toggleGroup(group.value)}
                  >
                    <TableCell colSpan={colCount} className="py-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                        <span>{group.label}</span>
                        <span className="text-xs">({group.records.length})</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {!isCollapsed &&
                    group.records.map((record) => renderRecordRow(record))}
                </Fragment>
              );
            })
          ) : (
            // ── Flat rendering ────────────────────────────────────────────
            records.map((record) => renderRecordRow(record))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
