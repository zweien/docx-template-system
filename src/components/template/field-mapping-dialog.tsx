"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";
import type { TemplateFieldMapping } from "@/types/template";
import type { DataFieldItem } from "@/types/data-table";

interface FieldMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  placeholders: Array<{ key: string; label: string; required: boolean }>;
  fields: DataFieldItem[];
  currentMapping: TemplateFieldMapping | null;
  onUpdate: () => void;
}

export function FieldMappingDialog({
  open,
  onOpenChange,
  templateId,
  placeholders,
  fields,
  currentMapping,
  onUpdate,
}: FieldMappingDialogProps) {
  const router = useRouter();
  const [mapping, setMapping] = useState<TemplateFieldMapping>(() => {
    // 初始化映射：自动匹配同名占位符和字段
    const initial: TemplateFieldMapping = {};
    placeholders.forEach((ph) => {
      if (currentMapping && currentMapping[ph.key] !== undefined) {
        initial[ph.key] = currentMapping[ph.key];
      } else {
        // 自动匹配同名
        const matchedField = fields.find((f) => f.key === ph.key);
        initial[ph.key] = matchedField ? matchedField.key : null;
      }
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);

  // 选项列表：数据表字段 + 「不映射」
  const fieldOptions = useMemo(() => {
    const options = [
      { value: "", label: "不映射" },
      ...fields.map((f) => ({ value: f.key, label: `${f.label} (${f.key})` })),
    ];
    return options;
  }, [fields]);

  const handleMappingChange = (placeholderKey: string, fieldKey: string | null) => {
    setMapping((prev) => ({
      ...prev,
      [placeholderKey]: fieldKey && fieldKey !== "_none" ? fieldKey : null,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldMapping: mapping }),
      });

      if (response.ok) {
        onUpdate();
        router.refresh();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("保存映射失败:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>字段映射配置</DialogTitle>
          <DialogDescription>
            配置模板占位符到数据表字段的映射关系
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-sm font-medium text-muted-foreground">
            <span>模板占位符</span>
            <span></span>
            <span>数据表字段</span>
          </div>

          {placeholders.map((ph) => {
            const currentValue = mapping[ph.key];
            const isAutoMatched = currentValue === ph.key; // 同名自动匹配

            return (
              <div
                key={ph.key}
                className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{ph.key}</span>
                  {ph.required && (
                    <Badge variant="destructive" className="text-xs">
                      必填
                    </Badge>
                  )}
                </div>
                <span className="text-muted-foreground">&rarr;</span>
                <div className="flex items-center gap-2">
                  <Select
                    value={currentValue || ""}
                    onValueChange={(v) => handleMappingChange(ph.key, v)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="选择字段" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map((opt) => (
                        <SelectItem key={opt.value || "_none"} value={opt.value || "_none"}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isAutoMatched && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      自动匹配
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            保存映射
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
