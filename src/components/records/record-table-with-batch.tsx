"use client";

import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Download, Eye, History, Trash2, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SharedBatchActionBar } from "@/components/shared/batch-action-bar";
import { EmptyState } from "@/components/shared";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "待生成",
  COMPLETED: "已完成",
  FAILED: "失败",
};

const STATUS_VARIANTS: Record<string, "secondary" | "default" | "destructive"> = {
  PENDING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: "border-border bg-muted text-foreground",
  COMPLETED: "bg-primary text-primary-foreground",
  FAILED: "bg-destructive text-destructive-foreground",
};

interface RecordTableProps {
  records: Array<{
    id: string;
    templateName: string;
    fileName: string | null;
    status: string;
    createdAt: string;
  }>;
  isAdmin: boolean;
}

export function RecordTableWithBatch({ records, isAdmin }: RecordTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const allSelected =
    records.length > 0 && selectedIds.size === records.length;
  const hasSelection = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const handleBatchDelete = useCallback(async () => {
    try {
      const res = await fetch("/api/records/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: [...selectedIds] }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`已删除 ${data.data.deleted} 条记录`);
        clearSelection();
        // Refresh the page to reflect changes
        window.location.reload();
      } else {
        toast.error(data.error?.message || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleteDialogOpen(false);
    }
  }, [selectedIds]);

  const handleBatchExport = useCallback(async () => {
    try {
      const res = await fetch("/api/records/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", ids: [...selectedIds] }),
      });
      const data = await res.json();
      if (data.success) {
        const exportedRecords = data.data;
        const headers = ["模板名称", "文件名", "状态", "生成时间"];
        const rows = exportedRecords.map((r: any) => [
          r.templateName ?? r.template?.name ?? "",
          r.fileName ?? "",
          STATUS_LABELS[r.status] ?? r.status,
          new Date(r.createdAt).toLocaleDateString("zh-CN"),
        ]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "生成记录");
        XLSX.writeFile(wb, `生成记录_${selectedIds.size}条.xlsx`);
        toast.success(`已导出 ${selectedIds.size} 条记录`);
      } else {
        toast.error(data.error?.message || "导出失败");
      }
    } catch {
      toast.error("导出失败");
    }
  }, [selectedIds]);

  const batchActions = [
    {
      label: "导出 Excel",
      icon: <FileDown className="h-3.5 w-3.5" />,
      onClick: handleBatchExport,
    },
    {
      label: "批量删除",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      onClick: () => setDeleteDialogOpen(true),
      variant: "destructive" as const,
    },
  ];

  return (
    <>
      {hasSelection && (
        <div className="px-4 pt-4">
          <SharedBatchActionBar
            selectedCount={selectedIds.size}
            actions={batchActions}
            onClearSelection={clearSelection}
          />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                {...(hasSelection && !allSelected ? { indeterminate: true } : {})}
                onCheckedChange={toggleAll}
              />
            </TableHead>
            <TableHead className="w-[30%]">模板名称</TableHead>
            <TableHead className="w-[160px]">生成时间</TableHead>
            <TableHead className="w-[100px]">状态</TableHead>
            <TableHead>文件名</TableHead>
            <TableHead className="w-[160px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState
                  icon={History}
                  title="暂无生成记录"
                  description="填写模板表单即可生成文档"
                  action={
                    <LinkButton variant="link" size="sm" href="/templates">
                      前往模板列表填写表单
                    </LinkButton>
                  }
                />
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(record.id)}
                    onCheckedChange={() => toggleOne(record.id)}
                  />
                </TableCell>
                <TableCell className="font-[510] text-foreground">
                  {record.templateName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(record.createdAt).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      STATUS_VARIANTS[record.status] as
                        | "secondary"
                        | "default"
                        | "destructive"
                    }
                    className={STATUS_BADGE_CLASS[record.status] ?? ""}
                  >
                    {STATUS_LABELS[record.status] ?? record.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {record.fileName || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {record.status === "COMPLETED" && record.fileName && (
                      <a
                        href={`/api/records/${record.id}/download`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-[510] text-foreground/90 transition-colors hover:text-foreground"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <LinkButton
                      variant="ghost"
                      size="sm"
                      className="text-foreground hover:text-foreground"
                      href={`/records/${record.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      查看
                    </LinkButton>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size} 条记录吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBatchDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
