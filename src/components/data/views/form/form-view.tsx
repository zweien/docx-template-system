"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ClipboardList,
  Eye,
  Pencil,
  Share2,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  DataFieldItem,
  DataViewItem,
  FormFieldGroup,
  FormViewOptions,
  FormShareTokenItem,
} from "@/types/data-table";
import { FormFieldItem } from "./form-field-item";
import { FormPreview } from "./form-preview";

// Fields not shown in form view
const FORM_HIDDEN_TYPES = new Set([
  "RELATION_SUBTABLE",
  "SYSTEM_TIMESTAMP",
  "SYSTEM_USER",
  "AUTO_NUMBER",
  "FORMULA",
]);

interface FormViewProps {
  fields: DataFieldItem[];
  view: DataViewItem;
  onViewOptionsChange: (options: Record<string, unknown>) => void;
  tableId: string;
}

function getDefaultOptions(
  tableName: string,
  fields: DataFieldItem[]
): FormViewOptions {
  const visibleFields = fields.filter((f) => !FORM_HIDDEN_TYPES.has(f.type));
  return {
    formTitle: tableName,
    formDescription: "",
    submitButtonText: "提交",
    successMessage: "提交成功！",
    allowMultipleSubmissions: false,
    layout: {
      version: 1,
      groups: [
        {
          id: "default",
          title: "",
          fieldKeys: visibleFields.map((f) => f.key),
        },
      ],
    },
  };
}

