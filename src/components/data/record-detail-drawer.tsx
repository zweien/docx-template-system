"use client";

import { useEffect, useState, useCallback } from "react";
import { Pencil, Trash2, History, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
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
import { CommentPanel } from "./comment-panel";
import { FieldType } from "@/generated/prisma/enums";
import { RichTextPreview } from "./rich-text-cell-editor";
import { DynamicRecordForm } from "./dynamic-record-form";

type RecordDetailMode = "view" | "edit";

export interface RecordDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  tableId: string;
  fields: DataFieldItem[];
  isAdmin: boolean;
  onEdit?: () => void;
  onDelete?: (recordId: string) => void;
  recordIds?: string[];
  onNavigate?: (recordId: string) => void;
  initialMode?: RecordDetailMode;
  onRecordSaved?: () => void;
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
  const {
    open,
    onOpenChange,
    recordId,
    tableId,
    fields,
    isAdmin,
    onDelete,
    recordIds,
    onNavigate,
    initialMode = "view",
    onRecordSaved,
  } =
    props;

  const currentIndex = recordId && recordIds ? recordIds.indexOf(recordId) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = recordIds ? currentIndex < recordIds.length - 1 : false;

  const [record, setRecord] = useState<DataRecordItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("fields");
  const [mode, setMode] = useState<RecordDetailMode>(initialMode);

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

  useEffect(() => {
    if (open && recordId) {
      setMode(initialMode);
    }
  }, [initialMode, open, recordId]);

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
      setMode("view");
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

  const handleNavigate = useCallback((direction: -1 | 1) => {
    if (!recordIds || !onNavigate || currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= recordIds.length) return;
    setMode("view");
    onNavigate(recordIds[nextIndex]);
  }, [recordIds, onNavigate, currentIndex]);

  const handleSave = useCallback(async (data: Record<string, unknown>) => {
    if (!record) return;

    const response = await fetch(
      `/api/data-tables/${tableId}/records/${record.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? "保存失败");
    }

    const updatedRecord = (await response.json()) as DataRecordItem;
    setRecord(updatedRecord);
    setMode("view");
    onRecordSaved?.();
  }, [onRecordSaved, record, tableId]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || !recordIds || !onNavigate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleNavigate(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNavigate(1);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, recordIds, onNavigate, handleNavigate]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-[rgb(255_255_255_/_0.08)] bg-[#191a1b] sm:max-w-md">
        {loading ? (
          <div className="flex min-h-full items-center justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : !record ? (
          <div className="flex min-h-full items-center justify-center py-12 text-sm text-[#8a8f98]">
            记录不存在
          </div>
        ) : (
          <div className="space-y-4">
            <SheetHeader className="border-b border-[rgb(255_255_255_/_0.08)]">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg font-[510] text-[#f7f8f8]">
                  {mode === "edit" ? "编辑记录" : "记录详情"}
                </SheetTitle>
                {recordIds && recordIds.length > 0 && currentIndex >= 0 && (
                  <div className="flex items-center gap-1 relative z-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={!hasPrev}
                      onClick={() => handleNavigate(-1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[3rem] text-center text-xs tabular-nums text-[#8a8f98]">
                      {currentIndex + 1} / {recordIds.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={!hasNext}
                      onClick={() => handleNavigate(1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </SheetHeader>

            {mode === "edit" ? (
              <div className="px-4 pb-4 pt-4">
                <DynamicRecordForm
                  tableId={tableId}
                  fields={fields}
                  initialData={record}
                  onSubmit={handleSave}
                  onCancel={() => setMode("view")}
                  submitLabel="保存修改"
                />
              </div>
            ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mx-4">
                <TabsTrigger value="fields">字段</TabsTrigger>
                <TabsTrigger value="comments">
                  <MessageSquare className="h-3.5 w-3.5" />
                  评论
                </TabsTrigger>
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
                      onClick={() => setMode("edit")}
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
                    <div key={field.id} className="space-y-1.5 rounded-md border border-[rgb(255_255_255_/_0.06)] bg-[rgb(255_255_255_/_0.02)] p-2.5">
                      <div className="flex items-center gap-1 text-xs font-[510] text-[#8a8f98]">
                        <FieldTypeIcon type={field.type} />
                        {field.label}
                      </div>
                      <div className="break-words text-sm text-[#d0d6e0]">
                        {field.type === FieldType.RICH_TEXT
                          ? <RichTextPreview value={record.data[field.key]} />
                          : formatCellValue(field, record.data[field.key])}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="bg-[rgb(255_255_255_/_0.08)]" />

                <div className="space-y-3">
                  <div className="text-xs font-[510] text-[#8a8f98]">
                    元信息
                  </div>
                  <div className="grid gap-2 text-sm text-[#d0d6e0]">
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <span className="text-[#8a8f98]">创建人</span>
                      <span>{record.createdByName || "-"}</span>
                    </div>
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <span className="text-[#8a8f98]">创建时间</span>
                      <span>{formatDateTime(record.createdAt)}</span>
                    </div>
                    <div className="grid grid-cols-[88px_1fr] gap-2">
                      <span className="text-[#8a8f98]">更新时间</span>
                      <span>{formatDateTime(record.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="flex-1 min-h-0">
                {record && (
                  <CommentPanel tableId={tableId} recordId={record.id} />
                )}
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
                  <span className="shrink-0 text-[#8a8f98]">至</span>
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
                  <div className="py-12 text-center text-sm text-[#8a8f98]">
                    暂无变更记录
                  </div>
                ) : (
                  <>
                    <div className="relative space-y-0">
                      {historyEntries.map((entry) => (
                        <div key={entry.id} className="flex gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#7170ff]" />
                            <div className="w-px flex-1 bg-[rgb(255_255_255_/_0.08)]" />
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="text-xs text-[#8a8f98]">
                              {formatDateTime(entry.changedAt)} · {entry.changedByName}
                            </div>
                            <div className="mt-1 text-[#d0d6e0]">
                              <span className="font-[510] text-[#f7f8f8]">{entry.fieldLabel}</span>
                              {" : "}
                              <span className="text-red-300/80 line-through">
                                {formatChangeValue(entry.oldValue)}
                              </span>
                              {" → "}
                              <span className="text-emerald-400">
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
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
