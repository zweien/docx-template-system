"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Pencil, Eye, FileText, ArrowRight } from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SharedBatchActionBar, type BatchAction } from "@/components/shared/batch-action-bar";
import { EmptyState } from "@/components/shared";
import { TemplateListDeleteButton } from "@/app/(dashboard)/templates/template-list-delete-button";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

const STATUS_VARIANTS: Record<string, "secondary" | "default" | "destructive"> = {
  DRAFT: "secondary",
  PUBLISHED: "default",
  ARCHIVED: "destructive",
};

interface TemplateTableProps {
  templates: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    createdBy: { name: string };
    category: { name: string } | null;
    tags: Array<{ tag: { id: string; name: string } }>;
    currentVersion: { version: number } | null;
  }>;
  categories: Array<{ id: string; name: string }>;
  isAdmin: boolean;
}

export function TemplateTableWithBatch({
  templates,
  categories,
  isAdmin,
}: TemplateTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  // Status/category selection
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [targetCategoryId, setTargetCategoryId] = useState<string>("");

  // Loading state
  const [loading, setLoading] = useState(false);

  // Selection handlers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === templates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(templates.map((t) => t.id)));
    }
  }, [selectedIds.size, templates]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Batch operations
  const handleBatchDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        toast.success(`已删除 ${selectedIds.size} 个模板`);
        clearSelection();
        setDeleteDialogOpen(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "批量删除失败");
      }
    } catch {
      toast.error("批量删除失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpdateStatus = async () => {
    if (!targetStatus) return;
    setLoading(true);
    try {
      const res = await fetch("/api/templates/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateStatus",
          ids: Array.from(selectedIds),
          payload: { status: targetStatus },
        }),
      });
      if (res.ok) {
        toast.success(`已将 ${selectedIds.size} 个模板状态更新为「${STATUS_LABELS[targetStatus]}」`);
        clearSelection();
        setStatusDialogOpen(false);
        setTargetStatus("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "批量更新状态失败");
      }
    } catch {
      toast.error("批量更新状态失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpdateCategory = async () => {
    if (!targetCategoryId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/templates/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateCategory",
          ids: Array.from(selectedIds),
          payload: { categoryId: targetCategoryId },
        }),
      });
      if (res.ok) {
        const categoryName =
          targetCategoryId === "__none__"
            ? "无分类"
            : categories.find((c) => c.id === targetCategoryId)?.name ?? "";
        toast.success(`已将 ${selectedIds.size} 个模板分类更新为「${categoryName}」`);
        clearSelection();
        setCategoryDialogOpen(false);
        setTargetCategoryId("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "批量更新分类失败");
      }
    } catch {
      toast.error("批量更新分类失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  // Batch action bar actions (admin only)
  const batchActions: BatchAction[] = isAdmin
    ? [
        {
          label: "修改状态",
          icon: <Pencil className="h-3.5 w-3.5" />,
          onClick: () => setStatusDialogOpen(true),
        },
        {
          label: "修改分类",
          icon: <ArrowRight className="h-3.5 w-3.5" />,
          onClick: () => setCategoryDialogOpen(true),
        },
        {
          label: "批量删除",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          onClick: () => setDeleteDialogOpen(true),
          variant: "destructive",
        },
      ]
    : [];

  const allSelected = templates.length > 0 && selectedIds.size === templates.length;

  return (
    <>
      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="border-b px-4 pt-3 pb-2">
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
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead className="w-[100px]">分类</TableHead>
            <TableHead className="w-[30%]">名称</TableHead>
            <TableHead>版本</TableHead>
            <TableHead className="w-[150px]">标签</TableHead>
            <TableHead className="w-[100px]">状态</TableHead>
            <TableHead className="w-[100px]">创建者</TableHead>
            <TableHead className="w-[160px]">创建时间</TableHead>
            <TableHead className="w-[160px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9}>
                <EmptyState
                  icon={FileText}
                  title="暂无模板数据"
                  description={isAdmin ? "上传第一个模板来开始管理您的文档" : undefined}
                  action={
                    isAdmin ? (
                      <LinkButton variant="link" size="sm" href="/templates/new">
                        上传第一个模板
                      </LinkButton>
                    ) : undefined
                  }
                />
              </TableCell>
            </TableRow>
          ) : (
            templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(template.id)}
                    onCheckedChange={() => toggleSelect(template.id)}
                  />
                </TableCell>
                <TableCell>
                  {template.category ? (
                    <Badge variant="secondary">{template.category.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="font-[510] text-foreground">
                  {template.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {template.currentVersion ? `v${template.currentVersion.version}` : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {template.tags.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <>
                        {template.tags.slice(0, 3).map((t) => (
                          <Badge key={t.tag.id} variant="outline" className="text-xs">
                            {t.tag.name}
                          </Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{template.tags.length - 3}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[template.status]}>
                    {STATUS_LABELS[template.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {template.createdBy.name}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {template.createdAt.toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <LinkButton
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-foreground"
                      href={`/templates/${template.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span className="sr-only">查看</span>
                    </LinkButton>
                    {isAdmin && (
                      <>
                        <LinkButton
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-foreground"
                          href={`/templates/${template.id}/edit`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">编辑</span>
                        </LinkButton>
                        <TemplateListDeleteButton
                          templateId={template.id}
                          templateName={template.name}
                        />
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Batch delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedIds.size} 个模板吗？此操作不可撤销，所有关联的占位符、草稿和生成记录将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={loading}
            >
              {loading ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch update status dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量修改状态</DialogTitle>
            <DialogDescription>
              将选中的 {selectedIds.size} 个模板状态修改为：
            </DialogDescription>
          </DialogHeader>
          <Select value={targetStatus} onValueChange={(v) => v && setTargetStatus(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择目标状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">草稿</SelectItem>
              <SelectItem value="PUBLISHED">已发布</SelectItem>
              <SelectItem value="ARCHIVED">已归档</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStatusDialogOpen(false);
                setTargetStatus("");
              }}
              disabled={loading}
            >
              取消
            </Button>
            <Button onClick={handleBatchUpdateStatus} disabled={loading || !targetStatus}>
              {loading ? "更新中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch update category dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量修改分类</DialogTitle>
            <DialogDescription>
              将选中的 {selectedIds.size} 个模板分类修改为：
            </DialogDescription>
          </DialogHeader>
          <Select value={targetCategoryId} onValueChange={(v) => v && setTargetCategoryId(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择目标分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">无分类</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCategoryDialogOpen(false);
                setTargetCategoryId("");
              }}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              onClick={handleBatchUpdateCategory}
              disabled={loading || !targetCategoryId}
            >
              {loading ? "更新中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
