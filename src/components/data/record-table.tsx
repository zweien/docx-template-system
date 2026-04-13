"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Plus, X } from "lucide-react";
import type {
  DataFieldItem,
  DataViewItem,
  FilterCondition,
  FilterGroup,
  SortConfig,
  ViewType,
} from "@/types/data-table";
import { FieldConfigPopover } from "@/components/data/field-config-popover";
import { ConditionalFormatDialog } from "@/components/data/conditional-format-dialog";
import { FilterPanel } from "@/components/data/filter-panel";
import { ViewSelector } from "@/components/data/view-selector";
import { SaveViewDialog } from "@/components/data/save-view-dialog";
import { useTableData } from "@/hooks/use-table-data";
import { GridView } from "@/components/data/views/grid-view";
import { KanbanView } from "@/components/data/views/kanban/kanban-view";
import { GalleryView } from "@/components/data/views/gallery/gallery-view";
import { TimelineView } from "@/components/data/views/timeline/timeline-view";

// ─── Props ──────────────────────────────────────────────────────────────────

interface RecordTableProps {
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
  viewType?: ViewType;
  onOpenDetail?: (recordId: string) => void;
}

// ─── Fallback view when no saved view is selected ────────────────────────────

function buildFallbackView(tableId: string, fields: DataFieldItem[]): DataViewItem {
  return {
    id: "fallback",
    tableId,
    name: "默认",
    type: "GRID",
    isDefault: true,
    filters: [],
    sortBy: [],
    visibleFields: fields.map((f) => f.key),
    fieldOrder: fields.map((f) => f.key),
    groupBy: null,
    viewOptions: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function RecordTable({
  tableId,
  fields,
  isAdmin,
  viewType = "GRID",
  onOpenDetail,
}: RecordTableProps) {
  const router = useRouter();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [quickFormatField, setQuickFormatField] = useState<string | undefined>();
  const [quickFormatValue, setQuickFormatValue] = useState<string | undefined>();
  const {
    records,
    totalCount,
    totalPages,
    isLoading,
    page,
    search,
    searchInput,
    setSearchInput,
    viewId,
    currentView,
    currentConfig,
    setFilters,
    setSorts,
    setVisibleFields,
    setFieldOrder,
    setGroupBy,
    setViewOptions,
    conditionalFormatRules,
    setConditionalFormatRules,
    columnAggregations,
    setColumnAggregations,
    deleteRecord,
    deletingIds,
    updateRecordField,
    addRecord,
    switchView,
    refresh,
  } = useTableData({ tableId, fields });

  const activeView = useMemo(() => {
    const base = currentView ?? buildFallbackView(tableId, fields);
    return { ...base, viewOptions: currentConfig.viewOptions };
  }, [currentConfig.viewOptions, currentView, tableId, fields]);

  // ── Patch single field (for Kanban drag-and-drop) ────────────────────────
  const handlePatchRecord = useCallback(
    async (recordId: string, fieldKey: string, value: unknown) => {
      const res = await fetch(
        `/api/data-tables/${tableId}/records/${recordId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fieldKey, value }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存失败");
      }
      updateRecordField(recordId, fieldKey, value);
    },
    [tableId, updateRecordField]
  );

  // ── Filter change handler ────────────────────────────────────────────────
  const handleFilterChange = useCallback(
    (filter: FilterCondition | null, fieldKey: string) => {
      // Build updated groups: remove existing condition for this field, then add new one
      const updatedGroups: FilterGroup[] = currentConfig.filters.map((group) => ({
        ...group,
        conditions: group.conditions.filter((c) => c.fieldKey !== fieldKey),
      })).filter((group) => group.conditions.length > 0);

      if (filter) {
        // Add to the first group (or create a new AND group if none exist)
        if (updatedGroups.length > 0) {
          updatedGroups[0] = {
            ...updatedGroups[0],
            conditions: [...updatedGroups[0].conditions, filter],
          };
        } else {
          updatedGroups.push({ operator: "AND", conditions: [filter] });
        }
      }
      setFilters(updatedGroups);
    },
    [currentConfig.filters, setFilters]
  );

  // ── Sort change handler (replaces sort for the matching fieldKey) ────────
  const handleSortChange = useCallback(
    (fieldKey: string, sort: SortConfig | null) => {
      const nextSorts = currentConfig.sortBy.filter(
        (sortItem) => sortItem.fieldKey !== fieldKey
      );
      if (sort) {
        nextSorts.push(sort);
      }
      setSorts(nextSorts);
    },
    [currentConfig.sortBy, setSorts]
  );

  // ── GridView sort change adapter (ColumnHeader puts fieldKey in SortConfig) ─
  const handleGridViewSortChange = useCallback(
    (sort: SortConfig | null) => {
      if (!sort) return;
      handleSortChange(sort.fieldKey, sort);
    },
    [handleSortChange]
  );

  // ── Sort clear handler (removes sort for a specific field) ──────────────
  const handleSortClear = useCallback(
    (fieldKey: string) => {
      handleSortChange(fieldKey, null);
    },
    [handleSortChange]
  );

  // ── Field config change handler ──────────────────────────────────────────
  const handleFieldConfigChange = useCallback(
    (nextVisibleFields: string[], nextFieldOrder: string[]) => {
      setVisibleFields(nextVisibleFields);
      setFieldOrder(nextFieldOrder);
    },
    [setVisibleFields, setFieldOrder]
  );

  // ── Column widths ──────────────────────────────────────────────────────
  const columnWidths = useMemo(
    () => (currentConfig.viewOptions.columnWidths as Record<string, number>) ?? {},
    [currentConfig.viewOptions.columnWidths]
  );

  const handleColumnWidthsChange = useCallback(
    (next: Record<string, number>) => {
      setViewOptions({ ...currentConfig.viewOptions, columnWidths: next });
    },
    [currentConfig.viewOptions, setViewOptions]
  );

  const handleOpenFieldsConfig = useCallback(() => {
    router.push(`/data/${tableId}/fields`);
  }, [router, tableId]);

  // ── Frozen fields ──────────────────────────────────────────────────────
  const frozenFieldCount = (currentConfig.viewOptions.frozenFieldCount as number) ?? 0;

  const handleFrozenFieldCountChange = useCallback(
    (count: number) => {
      setViewOptions({ ...currentConfig.viewOptions, frozenFieldCount: count });
    },
    [currentConfig.viewOptions, setViewOptions]
  );

  // ── Row reorder ────────────────────────────────────────────────────────
  const reorderRecords = useCallback(
    async (orderedIds: string[]) => {
      if (!viewId) return;
      try {
        const res = await fetch(
          `/api/data-tables/${tableId}/records/reorder?viewId=${viewId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordIds: orderedIds }),
          }
        );
        if (res.ok) refresh();
      } catch {
        refresh();
      }
    },
    [viewId, tableId, refresh]
  );

  // ── Pagination href builder ──────────────────────────────────────────────
  const buildPageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }
    if (search) {
      params.set("search", search);
    }
    if (viewId) {
      params.set("viewId", viewId);
    }

    const query = params.toString();
    return query ? `/data/${tableId}?${query}` : `/data/${tableId}`;
  };

  // ── Empty state ──────────────────────────────────────────────────────────
  if (fields.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        请先配置字段
        {isAdmin && (
          <Link
            href={`/data/${tableId}/fields`}
            className="ml-2 text-blue-600 hover:underline"
          >
            前往配置
          </Link>
        )}
      </div>
    );
  }

  // ── View rendering ───────────────────────────────────────────────────────
  function renderView() {
    switch (viewType) {
      case "GRID":
        return (
          <GridView
            tableId={tableId}
            fields={fields}
            records={records}
            isLoading={isLoading}
            isAdmin={isAdmin}
            filters={currentConfig.filters}
            sorts={currentConfig.sortBy}
            visibleFields={currentConfig.visibleFields}
            fieldOrder={currentConfig.fieldOrder}
            groupBy={currentConfig.groupBy}
            onFilterChange={handleFilterChange}
            onSortChange={handleGridViewSortChange}
            onSortClear={handleSortClear}
            onVisibleFieldsChange={setVisibleFields}
            onFieldOrderChange={setFieldOrder}
            onGroupByChange={setGroupBy}
            onDeleteRecord={deleteRecord}
            deletingIds={deletingIds}
            onRefresh={refresh}
            onUpdateRecordField={updateRecordField}
            onAddRecord={addRecord}
            onOpenDetail={onOpenDetail}
            columnWidths={columnWidths}
            onColumnWidthsChange={handleColumnWidthsChange}
            frozenFieldCount={frozenFieldCount}
            onFrozenFieldCountChange={handleFrozenFieldCountChange}
            viewId={viewId}
            page={page}
            onReorderRecords={reorderRecords}
            conditionalFormatRules={conditionalFormatRules}
            onQuickFormat={(fieldKey, value) => {
              setQuickFormatField(fieldKey);
              setQuickFormatValue(value);
            }}
            columnAggregations={columnAggregations}
            onColumnAggregationsChange={setColumnAggregations}
            onOpenFieldsConfig={handleOpenFieldsConfig}
          />
        );
      case "KANBAN":
        return (
          <KanbanView
            fields={fields}
            records={records}
            view={activeView}
            isAdmin={isAdmin}
            onPatchRecord={handlePatchRecord}
            onOpenRecord={onOpenDetail ?? (() => {})}
          />
        );
      case "GALLERY":
        return (
          <GalleryView
            fields={fields}
            records={records}
            view={activeView}
            onOpenRecord={onOpenDetail ?? (() => {})}
          />
        );
      case "TIMELINE":
        return (
          <TimelineView
            fields={fields}
            records={records}
            view={activeView}
            onOpenRecord={onOpenDetail ?? (() => {})}
            onViewOptionsChange={setViewOptions}
          />
        );
      default:
        return (
          <div className="rounded-md border flex items-center justify-center py-20 text-zinc-400 text-sm">
            未知视图类型
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ViewSelector
            tableId={tableId}
            currentViewId={viewId}
            onViewChange={switchView}
            onSaveNewView={() => setSaveDialogOpen(true)}
          />
          <FilterPanel
            fields={fields}
            filters={currentConfig.filters}
            onChange={setFilters}
          />
          {(currentConfig.filters.length > 0 || currentConfig.sortBy.length > 0 || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground"
              onClick={() => {
                setFilters([]);
                setSorts([]);
                setSearchInput("");
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              清除筛选
            </Button>
          )}
          <ConditionalFormatDialog
            fields={fields}
            rules={conditionalFormatRules}
            onChange={setConditionalFormatRules}
            quickCreateField={quickFormatField}
            quickCreateValue={quickFormatValue}
          />
          <form
            onSubmit={(event) => event.preventDefault()}
            className="flex-1 sm:flex-none"
          >
            <Input
              placeholder="搜索记录..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-9 w-full sm:w-[200px]"
            />
          </form>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <FieldConfigPopover
            fields={fields}
            visibleFields={currentConfig.visibleFields}
            fieldOrder={currentConfig.fieldOrder}
            onChange={handleFieldConfigChange}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  导出
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => window.open(`/api/data-tables/${tableId}/export`)}
              >
                导出 Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(`/api/data-tables/${tableId}/export/json`)}
              >
                导出 JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(`/api/data-tables/${tableId}/export/sql`)}
              >
                导出 SQL
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(`/api/data-tables/${tableId}/export/bundle`)}
              >
                导出关联数据
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isAdmin && (
            <Link href={`/data/${tableId}/new`}>
              <Button size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-1" />
                新建记录
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* View content */}
      {renderView()}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-zinc-500 flex-shrink-0">
        <span>共 {totalCount} 条，第 {page}/{Math.max(totalPages, 1)} 页</span>
        <div className="flex gap-2">
          <Link href={buildPageHref(page - 1)}>
            <Button variant="outline" size="sm" disabled={page <= 1}>上一页</Button>
          </Link>
          <Link href={buildPageHref(page + 1)}>
            <Button variant="outline" size="sm" disabled={page >= totalPages}>下一页</Button>
          </Link>
        </div>
      </div>

      {/* Save View Dialog */}
      <SaveViewDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        tableId={tableId}
        currentConfig={currentConfig}
        onSaved={switchView}
      />
    </div>
  );
}
