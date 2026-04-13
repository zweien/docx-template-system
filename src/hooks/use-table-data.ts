"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  AggregateType,
  ConditionalFormatRule,
  DataFieldItem,
  DataRecordItem,
  DataViewConfig,
  DataViewItem,
  FilterGroup,
  PaginatedRecords,
  SortConfig,
} from "@/types/data-table";
import { useDebouncedCallback } from "@/hooks/use-debounce";

export interface UseTableDataOptions {
  tableId: string;
  fields: DataFieldItem[];
  pageSize?: number;
}

export interface UseTableDataReturn {
  records: DataRecordItem[];
  totalCount: number;
  totalPages: number;
  isLoading: boolean;
  page: number;
  setPage: (p: number) => void;
  search: string;
  searchInput: string;
  setSearchInput: (v: string) => void;
  viewId: string | null;
  views: DataViewItem[];
  currentView: DataViewItem | null;
  switchView: (viewId: string | null) => void;
  refreshViews: () => Promise<void>;
  currentConfig: DataViewConfig;
  setFilters: (filters: FilterGroup[]) => void;
  setSorts: (sorts: SortConfig[]) => void;
  setVisibleFields: (fields: string[]) => void;
  setFieldOrder: (order: string[]) => void;
  setGroupBy: (fieldKey: string | null) => void;
  setViewOptions: (options: Record<string, unknown>) => void;
  conditionalFormatRules: ConditionalFormatRule[];
  setConditionalFormatRules: (rules: ConditionalFormatRule[]) => void;
  columnAggregations: Record<string, AggregateType>;
  setColumnAggregations: (aggregations: Record<string, AggregateType>) => void;
  deleteRecord: (recordId: string) => Promise<void>;
  deletingIds: Set<string>;
  updateRecordField: (recordId: string, fieldKey: string, value: unknown) => void;
  refresh: () => void;
}

