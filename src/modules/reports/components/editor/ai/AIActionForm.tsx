"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { EditorAIActionItem } from "@/types/editor-ai";

interface AIActionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: EditorAIActionItem | null;
  onSuccess: () => void;
}

const QUICK_EMOJIS = [
  "✨",
  "📝",
  "📖",
  "🌐",
  "🎯",
  "💼",
  "😊",
  "💡",
  "🔬",
  "🎓",
];

const CATEGORY_OPTIONS = [
  { value: "general", label: "通用" },
  { value: "writing", label: "写作" },
  { value: "translation", label: "翻译" },
  { value: "analysis", label: "分析" },
] as const;

const SCOPE_OPTIONS = [
  { value: "selection", label: "选中文本" },
  { value: "paragraph", label: "当前段落" },
  { value: "document", label: "整篇文档" },
] as const;

type FormState = {
  name: string;
  icon: string;
  category: string;
  scope: "selection" | "paragraph" | "document";
  prompt: string;
};

const INITIAL_FORM: FormState = {
  name: "",
  icon: "✨",
  category: "general",
  scope: "selection",
  prompt: "",
};

export function AIActionForm({
  open,
  onOpenChange,
  action,
  onSuccess,
}: AIActionFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!action;

  // Reset form when dialog opens or action changes
  useEffect(() => {
    if (!open) return;
    if (action) {
      setForm({
        name: action.name,
        icon: action.icon ?? "✨",
        category: action.category ?? "general",
        scope: action.scope,
        prompt: action.prompt,
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [open, action]);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error("请输入名称");
      return;
    }
    if (!form.prompt.trim()) {
      toast.error("请输入 Prompt 模板");
      return;
    }

    setSubmitting(true);

    try {
      const body = {
        name: form.name.trim(),
        icon: form.icon || undefined,
        prompt: form.prompt.trim(),
        category: form.category,
        scope: form.scope,
      };

      let res: Response;

      if (isEdit && action) {
        res = await fetch(`/api/editor-ai/actions/${action.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/editor-ai/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const message = json?.error?.message ?? "操作失败";
        toast.error(message);
        return;
      }

      toast.success("已保存");
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  }, [form, isEdit, action, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑模板" : "新建模板"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "修改 AI 助手的 Prompt 模板配置"
              : "创建一个 AI 助手 Prompt 模板，可快速复用"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-action-name">
              名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ai-action-name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              maxLength={50}
              placeholder="例如：润色文本"
            />
          </div>

          {/* Icon */}
          <div className="flex flex-col gap-1.5">
            <Label>图标</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`inline-flex size-8 items-center justify-center rounded-md border text-base transition-colors ${
                    form.icon === emoji
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:bg-muted"
                  }`}
                  onClick={() => updateField("icon", emoji)}
                >
                  {emoji}
                </button>
              ))}
              <Input
                value={form.icon}
                onChange={(e) => updateField("icon", e.target.value)}
                maxLength={10}
                placeholder="自定义"
                className="h-8 w-16 text-center text-base"
              />
            </div>
          </div>

          {/* Category + Scope in a row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ai-action-category">分组</Label>
              <select
                id="ai-action-category"
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Scope */}
            <div className="flex flex-col gap-1.5">
              <Label>作用域</Label>
              <div className="flex items-center gap-3 pt-1">
                {SCOPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={opt.value}
                      checked={form.scope === opt.value}
                      onChange={(e) =>
                        updateField(
                          "scope",
                          e.target.value as FormState["scope"],
                        )
                      }
                      className="accent-primary"
                    />
                    <span className="text-muted-foreground">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Prompt */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-action-prompt">
              Prompt 模板 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ai-action-prompt"
              value={form.prompt}
              onChange={(e) => updateField("prompt", e.target.value)}
              maxLength={2000}
              placeholder="输入 Prompt 模板..."
              rows={6}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground">
              可用变量：
              <code className="mx-0.5 rounded bg-muted px-1 text-xs">
                {"{{selection}}"}
              </code>
              <code className="mx-0.5 rounded bg-muted px-1 text-xs">
                {"{{context}}"}
              </code>
              <code className="mx-0.5 rounded bg-muted px-1 text-xs">
                {"{{instruction}}"}
              </code>
              — 分别代表选中文本、上下文段落、附加指令
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
