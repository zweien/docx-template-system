"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowUpDown, Download, Plus, X, Activity } from "lucide-react";
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
import { ViewSwitcher } from "@/components/data/view-switcher";
import { SaveViewDialog } from "@/components/data/save-view-dialog";
import { KeyboardShortcutsDialog } from "@/components/data/views/keyboard-shortcuts-dialog";
import { useTableData } from "@/hooks/use-table-data";
import { GridView } from "@/components/data/views/grid-view";
import { KanbanView } from "@/components/data/views/kanban/kanban-view";
import { GalleryView } from "@/components/data/views/gallery/gallery-view";
import { TimelineView } from "@/components/data/views/timeline/timeline-view";
import { CalendarView } from "@/components/data/views/calendar/calendar-view";
import { FormView } from "@/components/data/views/form/form-view";
import { ActivityStream } from "@/components/data/activity-stream";
import { OnlinePresenceBar } from "@/components/data/online-presence-bar";

// ─── Props ──────────────────────────────────────────────────────────────────

interface RecordTableProps {
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
  onOpenDetail?: (recordId: string) => void;
  onOpenEdit?: (recordId: string) => void;
  onRecordIdsChange?: (ids: string[]) => void;
  refreshSignal?: number;
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
  onOpenDetail,
  onOpenEdit,
  onRecordIdsChange,
  refreshSignal,
}: RecordTableProps) {
  const router = useRouter();
  const [viewType, setViewType] = useState<ViewType>("GRID");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [quickFormatField, setQuickFormatField] = useState<string | undefined>();
  const [quickFormatValue, setQuickFormatValue] = useState<string | undefined>();
  const [showActivity, setShowActivity] = useState(false);
  const lastSyncedRecordIdsRef = useRef<string[]>([]);
  const lastRefreshSignalRef = useRef(refreshSignal);
  const {
    records,
    totalCount,
    isLoading,
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
    removeRecord,
    switchView,
    refresh,
    isConnected,
    activityFeed,
    onlineUsers,
    cellLocks,
    acquireCellLock,
    releaseCellLock,
    isCellLockedByOther,
    getLockOwner,
    broadcastCursor,
    myColor,
    onLockLost,
    cursorPositions,
  } = useTableData({ tableId, fields });

  useEffect(() => {
    if (refreshSignal === undefined || lastRefreshSignalRef.current === refreshSignal) {
      return;
    }

    lastRefreshSignalRef.current = refreshSignal;
    refresh();
  }, [refresh, refreshSignal]);

  // Sync record IDs to parent for drawer navigation
  useEffect(() => {
    if (!onRecordIdsChange) return;

    const nextIds = records.map((record: { id: string }) => record.id);
    const prevIds = lastSyncedRecordIdsRef.current;
    const isSame =
      prevIds.length === nextIds.length &&
      prevIds.every((id, index) => id === nextIds[index]);

    if (isSame) return;

    lastSyncedRecordIdsRef.current = nextIds;
    onRecordIdsChange(nextIds);
  }, [records, onRecordIdsChange]);

  const activeView = useMemo(() => {
    const base = currentView ?? buildFallbackView(tableId, fields);
    return { ...base, viewOptions: currentConfig.viewOptions };
  }, [currentConfig.viewOptions, currentView, tableId, fields]);

  // Sync viewType from loaded view
  useEffect(() => {
    if (currentView?.type && currentView.type !== viewType) {
      setViewType(currentView.type as ViewType);
    }
  }, [viewId, currentView?.type, viewType]);

  // Fallback sync: when URL carries a viewId but view list lags,
  // fetch view detail directly to ensure correct renderer.
  useEffect(() => {
    if (!viewId) return;
    let cancelled = false;

    void fetch(`/api/data-tables/${tableId}/views/${viewId}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { success?: boolean; data?: DataViewItem };
        return data.success ? data.data : null;
      })
      .then((view) => {
        if (!cancelled && view?.type && view.type !== viewType) {
          setViewType(view.type as ViewType);
        }
      })
      .catch(() => {
        // Ignore fallback sync failures and keep current UI state.
      });

    return () => {
      cancelled = true;
    };
  }, [tableId, viewId, viewType]);

  // Fallback sync: when URL carries a viewId but view list lags,
  // fetch view detail directly to ensure correct renderer.
  useEffect(() => {
    if (!viewId) return;
    let cancelled = false;

    void fetch(`/api/data-tables/${tableId}/views/${viewId}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { success?: boolean; data?: DataViewItem };
        return data.success ? data.data : null;
      })
      .then((view) => {
        if (!cancelled && view?.type) {
          setViewType(view.type as ViewType);
        }
      })
      .catch(() => {
        // Ignore fallback sync failures and keep current UI state.
      });

    return () => {
      cancelled = true;
    };
  }, [tableId, viewId]);

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

  // ── Fetch related table fields for cross-table filter/sort ────────────
  const handleFetchRelatedFields = useCallback(async (targetTableId: string) => {
    try {
      const res = await fetch(`/api/data-tables/${targetTableId}/fields`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }, []);

  // ── Frozen fields ──────────────────────────────────────────────────────
  const frozenFieldCount = (currentConfig.viewOptions.frozenFieldCount as number) ?? 0;

  const handleFrozenFieldCountChange = useCallback(
    (count: number) => {
      setViewOptions({ ...currentConfig.viewOptions, frozenFieldCount: count });
    },
    [currentConfig.viewOptions, setViewOptions]
  );

  const rowHeight = (currentConfig.viewOptions.rowHeight as number) ?? 40;

  const handleRowHeightChange = useCallback(
    (h: number) => {
      setViewOptions({ ...currentConfig.viewOptions, rowHeight: h });
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

  // ── Record count ──────────────────────────────────────────────────────

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
            onRemoveRecord={removeRecord}
            onOpenDetail={onOpenDetail}
            columnWidths={columnWidths}
            onColumnWidthsChange={handleColumnWidthsChange}
            frozenFieldCount={frozenFieldCount}
            onFrozenFieldCountChange={handleFrozenFieldCountChange}
            viewId={viewId}
            onReorderRecords={reorderRecords}
            conditionalFormatRules={conditionalFormatRules}
            onQuickFormat={(fieldKey, value) => {
              setQuickFormatField(fieldKey);
              setQuickFormatValue(value);
            }}
            columnAggregations={columnAggregations}
            onColumnAggregationsChange={setColumnAggregations}
            onOpenFieldsConfig={handleOpenFieldsConfig}
            rowHeight={rowHeight}
            onFetchRelatedFields={handleFetchRelatedFields}
            cellLocks={cellLocks}
            isCellLockedByOther={isCellLockedByOther}
            getLockOwner={getLockOwner}
            acquireCellLock={acquireCellLock}
            releaseCellLock={releaseCellLock}
            broadcastCursor={broadcastCursor}
            myColor={myColor}
            onLockLost={onLockLost}
            cursorPositions={cursorPositions}
          />
        );
      case "KANBAN":
        return (
          <KanbanView
            fields={fields}
            records={records}
            view={activeView}
            isAdmin={isAdmin}
            tableId={tableId}
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
            tableId={tableId}
            fields={fields}
            records={records}
            view={activeView}
            onOpenRecord={onOpenDetail ?? (() => {})}
            onPatchRecord={handlePatchRecord}
            onViewOptionsChange={setViewOptions}
          />
        );
      case "FORM":
        return (
          <FormView
            fields={fields}
            view={activeView}
            onViewOptionsChange={setViewOptions}
            tableId={tableId}
          />
        );
      case "CALENDAR":
        return (
          <CalendarView
            fields={fields}
            records={records}
            view={activeView}
            isAdmin={isAdmin}
            tableId={tableId}
            onPatchRecord={handlePatchRecord}
            onOpenRecord={onOpenDetail ?? (() => {})}
            onOpenCreatedRecord={onOpenEdit ?? onOpenDetail ?? (() => {})}
            onRecordCreated={refresh}
            onViewOptionsChange={setViewOptions}
          />
        );
      default:
        return (
          <div className="rounded-md border flex items-center justify-center py-20 text-sm text-muted-foreground">
            未知视图类型
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-card/70 p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <ViewSelector
            tableId={tableId}
            currentViewId={viewId}
            onViewChange={switchView}
            onSaveNewView={() => setSaveDialogOpen(true)}
          />
          <ViewSwitcher currentType={viewType} onTypeChange={setViewType} />
          <FilterPanel
            fields={fields}
            filters={currentConfig.filters}
            onChange={setFilters}
          />
          {(currentConfig.filters.length > 0 || currentConfig.sortBy.length > 0 || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFilters([]);
                setSorts([]);
                setSearchInput("");
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              清除
            </Button>
          )}
          <div className="hidden sm:block">
            <ConditionalFormatDialog
              fields={fields}
              rules={conditionalFormatRules}
              onChange={setConditionalFormatRules}
              quickCreateField={quickFormatField}
              quickCreateValue={quickFormatValue}
            />
          </div>
          <form
            onSubmit={(event) => event.preventDefault()}
            className="flex-1 sm:flex-none min-w-0"
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
          <div className="hidden sm:block">
            <KeyboardShortcutsDialog />
          </div>
          <div className="hidden sm:block">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-4 w-4 mr-1" />
                行高
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {([
                  [24, "紧凑"],
                  [32, "标准"],
                  [40, "宽松"],
                  [56, "超高"],
                ] as const).map(([h, label]) => (
                  <DropdownMenuItem
                    key={h}
                    onClick={() => handleRowHeightChange(h)}
                    className={rowHeight === h ? "bg-[rgb(113_112_255_/_0.14)] font-[510]" : ""}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="hidden sm:block">
            <FieldConfigPopover
              fields={fields}
              visibleFields={currentConfig.visibleFields}
              fieldOrder={currentConfig.fieldOrder}
              onChange={handleFieldConfigChange}
            />
          </div>
          <div className="hidden sm:block">
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
          </div>
          {isAdmin && (
            <Link href={`/data/${tableId}/new`}>
              <Button size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-1" />
                新建记录
              </Button>
            </Link>
          )}
          <OnlinePresenceBar users={onlineUsers} />
          <Button
            variant={showActivity ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowActivity(!showActivity)}
          >
            <Activity className="h-4 w-4 mr-1" />
            动态
            {isConnected && (
              <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
            )}
          </Button>
        </div>
      </div>

      {/* View content + Activity panel */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          {renderView()}
        </div>
        {showActivity && (
          <ActivityStream tableId={tableId} liveActivities={activityFeed} />
        )}
      </div>

      {/* Record count */}
      {!isLoading && (
        <div className="flex-shrink-0 text-sm text-muted-foreground">
          共 {totalCount} 条
        </div>
      )}

      {/* Save View Dialog */}
      <SaveViewDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        tableId={tableId}
        currentConfig={currentConfig}
        viewType={viewType}
        onSaved={switchView}
      />
    </div>
  );
}
