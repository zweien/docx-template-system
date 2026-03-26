"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import type {
  DataFieldItem,
  PaginatedRecords,
  FilterCondition,
  SortConfig,
  DataViewConfig,
} from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { ColumnHeader } from "@/components/data/column-header";
import { FieldConfigPopover } from "@/components/data/field-config-popover";
import { ViewSelector } from "@/components/data/view-selector";
import { SaveViewDialog } from "@/components/data/save-view-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useDebouncedCallback } from "@/hooks/use-debounce";

interface RecordTableProps {
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
}

export function RecordTable({ tableId, fields, isAdmin }: RecordTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaginatedRecords | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") ?? "");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // 防抖搜索 - 300ms 后触发，同时重置页码
  const debouncedSetSearch = useDebouncedCallback(
    (value: unknown) => {
      const v = value as string;
      setSearch(v);
      // 搜索时重置页码到第 1 页
      const params = new URLSearchParams(searchParams.toString());
      if (v) {
        params.set("search", v);
      } else {
        params.delete("search");
      }
      params.delete("page");
      router.replace(`/data/${tableId}?${params.toString()}`, { scroll: false });
    },
    300
  );

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSetSearch(value);
  };

  // View state
  const [viewId, setViewId] = useState<string | null>(
    searchParams.get("viewId") ?? null
  );
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sortBy, setSortBy] = useState<SortConfig | null>(null);
  const [visibleFields, setVisibleFields] = useState<string[]>(() =>
    fields.map((f) => f.key)
  );
  const [fieldOrder, setFieldOrder] = useState<string[]>(() =>
    fields.map((f) => f.key)
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 20;

  // Ordered visible fields for rendering
  const orderedVisibleFields = useMemo(
    () => fieldOrder.filter((key) => visibleFields.includes(key)),
    [fieldOrder, visibleFields]
  );

  // Load view config when viewId changes
  useEffect(() => {
    if (!viewId) {
      setFilters([]);
      setSortBy(null);
      setVisibleFields(fields.map((f) => f.key));
      setFieldOrder(fields.map((f) => f.key));
      return;
    }

    let cancelled = false;
    async function loadView() {
      try {
        const res = await fetch(`/api/data-tables/${tableId}/views/${viewId}`);
        if (!res.ok) return;
        const result = await res.json();
        if (!cancelled && result.success) {
          const view = result.data;
          setFilters(view.filters ?? []);
          setSortBy(view.sortBy ?? null);
          if (view.visibleFields?.length) {
            setVisibleFields(view.visibleFields);
          }
          if (view.fieldOrder?.length) {
            setFieldOrder(view.fieldOrder);
          }
        }
      } catch {
        // Silently fail
      }
    }

    loadView();
    return () => {
      cancelled = true;
    };
  }, [viewId, tableId, fields]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (viewId) params.set("viewId", viewId);
      if (filters.length > 0)
        params.set("filterConditions", JSON.stringify(filters));
      if (sortBy) params.set("sortBy", JSON.stringify(sortBy));

      const response = await fetch(
        `/api/data-tables/${tableId}/records?${params}`
      );
      const result = await response.json();

      if (response.ok) {
        setData(result);
      }
    } catch (error) {
      console.error("获取记录失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tableId, page, search, viewId, filters, sortBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync view state to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (viewId) {
      params.set("viewId", viewId);
    } else {
      params.delete("viewId");
    }
    const newUrl = `/data/${tableId}?${params.toString()}`;
    // Only update if different to avoid loops
    const currentUrl = `/data/${tableId}?${searchParams.toString()}`;
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [viewId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (viewId) params.set("viewId", viewId);
    router.push(`/data/${tableId}?${params.toString()}`);
  };

  const handleViewChange = (newViewId: string | null) => {
    setViewId(newViewId);
    // Reset page when switching views
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (newViewId) params.set("viewId", newViewId);
    router.push(`/data/${tableId}?${params.toString()}`);
  };

  const handleFilterChange = useCallback(
    (filter: FilterCondition | null, fieldKey: string) => {
      setFilters((prev) => {
        const rest = prev.filter((f) => f.fieldKey !== fieldKey);
        return filter ? [...rest, filter] : rest;
      });
    },
    []
  );

  const handleSortChange = useCallback((sort: SortConfig | null) => {
    setSortBy(sort);
  }, []);

  const handleFieldConfigChange = (
    newVisibleFields: string[],
    newFieldOrder: string[]
  ) => {
    setVisibleFields(newVisibleFields);
    setFieldOrder(newFieldOrder);
  };

  const handleSaveView = () => {
    setSaveDialogOpen(true);
  };

  const handleViewSaved = (savedViewId: string) => {
    setViewId(savedViewId);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("viewId", savedViewId);
    router.push(`/data/${tableId}?${params.toString()}`);
  };

  const currentConfig = useMemo<DataViewConfig>(
    () => ({
      filters,
      sortBy,
      visibleFields,
      fieldOrder,
    }),
    [filters, sortBy, visibleFields, fieldOrder]
  );

  const handleDelete = async (recordId: string) => {
    if (!confirm("确定要删除这条记录吗？")) return;
    if (deletingIds.has(recordId)) return;

    // 乐观删除：立即从 UI 移除
    const recordToDelete = data?.records.find(r => r.id === recordId);
    if (!recordToDelete) return;

    // 标记正在删除
    setDeletingIds(prev => new Set(prev).add(recordId));

    // 立即更新 UI
    setData(prev => prev ? {
      ...prev,
      records: prev.records.filter(r => r.id !== recordId),
      total: prev.total - 1,
    } : null);

    try {
      const response = await fetch(
        `/api/data-tables/${tableId}/records/${recordId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("删除失败");
      }
    } catch (error) {
      // 回滚：将被删除的记录恢复到当前位置
      setData(prev => prev ? {
        ...prev,
        records: [...prev.records, recordToDelete],
        total: prev.total + 1,
      } : null);
      console.error("删除失败:", error);
      alert("删除失败，请重试");
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  };

  const formatCellValue = (
    field: DataFieldItem,
    value: unknown
  ): React.ReactNode => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-zinc-400">-</span>;
    }

    switch (field.type) {
      case FieldType.NUMBER:
        return typeof value === "number"
          ? value.toLocaleString()
          : String(value);
      case FieldType.DATE:
        try {
          const date = new Date(value as string);
          return date.toLocaleDateString("zh-CN");
        } catch {
          return String(value);
        }
      case FieldType.SELECT:
        return <Badge variant="secondary">{String(value)}</Badge>;
      case FieldType.MULTISELECT:
        if (Array.isArray(value)) {
          return (
            <div className="flex flex-wrap gap-1">
              {value.map((v, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {v}
                </Badge>
              ))}
            </div>
          );
        }
        return String(value);
      case FieldType.EMAIL:
        return (
          <a
            href={`mailto:${value}`}
            className="text-blue-600 hover:underline"
          >
            {String(value)}
          </a>
        );
      case FieldType.PHONE:
        return <span className="font-mono">{String(value)}</span>;
      case FieldType.RELATION:
        const displayValue =
          (value as Record<string, unknown>)?.display ?? value;
        return <Badge variant="outline">{String(displayValue)}</Badge>;
      default:
        return String(value);
    }
  };

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

  const colCount = orderedVisibleFields.length + 1; // +1 for actions

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <ViewSelector
            tableId={tableId}
            currentViewId={viewId}
            onViewChange={handleViewChange}
            onSaveNewView={handleSaveView}
          />
          <form onSubmit={handleSearch} className="flex-1 sm:flex-none">
            <Input
              placeholder="搜索记录..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-9 w-full sm:w-[200px]"
            />
          </form>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <FieldConfigPopover
            fields={fields}
            visibleFields={visibleFields}
            fieldOrder={fieldOrder}
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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {orderedVisibleFields.map((fieldKey) => {
                const field = fields.find((f) => f.key === fieldKey);
                if (!field) return null;
                return (
                  <TableHead key={field.id}>
                    <ColumnHeader
                      field={field}
                      filter={
                        filters.find((f) => f.fieldKey === fieldKey) ?? null
                      }
                      sort={
                        sortBy?.fieldKey === fieldKey ? sortBy : null
                      }
                      onFilterChange={(filter) =>
                        handleFilterChange(filter, fieldKey)
                      }
                      onSortChange={handleSortChange}
                    />
                  </TableHead>
                );
              })}
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="p-0 border-0"
                >
                  <TableSkeleton rows={5} columns={orderedVisibleFields.length} />
                </TableCell>
              </TableRow>
            ) : !data || data.records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-center py-8"
                >
                  暂无记录
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((record) => (
                <TableRow key={record.id}>
                  {orderedVisibleFields.map((fieldKey) => {
                    const field = fields.find((f) => f.key === fieldKey);
                    if (!field) return null;
                    return (
                      <TableCell
                        key={field.id}
                        className="max-w-[200px] truncate"
                      >
                        {formatCellValue(
                          field,
                          record.data[field.key]
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <div className="flex gap-1">
                      {isAdmin && (
                        <>
                          <Link
                            href={`/data/${tableId}/${record.id}/edit`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                            >
                              编辑
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-red-600"
                            onClick={() => handleDelete(record.id)}
                            disabled={deletingIds.has(record.id)}
                          >
                            {deletingIds.has(record.id)
                              ? "删除中..."
                              : "删除"}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>共 {data.total} 条记录</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/data/${tableId}?page=${page - 1}${search ? `&search=${search}` : ""}${viewId ? `&viewId=${viewId}` : ""}`}
              >
                <Button variant="outline" size="sm">
                  上一页
                </Button>
              </Link>
            )}
            {page < data.totalPages && (
              <Link
                href={`/data/${tableId}?page=${page + 1}${search ? `&search=${search}` : ""}${viewId ? `&viewId=${viewId}` : ""}`}
              >
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
        onSaved={handleViewSaved}
      />
    </div>
  );
}
