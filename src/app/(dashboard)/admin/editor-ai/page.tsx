"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Sparkles,
  Power,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { EditorAIActionItem } from "@/types/editor-ai";

type Scope = "selection" | "paragraph" | "document";
type Category = "general" | "writing" | "translation" | "analysis";

const CATEGORY_LABELS: Record<Category, string> = {
  general: "通用",
  writing: "写作",
  translation: "翻译",
  analysis: "分析",
};

const SCOPE_LABELS: Record<Scope, string> = {
  selection: "选区",
  paragraph: "段落",
  document: "文档",
};

interface FormData {
  name: string;
  icon: string;
  prompt: string;
  category: Category;
  scope: Scope;
}

const emptyForm: FormData = {
  name: "",
  icon: "",
  prompt: "",
  category: "general",
  scope: "selection",
};

export default function EditorAIAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [actions, setActions] = useState<EditorAIActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<EditorAIActionItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAction, setDeletingAction] = useState<EditorAIActionItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toggle loading state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/");
    }
  }, [status, session, router]);

  const fetchActions = useCallback(async () => {
    if (status !== "authenticated" || session?.user?.role !== "ADMIN") return;

    setLoading(true);
    try {
      const res = await fetch("/api/editor-ai/actions?admin=true");
      const data = await res.json();

      if (data.success) {
        setActions(data.data);
      } else {
        toast.error("获取 AI 操作列表失败");
      }
    } catch (error) {
      console.error("获取 AI 操作列表失败:", error);
      toast.error("获取 AI 操作列表失败");
    } finally {
      setLoading(false);
    }
  }, [status, session]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const openCreateDialog = () => {
    setEditingAction(null);
    setFormData({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEditDialog = (action: EditorAIActionItem) => {
    setEditingAction(action);
    setFormData({
      name: action.name,
      icon: action.icon ?? "",
      prompt: action.prompt,
      category: action.category as Category,
      scope: action.scope,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.prompt.trim()) {
      toast.error("名称和提示词不能为空");
      return;
    }

    setFormLoading(true);
    try {
      const isEdit = !!editingAction;
      const url = isEdit
        ? `/api/editor-ai/actions/${editingAction.id}`
        : "/api/editor-ai/actions?admin=true";
      const method = isEdit ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        icon: formData.icon.trim() || undefined,
        prompt: formData.prompt.trim(),
        category: formData.category,
        scope: formData.scope,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(isEdit ? "操作已更新" : "操作已创建");
        setDialogOpen(false);
        fetchActions();
      } else {
        toast.error(data.error?.message || "操作失败");
      }
    } catch (error) {
      console.error("保存操作失败:", error);
      toast.error("保存操作失败");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAction) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/editor-ai/actions/${deletingAction.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("操作已删除");
        setDeleteDialogOpen(false);
        setDeletingAction(null);
        fetchActions();
      } else {
        toast.error(data.error?.message || "删除失败");
      }
    } catch (error) {
      console.error("删除操作失败:", error);
      toast.error("删除操作失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggle = async (action: EditorAIActionItem) => {
    setTogglingId(action.id);
    try {
      const res = await fetch(`/api/editor-ai/actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !action.enabled }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(action.enabled ? "已禁用" : "已启用");
        fetchActions();
      } else {
        toast.error(data.error?.message || "切换状态失败");
      }
    } catch (error) {
      console.error("切换状态失败:", error);
      toast.error("切换状态失败");
    } finally {
      setTogglingId(null);
    }
  };

  if (
    status === "loading" ||
    (status === "authenticated" && session?.user?.role !== "ADMIN")
  ) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            编辑器 AI 操作管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理全局 AI 操作模板，所有用户共享
          </p>
        </div>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          新建操作
        </Button>
      </div>

      {/* Actions Table */}
      <div className="border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-3 opacity-50" />
            <p>暂无 AI 操作</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      操作
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      分类
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      范围
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      状态
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium">
                      类型
                    </th>
                    <th className="text-right px-4 py-3 text-sm font-medium">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {actions.map((action) => (
                    <tr
                      key={action.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {action.icon && (
                            <span className="text-lg">{action.icon}</span>
                          )}
                          <div>
                            <p className="font-medium">{action.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1 max-w-[240px]">
                              {action.prompt}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {CATEGORY_LABELS[action.category as Category] ??
                            action.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {SCOPE_LABELS[action.scope] ?? action.scope}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(action)}
                          disabled={
                            togglingId === action.id || action.isBuiltIn
                          }
                        >
                          {togglingId === action.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : action.enabled ? (
                            <Power className="h-4 w-4 text-green-600" />
                          ) : (
                            <PowerOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        {action.isBuiltIn && (
                          <Badge variant="default">内置</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(action)}
                            disabled={action.isBuiltIn}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingAction(action);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={action.isBuiltIn}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y">
              {actions.map((action) => (
                <div key={action.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {action.icon && <span className="text-lg">{action.icon}</span>}
                      <div>
                        <p className="font-medium">{action.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {action.prompt}
                        </p>
                      </div>
                    </div>
                    {action.isBuiltIn && <Badge variant="default">内置</Badge>}
                  </div>

                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {CATEGORY_LABELS[action.category as Category] ??
                        action.category}
                    </Badge>
                    <Badge variant="outline">
                      {SCOPE_LABELS[action.scope] ?? action.scope}
                    </Badge>
                    <Badge variant={action.enabled ? "default" : "outline"}>
                      {action.enabled ? "已启用" : "已禁用"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(action)}
                      disabled={togglingId === action.id || action.isBuiltIn}
                    >
                      {togglingId === action.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : action.enabled ? (
                        <PowerOff className="h-3 w-3 mr-1" />
                      ) : (
                        <Power className="h-3 w-3 mr-1" />
                      )}
                      {action.enabled ? "禁用" : "启用"}
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(action)}
                        disabled={action.isBuiltIn}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDeletingAction(action);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={action.isBuiltIn}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>
              {editingAction ? "编辑 AI 操作" : "新建 AI 操作"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="action-name">名称</Label>
                <Input
                  id="action-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="例如：润色文本"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="action-icon">图标（emoji）</Label>
                <Input
                  id="action-icon"
                  value={formData.icon}
                  onChange={(e) =>
                    setFormData({ ...formData, icon: e.target.value })
                  }
                  placeholder="例如：✨"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="action-prompt">提示词</Label>
              <Textarea
                id="action-prompt"
                value={formData.prompt}
                onChange={(e) =>
                  setFormData({ ...formData, prompt: e.target.value })
                }
                placeholder="输入 AI 提示词模板，可使用 {{selection}}、{{context}} 等变量"
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                可用变量：&#123;&#123;selection&#125;&#125;（选中文本）、&#123;&#123;context&#125;&#125;（上下文）、&#123;&#123;instruction&#125;&#125;（用户指令）
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="action-category">分类</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) =>
                    v && setFormData({ ...formData, category: v as Category })
                  }
                >
                  <SelectTrigger id="action-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="action-scope">范围</Label>
                <Select
                  value={formData.scope}
                  onValueChange={(v) =>
                    v && setFormData({ ...formData, scope: v as Scope })
                  }
                >
                  <SelectTrigger id="action-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              全局操作对所有用户可见。创建后可通过启用/禁用开关控制是否在编辑器中展示。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={formLoading}>
              {formLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAction ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 AI 操作 &quot;{deletingAction?.name}&quot; 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
