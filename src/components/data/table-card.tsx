"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { DataTableListItem } from "@/types/data-table";

interface TableCardProps {
  table: DataTableListItem;
  onDelete: (id: string) => Promise<void>;
  isAdmin: boolean;
}

export function TableCard({ table, onDelete, isAdmin }: TableCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDescription, setEditDescription] = useState(table.description || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`确定要删除数据表"${table.name}"吗？此操作将删除所有相关数据且不可恢复。`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(table.id);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      console.error("删除失败:", error);
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditDescription = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/data-tables/${table.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescription }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error || "保存失败");
      }
      toast.success("描述已更新");
      setEditDialogOpen(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败";
      console.error("保存描述失败:", error);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = () => {
    setEditDescription(table.description || "");
    setEditDialogOpen(true);
  };

  return (
    <>
      <Link href={`/data/${table.id}`}>
        <Card className="h-full cursor-pointer border-border bg-card/70 transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-border/80 hover:bg-accent/20">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {table.icon && <span>{table.icon}</span>}
                  {table.name}
                </CardTitle>
                {table.description && (
                  <CardDescription className="line-clamp-2 text-muted-foreground">
                    {table.description}
                  </CardDescription>
                )}
              </div>
              {isAdmin && (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="19" r="1" />
                          </svg>
                        </Button>
                      }
                    />
                      <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/data/${table.id}`}>查看数据</Link>} />
                      <DropdownMenuItem render={<Link href={`/data/${table.id}/fields`}>配置字段</Link>} />
                      <DropdownMenuItem render={<Link href={`/data/${table.id}/import`}>导入数据</Link>} />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>导出数据</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/data-tables/${table.id}/export`)}
                          >
                            导出 Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/data-tables/${table.id}/export/json`)}
                          >
                            导出 JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/data-tables/${table.id}/export/sql`)}
                          >
                            导出 SQL
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/api/data-tables/${table.id}/export/bundle`)}
                          >
                            导出关联数据
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuItem onClick={openEditDialog}>
                        编辑描述
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-300"
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "删除中..." : "删除"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <line x1="3" x2="21" y1="9" y2="9" />
                  <line x1="9" x2="9" y1="21" y2="9" />
                </svg>
                {table.fieldCount} 个字段
              </div>
              <div className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3v18h18" />
                  <path d="M18 17V9" />
                  <path d="M13 17V5" />
                  <path d="M8 17v-3" />
                </svg>
                {table.recordCount} 条记录
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Edit Description Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑数据表描述</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="输入数据表描述（可选）"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditDescription} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
