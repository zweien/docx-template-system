"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import type {
  DataFieldItem,
  FilterCondition,
  SortConfig,
} from "@/types/data-table";
import type { ViewType } from "@/types/data-table";
import { FieldConfigPopover } from "@/components/data/field-config-popover";
import { ViewSelector } from "@/components/data/view-selector";
import { SaveViewDialog } from "@/components/data/save-view-dialog";
import { useTableData } from "@/hooks/use-table-data";
import { GridView } from "@/components/data/views/grid-view";

// ─── Props ──────────────────────────────────────────────────────────────────

interface RecordTableProps {
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
  viewType?: ViewType;
  onOpenDetail?: (recordId: string) => void;
}

// ─── Placeholder for unsupported views ──────────────────────────────────────

function PlaceholderView({ label }: { label: string }) {
  return (
    <div className="rounded-md border flex items-center justify-center py-20 text-zinc-400 text-sm">
      {label} 视图即将支持
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function RecordTable({
  tableId,
  fields,
  isAdmin,
  viewType = "GRID",
  onOpenDetail,
}: RecordTableProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
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
    currentConfig,
    setFilters,
    setSorts,
    setVisibleFields,
    setFieldOrder,
    setGroupBy,
    deleteRecord,
    deletingIds,
    switchView,
    refresh,
  } = useTableData({ tableId, fields });

  // ── Filter change handler ────────────────────────────────────────────────
  const handleFilterChange = useCallback(
    (filter: FilterCondition | null, fieldKey: string) => {
      const nextFilters = currentConfig.filters.filter(
        (item) => item.fieldKey !== fieldKey
      );
      if (filter) {
        nextFilters.push(filter);
      }
      setFilters(nextFilters);
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

  // ── Field config change handler ──────────────────────────────────────────
  const handleFieldConfigChange = useCallback(
    (nextVisibleFields: string[], nextFieldOrder: string[]) => {
      setVisibleFields(nextVisibleFields);
      setFieldOrder(nextFieldOrder);
    },
    [setVisibleFields, setFieldOrder]
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
            onVisibleFieldsChange={setVisibleFields}
            onFieldOrderChange={setFieldOrder}
            onGroupByChange={setGroupBy}
            onDeleteRecord={deleteRecord}
            deletingIds={deletingIds}
            onRefresh={refresh}
            onOpenDetail={onOpenDetail}
          />
        );
      case "KANBAN":
        return <PlaceholderView label="看板" />;
      case "GALLERY":
        return <PlaceholderView label="画廊" />;
      case "TIMELINE":
        return <PlaceholderView label="时间线" />;
      default:
        return <PlaceholderView label="未知" />;
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ViewSelector
            tableId={tableId}
            currentViewId={viewId}
            onViewChange={switchView}
            onSaveNewView={() => setSaveDialogOpen(true)}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>共 {totalCount} 条记录</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildPageHref(page - 1)}>
                <Button variant="outline" size="sm">
                  上一页
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildPageHref(page + 1)}>
                <Button variant="outline" size="sm">
                  下一页
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

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
