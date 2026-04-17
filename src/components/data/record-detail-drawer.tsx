"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Pencil, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCellValue } from "@/lib/format-cell";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";
import type { ChangeHistoryEntry } from "@/lib/services/data-record-change-history.service";
import { FieldTypeIcon } from "./field-type-icon";

export interface RecordDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
  onEdit?: () => void;
  onDelete?: (recordId: string) => void;
}

function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("zh-CN");
}

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return "(空)";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function RecordDetailDrawer(props: RecordDetailDrawerProps) {
  const { open, onOpenChange, recordId, tableId, fields, isAdmin, onDelete } =
    props;

  const [record, setRecord] = useState<DataRecordItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("fields");

  // History state
  const [historyEntries, setHistoryEntries] = useState<ChangeHistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!open || !recordId) {
      setRecord(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadRecord() {
      setLoading(true);
      setRecord(null);

      try {
        const response = await fetch(
          `/api/data-tables/${tableId}/records/${recordId}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          if (!cancelled) {
            setRecord(null);
          }
          return;
        }

        const data = (await response.json()) as DataRecordItem;

        if (!cancelled) {
          setRecord(data);
        }
      } catch {
        if (!cancelled) {
          setRecord(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRecord();

    return () => {
      cancelled = true;
    };
  }, [open, recordId, tableId]);

  const loadHistory = useCallback(async (page: number, append = false) => {
    if (!recordId) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const response = await fetch(
        `/api/data-tables/${tableId}/records/${recordId}/history?${params}`,
        { cache: "no-store" }
      );
      if (response.ok) {
        const data = await response.json();
        setHistoryEntries((prev) => append ? [...prev, ...data.entries] : data.entries);
        setHistoryTotal(data.total);
        setHistoryPage(page);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [recordId, tableId, startDate, endDate]);

  // Load history when tab switches to history
  useEffect(() => {
    if (open && activeTab === "history" && recordId) {
      setHistoryEntries([]);
      setHistoryPage(1);
      void loadHistory(1);
    }
  }, [open, activeTab, recordId, loadHistory]);

  const handleDateFilter = () => {
    setHistoryEntries([]);
    setHistoryPage(1);
    void loadHistory(1);
  };

  // Reset tab when drawer closes
  useEffect(() => {
    if (!open) {
      setActiveTab("fields");
      setHistoryEntries([]);
      setHistoryTotal(0);
      setHistoryPage(1);
      setStartDate("");
      setEndDate("");
    }
  }, [open]);

  const handleDelete = () => {
    if (!record) return;

    onDelete?.(record.id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        {loading ? (
          <div className="flex min-h-full items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : !record ? (
          <div className="flex min-h-full items-center justify-center py-12 text-sm text-muted-foreground">
            记录不存在
          </div>
        ) : (
          <div className="space-y-4">
            <SheetHeader className="border-b">
              <SheetTitle className="text-lg">记录详情</SheetTitle>
            </SheetHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mx-4">
                <TabsTrigger value="fields">字段</TabsTrigger>
                <TabsTrigger value="history">
                  <History className="h-3.5 w-3.5" />
                  变更历史
                </TabsTrigger>
              </TabsList>

              <TabsContent value="fields" className="space-y-6 px-4 pb-4 pt-4">
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/data/${tableId}/${record.id}/edit`} />}
                    >
                      <Pencil className="h-4 w-4" />
                      编辑
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  {fields.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <FieldTypeIcon type={field.type} />
                        {field.label}
                      </div>
                      <div className="break-words text-sm">
                        {formatCellValue(field, record.data[field.key])}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    元信息
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <span className="text-muted-foreground">创建人</span>
                      <span>{record.createdByName || "-"}</span>
                    </div>
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <span className="text-muted-foreground">创建时间</span>
                      <span>{formatDateTime(record.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <span className="text-muted-foreground">更新时间</span>
                      <span>{formatDateTime(record.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="space-y-4 px-4 pb-4 pt-4">
                {/* Date range filter */}
                <div className="flex gap-2 items-center text-xs">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-7 text-xs"
                  />
                  <span className="text-muted-foreground shrink-0">至</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-7 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs shrink-0"
                    onClick={handleDateFilter}
                  >
                    筛选
                  </Button>
                </div>

                {historyLoading && historyEntries.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner className="size-5" />
                  </div>
                ) : historyEntries.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-12">
                    暂无变更记录
                  </div>
                ) : (
                  <>
                    <div className="relative space-y-0">
                      {historyEntries.map((entry) => (
                        <div key={entry.id} className="flex gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            <div className="w-px flex-1 bg-border" />
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="text-muted-foreground text-xs">
                              {formatDateTime(entry.changedAt)} · {entry.changedByName}
                            </div>
                            <div className="mt-1">
                              <span className="font-medium">{entry.fieldLabel}</span>
                              {" : "}
                              <span className="text-red-500/80 line-through">
                                {formatChangeValue(entry.oldValue)}
                              </span>
                              {" → "}
                              <span className="text-green-600">
                                {formatChangeValue(entry.newValue)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {historyEntries.length < historyTotal && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        disabled={historyLoading}
                        onClick={() => loadHistory(historyPage + 1, true)}
                      >
                        {historyLoading ? "加载中..." : "加载更多"}
                      </Button>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
