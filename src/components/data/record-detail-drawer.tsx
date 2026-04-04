"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { formatCellValue } from "@/lib/format-cell";
import type { DataFieldItem, DataRecordItem } from "@/types/data-table";

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

export function RecordDetailDrawer(props: RecordDetailDrawerProps) {
  const { open, onOpenChange, recordId, tableId, fields, isAdmin, onDelete } =
    props;

  const [record, setRecord] = useState<DataRecordItem | null>(null);
  const [loading, setLoading] = useState(false);

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
          <div className="space-y-6">
            <SheetHeader className="border-b">
              <SheetTitle className="text-lg">记录详情</SheetTitle>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-4">
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
                    <div className="text-xs font-medium text-muted-foreground">
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
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
