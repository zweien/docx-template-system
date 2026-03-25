"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Link2 } from "lucide-react";
import { RecordFilter, type ActiveFilter } from "@/components/data/record-filter";
import type { DataTableListItem, DataFieldItem, PaginatedRecords } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

interface Step1SelectDataProps {
  templateId?: string;
  selectedTableId: string | null;
  selectedRecordIds: string[];
  linkedDataTableId?: string | null;
  onTableSelect: (tableId: string) => void;
  onRecordsSelect: (recordIds: string[]) => void;
  onNext: () => void;
}

export function Step1SelectData({
  templateId: _templateId,
  selectedTableId,
  selectedRecordIds,
  linkedDataTableId,
  onTableSelect,
  onRecordsSelect,
  onNext,
}: Step1SelectDataProps) {
  const [tables, setTables] = useState<DataTableListItem[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);

  const [fields, setFields] = useState<DataFieldItem[]>([]);
  const [records, setRecords] = useState<PaginatedRecords | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const pageSize = 10;

  // 加载数据表列表
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await fetch("/api/data-tables");
        const result = await response.json();
        if (response.ok) {
          setTables(result);
        }
      } catch (error) {
        console.error("获取数据表列表失败:", error);
      } finally {
        setTablesLoading(false);
      }
    };
    fetchTables();
  }, []);

  // 自动选择关联的数据表
  useEffect(() => {
    if (tables.length > 0 && linkedDataTableId && !selectedTableId && !hasAutoSelected) {
      const linkedTable = tables.find((t) => t.id === linkedDataTableId);
      if (linkedTable) {
        onTableSelect(linkedDataTableId);
        setHasAutoSelected(true);
      }
    }
  }, [tables, linkedDataTableId, selectedTableId, hasAutoSelected, onTableSelect]);

  // 加载字段
  useEffect(() => {
    if (!selectedTableId) {
      setFields([]);
      return;
    }

    const fetchFields = async () => {
      try {
        const response = await fetch(`/api/data-tables/${selectedTableId}/fields`);
        const result = await response.json();
        if (response.ok) {
          setFields(result);
        }
      } catch (error) {
        console.error("获取字段失败:", error);
      }
    };
    fetchFields();
  }, [selectedTableId]);

  // 加载记录
  const fetchRecords = useCallback(async () => {
    if (!selectedTableId) {
      setRecords(null);
      return;
    }

    setRecordsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);

      // P2: 添加字段筛选参数
      activeFilters.forEach((filter) => {
        if (filter.operator === 'eq') {
          params.set(`filters[${filter.fieldKey}]`, filter.value);
        } else {
          params.set(`filters[${filter.fieldKey}][${filter.operator}]`, filter.value);
        }
      });

      const response = await fetch(`/api/data-tables/${selectedTableId}/records?${params}`);
      const result = await response.json();
      if (response.ok) {
        setRecords(result);
      }
    } catch (error) {
      console.error("获取记录失败:", error);
    } finally {
      setRecordsLoading(false);
    }
  }, [selectedTableId, page, search, activeFilters]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleTableChange = (tableId: string) => {
    onTableSelect(tableId);
    onRecordsSelect([]);
    setPage(1);
    setSearch("");
    setActiveFilters([]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (!records) return;
    if (checked) {
      const allIds = records.records.map((r) => r.id);
      onRecordsSelect(allIds);
    } else {
      onRecordsSelect([]);
    }
  };

  const handleSelectRecord = (recordId: string, checked: boolean) => {
    if (checked) {
      onRecordsSelect([...selectedRecordIds, recordId]);
    } else {
      onRecordsSelect(selectedRecordIds.filter((id) => id !== recordId));
    }
  };

  const handleFiltersChange = (filters: ActiveFilter[]) => {
    setActiveFilters(filters);
    setPage(1);
  };

  const formatCellValue = (field: DataFieldItem, value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-zinc-400">-</span>;
    }

    switch (field.type) {
      case FieldType.NUMBER:
        return typeof value === "number" ? value.toLocaleString() : String(value);
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
      default:
        return String(value);
    }
  };

  const displayFields = fields.slice(0, 5);
  const allSelected = records && records.records.length > 0 &&
    records.records.every((r) => selectedRecordIds.includes(r.id));
  const someSelected = records && records.records.some((r) => selectedRecordIds.includes(r.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">选择数据源</h2>
        <p className="text-zinc-500 text-sm mt-1">
          选择数据表并勾选需要生成文档的数据记录
        </p>
      </div>

      {/* 数据表选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">数据表</label>
        <Select value={selectedTableId || ""} onValueChange={(v) => v && handleTableChange(v)}>
          <SelectTrigger>
            <SelectValue placeholder="请选择数据表">
              {selectedTableId
                ? (() => {
                    const selectedTable = tables.find((t) => t.id === selectedTableId);
                    return selectedTable
                      ? `${selectedTable.name} (${selectedTable.recordCount} 条记录)`
                      : "请选择数据表";
                  })()
                : "请选择数据表"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tablesLoading ? (
              <SelectItem value="_loading" disabled>加载中...</SelectItem>
            ) : tables.length === 0 ? (
              <SelectItem value="_empty" disabled>暂无数据表</SelectItem>
            ) : (
              tables.map((table) => (
                <SelectItem key={table.id} value={table.id}>
                  {table.name} ({table.recordCount} 条记录)
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* 记录表格 */}
      {selectedTableId && (
        <div className="space-y-4">
          {/* 自动选择提示 */}
          {hasAutoSelected && linkedDataTableId && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <Link2 className="h-4 w-4 shrink-0" />
              <span>已自动选择模板关联的数据表</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <RecordFilter
                fields={fields}
                filters={activeFilters}
                onFiltersChange={handleFiltersChange}
                searchValue={search}
                onSearchChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
              />
            </div>
            <div className="text-sm text-zinc-500 shrink-0">
              已选择 <span className="font-medium text-foreground">{selectedRecordIds.length}</span> 条记录
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected ?? false}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = !!(someSelected && !allSelected);
                        }
                      }}
                      onCheckedChange={(checked) => handleSelectAll(checked ?? false)}
                    />
                  </TableHead>
                  {displayFields.map((field) => (
                    <TableHead key={field.id}>{field.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordsLoading ? (
                  <TableRow>
                    <TableCell colSpan={displayFields.length + 1} className="text-center py-8">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : !records || records.records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={displayFields.length + 1} className="text-center py-8">
                      暂无记录
                    </TableCell>
                  </TableRow>
                ) : (
                  records.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRecordIds.includes(record.id)}
                          onCheckedChange={(checked) => handleSelectRecord(record.id, !!checked)}
                        />
                      </TableCell>
                      {displayFields.map((field) => (
                        <TableCell key={field.id} className="max-w-[200px] truncate">
                          {formatCellValue(field, record.data[field.key])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {records && records.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-zinc-500">
              <span>共 {records.total} 条记录</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <span className="flex items-center px-2">
                  {page} / {records.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === records.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 底部导航 */}
      <div className="flex items-center justify-end pt-6 border-t">
        <Button onClick={onNext} disabled={!selectedTableId || selectedRecordIds.length === 0}>
          下一步
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
