"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DataViewConfig } from "@/types/data-table";

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
  currentConfig: DataViewConfig;
  onSaved: (viewId: string) => void;
}

export function SaveViewDialog({
  open,
  onOpenChange,
  tableId,
  currentConfig,
  onSaved,
}: SaveViewDialogProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nameInputRef, setNameInputRef] = useState<HTMLInputElement | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setSubmitting(false);
      // Auto-focus the input after dialog opens
      setTimeout(() => nameInputRef?.focus(), 0);
    }
  }, [open, nameInputRef]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("请输入视图名称");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/data-tables/${tableId}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          filters: currentConfig.filters,
          sortBy: currentConfig.sortBy,
          visibleFields: currentConfig.visibleFields,
          fieldOrder: currentConfig.fieldOrder,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error?.message ?? "保存视图失败");
        return;
      }

      toast.success("视图已保存");
      onSaved(data.data.id);
      onOpenChange(false);
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  // Build config summary
  const sortSummary = currentConfig.sortBy
    ? `${currentConfig.sortBy.fieldKey} ${
        currentConfig.sortBy.order === "asc" ? "升序" : "降序"
      }`
    : "无";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>保存视图</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* View name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="view-name">视图名称</Label>
            <Input
              id="view-name"
              ref={setNameInputRef}
              placeholder="输入视图名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !submitting) handleSubmit();
              }}
            />
          </div>

          <Separator />

          {/* Config summary */}
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">
              {currentConfig.filters.length} 个筛选条件
            </span>
            <span className="text-muted-foreground">
              排序: {sortSummary}
            </span>
            <span className="text-muted-foreground">
              {currentConfig.visibleFields.length} 个可见字段
            </span>
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
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