export function FormView({
  fields,
  view,
  onViewOptionsChange,
  tableId,
}: FormViewProps) {
  const options = (view.viewOptions ?? {}) as Partial<FormViewOptions>;

  // Ensure layout exists with defaults
  const fullOptions = useMemo<FormViewOptions>(() => {
    const defaults = getDefaultOptions(view.name, fields);
    return {
      formTitle: options.formTitle ?? defaults.formTitle,
      formDescription: options.formDescription ?? defaults.formDescription,
      submitButtonText: options.submitButtonText ?? defaults.submitButtonText,
      successMessage: options.successMessage ?? defaults.successMessage,
      allowMultipleSubmissions:
        options.allowMultipleSubmissions ?? defaults.allowMultipleSubmissions,
      layout: options.layout ?? defaults.layout,
    };
  }, [view.viewOptions, view.name, fields]);

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTokens, setShareTokens] = useState<FormShareTokenItem[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const update = useCallback(
    (patch: Partial<FormViewOptions>) => {
      onViewOptionsChange({ ...fullOptions, ...patch });
    },
    [fullOptions, onViewOptionsChange]
  );

  const visibleFields = useMemo(
    () => fields.filter((f) => !FORM_HIDDEN_TYPES.has(f.type)),
    [fields]
  );

  // Drag-and-drop reorder field within/between groups
  const moveField = useCallback(
    (fieldKey: string, toGroupId: string, toIndex: number) => {
      const groups = fullOptions.layout.groups.map((g) => ({
        ...g,
        fieldKeys: g.fieldKeys.filter((k) => k !== fieldKey),
      }));
      const targetGroup = groups.find((g) => g.id === toGroupId);
      if (targetGroup) {
        targetGroup.fieldKeys.splice(toIndex, 0, fieldKey);
      }
      update({ layout: { ...fullOptions.layout, groups } });
    },
    [fullOptions, update]
  );

  const addGroup = useCallback(() => {
    const newGroup: FormFieldGroup = {
      id: `group-${Date.now()}`,
      title: "新分组",
      fieldKeys: [],
    };
    update({
      layout: {
        ...fullOptions.layout,
        groups: [...fullOptions.layout.groups, newGroup],
      },
    });
  }, [fullOptions, update]);

  const removeGroup = useCallback(
    (groupId: string) => {
      const groups = fullOptions.layout.groups.filter((g) => g.id !== groupId);
      if (groups.length === 0) return; // Keep at least one group
      // Move fields from removed group to first group
      const removed = fullOptions.layout.groups.find((g) => g.id === groupId);
      if (removed && removed.fieldKeys.length > 0) {
        groups[0].fieldKeys = [...groups[0].fieldKeys, ...removed.fieldKeys];
      }
      update({ layout: { ...fullOptions.layout, groups } });
    },
    [fullOptions, update]
  );

  const renameGroup = useCallback(
    (groupId: string, title: string) => {
      const groups = fullOptions.layout.groups.map((g) =>
        g.id === groupId ? { ...g, title } : g
      );
      update({ layout: { ...fullOptions.layout, groups } });
    },
    [fullOptions, update]
  );

  // Share management
  const loadShareTokens = useCallback(async () => {
    setShareLoading(true);
    try {
      const res = await fetch(
        `/api/data-tables/${tableId}/views/${view.id}/share`
      );
      const data = await res.json();
      if (data.success) setShareTokens(data.data);
    } catch {
      /* ignore */
    } finally {
      setShareLoading(false);
    }
  }, [tableId, view.id]);

  const handleCreateShare = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/data-tables/${tableId}/views/${view.id}/share`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const data = await res.json();
      if (data.success) {
        setShareTokens((prev) => [data.data, ...prev]);
      }
    } catch {
      /* ignore */
    }
  }, [tableId, view.id]);

  const handleDeleteShare = useCallback(
    async (tokenId: string) => {
      try {
        const res = await fetch(
          `/api/data-tables/${tableId}/views/${view.id}/share/${tokenId}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (data.success) {
          setShareTokens((prev) => prev.filter((t) => t.id !== tokenId));
        }
      } catch {
        /* ignore */
      }
    },
    [tableId, view.id]
  );

  const handleCopyLink = useCallback((token: string) => {
    const url = `${window.location.origin}/f/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }, []);

  const isFallbackView = view.id === "fallback";

  const openShareDialog = useCallback(() => {
    if (isFallbackView) return;
    setShareDialogOpen(true);
    void loadShareTokens();
  }, [isFallbackView, loadShareTokens]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-2 border-b gap-2">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={mode === "edit" ? "secondary" : "ghost"}
            onClick={() => setMode("edit")}
          >
            <Pencil className="size-3.5 mr-1" />
            编辑
          </Button>
          <Button
            size="sm"
            variant={mode === "preview" ? "secondary" : "ghost"}
            onClick={() => setMode("preview")}
          >
            <Eye className="size-3.5 mr-1" />
            预览
          </Button>
        </div>
        {isFallbackView ? (
          <Button size="sm" variant="outline" disabled title="请先保存视图再分享">
            <Share2 className="size-3.5 mr-1" />
            分享
          </Button>
        ) : (
          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger
              render={
                <Button size="sm" variant="outline" onClick={openShareDialog}>
                  <Share2 className="size-3.5 mr-1" />
                  分享
                </Button>
              }
            />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>分享表单</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Button onClick={handleCreateShare} size="sm">
                <Plus className="size-3.5 mr-1" />
                生成新链接
              </Button>
              {shareLoading ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  加载中...
                </div>
              ) : shareTokens.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  暂无分享链接
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {shareTokens.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 p-2 rounded border text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-xs text-muted-foreground">
                          /f/{t.token}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => handleCopyLink(t.token)}
                      >
                        {copiedToken === t.token ? "已复制" : "复制链接"}
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="shrink-0 text-destructive"
                        onClick={() => handleDeleteShare(t.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {mode === "edit" ? (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            {/* Form settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                表单设置
              </h3>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs">表单标题</Label>
                  <Input
                    value={fullOptions.formTitle}
                    onChange={(e) => update({ formTitle: e.target.value })}
                    placeholder="表单标题"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">表单描述</Label>
                  <Textarea
                    value={fullOptions.formDescription}
                    onChange={(e) =>
                      update({ formDescription: e.target.value })
                    }
                    placeholder="可选的表单描述"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">提交按钮文本</Label>
                    <Input
                      value={fullOptions.submitButtonText}
                      onChange={(e) =>
                        update({ submitButtonText: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">成功提示</Label>
                    <Input
                      value={fullOptions.successMessage}
                      onChange={(e) =>
                        update({ successMessage: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={fullOptions.allowMultipleSubmissions}
                    onCheckedChange={(v) =>
                      update({ allowMultipleSubmissions: v })
                    }
                  />
                  <Label className="text-xs">允许重复提交</Label>
                </div>
              </div>
            </div>

            {/* Field groups */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  字段布局
                </h3>
                <Button size="sm" variant="outline" onClick={addGroup}>
                  <Plus className="size-3.5 mr-1" />
                  添加分组
                </Button>
              </div>

              {fullOptions.layout.groups.map((group, gi) => (
                <GroupEditor
                  key={group.id}
                  group={group}
                  fields={visibleFields}
                  canRemove={fullOptions.layout.groups.length > 1}
                  onRename={(title) => renameGroup(group.id, title)}
                  onRemove={() => removeGroup(group.id)}
                  onMoveField={moveField}
                />
              ))}
            </div>
          </div>
        ) : (
          <FormPreview
            options={fullOptions}
            fields={visibleFields}
          />
        )}
      </div>
    </div>
  );
}

// ── Group editor sub-component ──

function GroupEditor({
  group,
  fields,
  canRemove,
  onRename,
  onRemove,
  onMoveField,
}: {
  group: FormFieldGroup;
  fields: DataFieldItem[];
  canRemove: boolean;
  onRename: (title: string) => void;
  onRemove: () => void;
  onMoveField: (fieldKey: string, toGroupId: string, toIndex: number) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const groupFields = useMemo(
    () =>
      group.fieldKeys
        .map((key) => fields.find((f) => f.key === key))
        .filter(Boolean) as DataFieldItem[],
    [group.fieldKeys, fields]
  );

  // Fields not yet assigned to any group in this layout (shouldn't happen normally)
  const handleDrop = useCallback(
    (fieldKey: string, toIndex: number) => {
      onMoveField(fieldKey, group.id, toIndex);
    },
    [group.id, onMoveField]
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground"
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
        <Input
          value={group.title}
          onChange={(e) => onRename(e.target.value)}
          placeholder="分组标题"
          className="h-7 text-sm border-none bg-transparent shadow-none focus-visible:ring-0 px-1"
        />
        {canRemove && (
          <Button
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground ml-auto"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      {!collapsed && (
        <div className="p-2 space-y-1 min-h-[40px]">
          {groupFields.map((field, i) => (
            <FormFieldItem
              key={field.key}
              field={field}
              index={i}
              groupId={group.id}
              onDrop={handleDrop}
            />
          ))}
          {groupFields.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-3">
              拖拽字段到此处
            </div>
          )}
        </div>
      )}
    </div>
  );
}