function parsePageValue(value: string | null): number {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildTablePath(tableId: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `/data/${tableId}?${query}` : `/data/${tableId}`;
}

function buildQueryKey(
  page: number,
  pageSize: number,
  search: string,
  viewId: string | null,
  filters: FilterGroup[],
  sorts: SortConfig[]
): string {
  return JSON.stringify({
    page,
    pageSize,
    search,
    viewId,
    filters,
    sorts,
  });
}

export function useTableData({
  tableId,
  fields,
  pageSize = 20,
}: UseTableDataOptions): UseTableDataReturn {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultFieldKeys = useMemo(() => fields.map((field) => field.key), [fields]);

  const [recordsData, setRecordsData] = useState<PaginatedRecords | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [searchInputState, setSearchInputState] = useState(
    searchParams.get("search") ?? ""
  );
  const [viewId, setViewId] = useState<string | null>(
    searchParams.get("viewId") ?? null
  );
  const [page, setPageState] = useState(() =>
    parsePageValue(searchParams.get("page"))
  );
  const [views, setViews] = useState<DataViewItem[]>([]);
  const [isViewConfigReady, setIsViewConfigReady] = useState(
    () => searchParams.get("viewId") === null
  );
  const [filters, setFiltersState] = useState<FilterGroup[]>([]);
  const [sorts, setSortsState] = useState<SortConfig[]>([]);
  const [visibleFields, setVisibleFieldsState] = useState<string[]>(() => [
    ...defaultFieldKeys,
  ]);
  const [fieldOrder, setFieldOrderState] = useState<string[]>(() => [
    ...defaultFieldKeys,
  ]);
  const [groupBy, setGroupByState] = useState<string | null>(null);
  const [viewOptions, setViewOptionsState] = useState<Record<string, unknown>>({});
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [refreshTick, setRefreshTick] = useState(0);
  const [columnAggregations, setColumnAggregationsState] = useState<Record<string, AggregateType>>({});
  const latestFetchIdRef = useRef(0);

  const currentQueryKey = useMemo(
    () => buildQueryKey(page, pageSize, search, viewId, filters, sorts),
    [filters, page, pageSize, search, sorts, viewId]
  );
  const latestQueryKeyRef = useRef(currentQueryKey);

  useEffect(() => {
    latestQueryKeyRef.current = currentQueryKey;
  }, [currentQueryKey]);

  const syncUrlQuery = useCallback(
    (
      nextQuery: Partial<{
        page: number;
        search: string;
        viewId: string | null;
      }>,
      mode: "push" | "replace"
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      if (Object.hasOwn(nextQuery, "search")) {
        const nextSearch = nextQuery.search ?? "";
        if (nextSearch) {
          params.set("search", nextSearch);
        } else {
          params.delete("search");
        }
      }

      if (Object.hasOwn(nextQuery, "viewId")) {
        const nextViewId = nextQuery.viewId;
        if (nextViewId) {
          params.set("viewId", nextViewId);
        } else {
          params.delete("viewId");
        }
      }

      if (Object.hasOwn(nextQuery, "page")) {
        const nextPage = nextQuery.page ?? 1;
        if (nextPage > 1) {
          params.set("page", String(nextPage));
        } else {
          params.delete("page");
        }
      }

      const href = buildTablePath(tableId, params);
      if (mode === "replace") {
        router.replace(href, { scroll: false });
        return;
      }
      router.push(href, { scroll: false });
    },
    [router, searchParams, tableId]
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const normalizedPage = Number.isFinite(nextPage)
        ? Math.max(1, Math.trunc(nextPage))
        : 1;
      setPageState(normalizedPage);
      syncUrlQuery({ page: normalizedPage }, "push");
    },
    [syncUrlQuery]
  );

  const debouncedSyncSearch = useDebouncedCallback((value: unknown) => {
    const nextSearch = String(value ?? "");
    setSearch(nextSearch);
    setPageState(1);
    syncUrlQuery({ search: nextSearch, page: 1 }, "replace");
  }, 300);

  const setSearchInput = useCallback(
    (value: string) => {
      setSearchInputState(value);
      debouncedSyncSearch(value);
    },
    [debouncedSyncSearch]
  );

  const switchView = useCallback(
    (nextViewId: string | null) => {
      latestFetchIdRef.current += 1;
      setIsViewConfigReady(nextViewId === null);
      setIsLoading(true);
      setViewId(nextViewId);
      setPageState(1);
      syncUrlQuery({ viewId: nextViewId, page: 1 }, "push");
    },
    [syncUrlQuery]
  );

  const refreshViews = useCallback(async () => {
    try {
      const response = await fetch(`/api/data-tables/${tableId}/views`);
      if (!response.ok) return;

      const result = (await response.json()) as {
        success?: boolean;
        data?: DataViewItem[];
      };
      if (result.success && Array.isArray(result.data)) {
        setViews(result.data);
      }
    } catch {
      // 视图列表加载失败时沿用已有状态
    }
  }, [tableId]);

  const refresh = useCallback(() => {
    setRefreshTick((value) => value + 1);
  }, []);

  const updateRecordField = useCallback(
    (recordId: string, fieldKey: string, value: unknown) => {
      setRecordsData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          records: prev.records.map((record) =>
            record.id === recordId
              ? { ...record, data: { ...record.data, [fieldKey]: value } }
              : record
          ),
        };
      });
    },
    []
  );

  const setFilters = useCallback((nextFilters: FilterGroup[]) => {
    setFiltersState(nextFilters);
  }, []);

  const setSorts = useCallback((nextSorts: SortConfig[]) => {
    setSortsState(nextSorts);
  }, []);

  const setVisibleFields = useCallback((nextFields: string[]) => {
    setVisibleFieldsState(nextFields);
  }, []);

  const setFieldOrder = useCallback((nextOrder: string[]) => {
    setFieldOrderState(nextOrder);
  }, []);

  const setGroupBy = useCallback((nextGroupBy: string | null) => {
    setGroupByState(nextGroupBy);
  }, []);

  useEffect(() => {
    const nextViewId = searchParams.get("viewId") ?? null;
    const isViewChanged = nextViewId !== viewId;

    setSearch(searchParams.get("search") ?? "");
    setSearchInputState(searchParams.get("search") ?? "");
    if (isViewChanged) {
      latestFetchIdRef.current += 1;
    }
    if (nextViewId === null) {
      setIsViewConfigReady(true);
    } else if (isViewChanged) {
      setIsViewConfigReady(false);
      setIsLoading(true);
    }
    setViewId(nextViewId);
    setPageState(parsePageValue(searchParams.get("page")));
  }, [searchParams, viewId]);

  useEffect(() => {
    void refreshViews();
  }, [refreshViews]);

  useEffect(() => {
    if (!viewId) {
      setFiltersState([]);
      setSortsState([]);
      setVisibleFieldsState([...defaultFieldKeys]);
      setFieldOrderState([...defaultFieldKeys]);
      setGroupByState(null);
      setViewOptionsState({});
      setIsViewConfigReady(true);
      return;
    }

    let cancelled = false;
    latestFetchIdRef.current += 1;
    setIsViewConfigReady(false);
    setIsLoading(true);
    setFiltersState([]);
    setSortsState([]);
    setVisibleFieldsState([...defaultFieldKeys]);
    setFieldOrderState([...defaultFieldKeys]);
    setGroupByState(null);
    setViewOptionsState({});

    async function loadView() {
      try {
        const response = await fetch(
          `/api/data-tables/${tableId}/views/${viewId}`
        );
        if (!response.ok) return;

        const result = (await response.json()) as {
          success?: boolean;
          data?: DataViewItem;
        };

        if (cancelled || !result.success || !result.data) return;

        const view = result.data;
        setFiltersState(view.filters ?? []);
        setSortsState(view.sortBy ?? []);
        setVisibleFieldsState(
          view.visibleFields?.length ? view.visibleFields : [...defaultFieldKeys]
        );
        setFieldOrderState(
          view.fieldOrder?.length ? view.fieldOrder : [...defaultFieldKeys]
        );
        setGroupByState(view.groupBy ?? null);
        setViewOptionsState(view.viewOptions ?? {});
        setColumnAggregationsState((view.viewOptions as Record<string, unknown>)?.columnAggregations as Record<string, AggregateType> ?? {});
      } catch {
        // 视图配置加载失败时保留当前配置
      } finally {
        if (!cancelled) {
          setIsViewConfigReady(true);
        }
      }
    }

    void loadView();
    return () => {
      cancelled = true;
    };
  }, [defaultFieldKeys, tableId, viewId]);

  const fetchData = useCallback(async () => {
    if (!isViewConfigReady) return;

    const fetchId = latestFetchIdRef.current + 1;
    latestFetchIdRef.current = fetchId;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (search) params.set("search", search);
      if (viewId) params.set("viewId", viewId);
      // Only send filter groups that have valid conditions (non-empty fieldKey)
      const validFilters = filters
        .map(g => ({
          ...g,
          conditions: g.conditions.filter(c => c.fieldKey),
        }))
        .filter(g => g.conditions.length > 0);
      if (validFilters.length > 0) {
        params.set("filterConditions", JSON.stringify(validFilters));
      }
      if (sorts.length > 0) {
        params.set("sortBy", JSON.stringify(sorts));
      }

      const response = await fetch(
        `/api/data-tables/${tableId}/records?${params.toString()}`
      );
      const result = (await response.json()) as PaginatedRecords;

      if (response.ok && fetchId === latestFetchIdRef.current) {
        setRecordsData(result);
      }
    } catch (error) {
      console.error("获取记录失败:", error);
    } finally {
      if (fetchId === latestFetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    filters,
    isViewConfigReady,
    page,
    pageSize,
    search,
    sorts,
    tableId,
    viewId,
  ]);

  useEffect(() => {
    void fetchData();
  }, [fetchData, refreshTick]);

  const deleteRecord = useCallback(
    async (recordId: string) => {
      if (!confirm("确定要删除这条记录吗？")) return;
      if (deletingIds.has(recordId)) return;

      const recordIndex =
        recordsData?.records.findIndex((record) => record.id === recordId) ?? -1;
      const recordToDelete =
        recordIndex >= 0 ? recordsData?.records[recordIndex] ?? null : null;
      if (!recordToDelete) return;

      const rollbackQueryKey = latestQueryKeyRef.current;

      setDeletingIds((prev) => new Set(prev).add(recordId));
      setRecordsData((prev) =>
        prev
          ? {
              ...prev,
              records: prev.records.filter((record) => record.id !== recordId),
              total: prev.total - 1,
            }
          : null
      );

      try {
        const response = await fetch(
          `/api/data-tables/${tableId}/records/${recordId}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          throw new Error("删除失败");
        }
      } catch (error) {
        if (latestQueryKeyRef.current === rollbackQueryKey) {
          setRecordsData((prev) => {
            if (!prev) return prev;
            if (prev.records.some((record) => record.id === recordToDelete.id)) {
              return prev;
            }

            const nextRecords = [...prev.records];
            nextRecords.splice(
              Math.min(Math.max(recordIndex, 0), nextRecords.length),
              0,
              recordToDelete
            );

            return {
              ...prev,
              records: nextRecords,
              total: prev.total + 1,
            };
          });
        } else {
          refresh();
        }
        console.error("删除失败:", error);
        alert("删除失败，请重试");
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(recordId);
          return next;
        });
      }
    },
    [deletingIds, recordsData, refresh, tableId]
  );

  const currentConfig = useMemo<DataViewConfig>(
    () => ({
      filters,
      sortBy: sorts,
      visibleFields,
      fieldOrder,
      groupBy,
      viewOptions,
    }),
    [fieldOrder, filters, groupBy, sorts, viewOptions, visibleFields]
  );

  const currentView = useMemo(
    () => views.find((view) => view.id === viewId) ?? null,
    [viewId, views]
  );

  const conditionalFormatRules: ConditionalFormatRule[] = useMemo(
    () => (currentConfig.viewOptions.conditionalFormatting as ConditionalFormatRule[]) ?? [],
    [currentConfig.viewOptions.conditionalFormatting],
  );

  const setConditionalFormatRules = useCallback(
    (rules: ConditionalFormatRule[]) => {
      setViewOptionsState({ ...currentConfig.viewOptions, conditionalFormatting: rules });
    },
    [currentConfig.viewOptions, setViewOptionsState],
  );

  const setColumnAggregations = useCallback((aggregations: Record<string, AggregateType>) => {
    setColumnAggregationsState(aggregations);
  }, []);

  return {
    records: recordsData?.records ?? [],
    totalCount: recordsData?.total ?? 0,
    totalPages: recordsData?.totalPages ?? 1,
    isLoading,
    page,
    setPage,
    search,
    searchInput: searchInputState,
    setSearchInput,
    viewId,
    views,
    currentView,
    switchView,
    refreshViews,
    currentConfig,
    setFilters,
    setSorts,
    setVisibleFields,
    setFieldOrder,
    setGroupBy,
    setViewOptions: setViewOptionsState,
    conditionalFormatRules,
    setConditionalFormatRules,
    columnAggregations,
    setColumnAggregations,
    deleteRecord,
    deletingIds,
    updateRecordField,
    refresh,
  };
}
