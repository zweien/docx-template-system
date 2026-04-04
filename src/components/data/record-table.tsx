"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { Plus } from "lucide-react";
import type { DataFieldItem, FilterCondition, SortConfig } from "@/types/data-table";
import { ColumnHeader } from "@/components/data/column-header";
import { FieldConfigPopover } from "@/components/data/field-config-popover";
import { ViewSelector } from "@/components/data/view-selector";
import { SaveViewDialog } from "@/components/data/save-view-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useTableData } from "@/hooks/use-table-data";
import { formatCellValue } from "@/lib/format-cell";

interface RecordTableProps {
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
}

export function RecordTable({ tableId, fields, isAdmin }: RecordTableProps) {
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
    deleteRecord,
    deletingIds,
    switchView,
  } = useTableData({ tableId, fields });

  const fieldMap = useMemo(
    () => new Map(fields.map((field) => [field.key, field])),
    [fields]
  );

  const orderedVisibleFields = useMemo(
    () =>
      currentConfig.fieldOrder
        .filter((fieldKey) => currentConfig.visibleFields.includes(fieldKey))
        .map((fieldKey) => fieldMap.get(fieldKey))
        .filter((field): field is DataFieldItem => field !== undefined),
    [currentConfig.fieldOrder, currentConfig.visibleFields, fieldMap]
  );

  const handleFilterChange = (
    filter: FilterCondition | null,
    fieldKey: string
  ) => {
    const nextFilters = currentConfig.filters.filter(
      (item) => item.fieldKey !== fieldKey
    );
    if (filter) {
      nextFilters.push(filter);
    }
    setFilters(nextFilters);
  };

  const handleSortChange = (sort: SortConfig | null) => {
    if (!sort) {
      setSorts([]);
      return;
    }

    setSorts([
      ...currentConfig.sortBy.filter(
        (sortItem) => sortItem.fieldKey !== sort.fieldKey
      ),
      sort,
    ]);
  };

  const handleFieldConfigChange = (
    nextVisibleFields: string[],
    nextFieldOrder: string[]
  ) => {
    setVisibleFields(nextVisibleFields);
    setFieldOrder(nextFieldOrder);
  };

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

  const colCount = orderedVisibleFields.length + 1;

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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {orderedVisibleFields.map((field) => (
                <TableHead key={field.id}>
                  <ColumnHeader
                    field={field}
                    filter={
                      currentConfig.filters.find(
                        (filter) => filter.fieldKey === field.key
                      ) ?? null
                    }
                    sort={
                      currentConfig.sortBy.find(
                        (sortItem) => sortItem.fieldKey === field.key
                      ) ?? null
                    }
                    onFilterChange={(filter) =>
                      handleFilterChange(filter, field.key)
                    }
                    onSortChange={handleSortChange}
                  />
                </TableHead>
              ))}
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
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="text-center py-8"
                >
                  暂无记录
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id}>
                  {orderedVisibleFields.map((field) => (
                    <TableCell
                      key={field.id}
                      className="max-w-[200px] truncate"
                    >
                      {formatCellValue(field, record.data[field.key])}
                    </TableCell>
                  ))}
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
                            onClick={() => void deleteRecord(record.id)}
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
