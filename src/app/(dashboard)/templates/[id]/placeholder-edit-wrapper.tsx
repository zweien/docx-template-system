"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { getPlaceholderInputTypeLabel } from "@/lib/placeholder-input-type";

interface PlaceholderData {
  id: string;
  key: string;
  label: string;
  inputType: string;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  description: string | null;
}

const EDITABLE_INPUT_TYPES = new Set(["TEXT", "TEXTAREA"]);

export function PlaceholderEditButton({ placeholder }: { placeholder: PlaceholderData }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(placeholder.label);
  const [inputType, setInputType] = useState<string>(placeholder.inputType);
  const [required, setRequired] = useState(placeholder.required);
  const [defaultValue, setDefaultValue] = useState(placeholder.defaultValue ?? "");
  const [sortOrder, setSortOrder] = useState(placeholder.sortOrder);
  const [description, setDescription] = useState(placeholder.description ?? "");

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error("标签不能为空");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/placeholders/${placeholder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, inputType, required, defaultValue: defaultValue || null, sortOrder, description: description || null }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "保存失败");
        return;
      }

      toast.success("占位符已更新");
      setOpen(false);
      // Reload page data
      window.location.reload();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon-xs" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">编辑</span>
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) { setLabel(placeholder.label); setInputType(placeholder.inputType); setRequired(placeholder.required); setDefaultValue(placeholder.defaultValue ?? ""); setSortOrder(placeholder.sortOrder); setDescription(placeholder.description ?? ""); } setOpen(v); }}>
        <DialogContent className="w-[90vw] sm:w-full sm:max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>编辑占位符 - {placeholder.key}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ph-label">标签</Label>
              <Input
                id="ph-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="输入标签"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ph-input-type">输入类型</Label>
              {EDITABLE_INPUT_TYPES.has(placeholder.inputType) ? (
                <Select value={inputType} onValueChange={(v) => setInputType(v ?? "")}>
                  <SelectTrigger id="ph-input-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">单行文本</SelectItem>
                    <SelectItem value="TEXTAREA">多行文本</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="ph-input-type"
                  value={getPlaceholderInputTypeLabel(placeholder.inputType)}
                  readOnly
                />
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ph-required">必填</Label>
              <Switch
                id="ph-required"
                checked={required}
                onCheckedChange={setRequired}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ph-default">默认值</Label>
              <Input
                id="ph-default"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder="无"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ph-description">备注</Label>
              <Input
                id="ph-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="字段说明/备注"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ph-sort">排序</Label>
              <Input
                id="ph-sort"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
