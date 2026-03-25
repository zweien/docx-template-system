"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, Sparkles } from "lucide-react";
import { DataPickerDialog } from "./data-picker-dialog";

interface Placeholder {
  id: string;
  key: string;
  label: string;
  inputType: "TEXT" | "TEXTAREA";
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  sourceTableId?: string | null;
  sourceField?: string | null;
  enablePicker: boolean;
}

interface TableField {
  id: string;
  key: string;
  label: string;
  type: string;
}

interface DynamicFormProps {
  templateId: string;
  placeholders: Placeholder[];
  initialData?: Record<string, string>;
  draftId?: string;
}

export function DynamicForm({
  templateId,
  placeholders,
  initialData,
  draftId,
}: DynamicFormProps) {
  const router = useRouter();
  const sorted = [...placeholders].sort((a, b) => a.sortOrder - b.sortOrder);

  // Initialize form state
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const ph of sorted) {
      initial[ph.key] =
        initialData?.[ph.key] ?? ph.defaultValue ?? "";
    }
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Data picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activePickerPlaceholder, setActivePickerPlaceholder] = useState<Placeholder | null>(null);
  const [tableFields, setTableFields] = useState<TableField[]>([]);

  // Handle picker selection - auto-fill related fields via cascade API
  const handlePickerSelect = async (record: { id: string; data: Record<string, unknown> }) => {
    if (!activePickerPlaceholder?.sourceTableId) return;

    try {
      // Call cascade resolve API
      const res = await fetch("/api/fill/resolve-cascade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          sourceTableId: activePickerPlaceholder.sourceTableId,
          recordId: record.id,
        }),
      });

      if (!res.ok) throw new Error("解析级联数据失败");

      const data = await res.json();
      // Auto-fill all related fields
      setFormData((prev) => {
        const updated = { ...prev };
        Object.entries(data).forEach(([key, value]) => {
          updated[key] = String(value ?? "");
        });
        return updated;
      });

      toast.success("已自动填充关联字段");
    } catch (error) {
      console.error("自动填充失败:", error);
      toast.error("自动填充失败");
    }
  };

  // Open picker and load table fields
  const handleOpenPicker = async (ph: Placeholder) => {
    setActivePickerPlaceholder(ph);

    try {
      // Get field list from data table API
      if (ph.sourceTableId) {
        const res = await fetch(`/api/data-tables/${ph.sourceTableId}/fields`);
        if (res.ok) {
          const fields = await res.json();
          setTableFields(fields);
        }
      }
    } catch (error) {
      console.error("获取字段列表失败:", error);
      setTableFields([]);
    }

    setPickerOpen(true);
  };

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear error on change
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const ph of sorted) {
      if (ph.required && !formData[ph.key]?.trim()) {
        newErrors[ph.key] = `${ph.label}不能为空`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const url = draftId ? `/api/drafts/${draftId}` : "/api/drafts";
      const method = draftId ? "PUT" : "POST";
      const body = draftId
        ? { templateId, formData }
        : { templateId, formData };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(draftId ? "草稿已更新" : "草稿已保存");
        router.push("/drafts");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "保存草稿失败");
      }
    } catch {
      toast.error("保存草稿失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!validate()) return;

    setGenerating(true);
    try {
      // Step 1: Create record
      const recordRes = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, formData }),
      });

      if (!recordRes.ok) {
        const data = await recordRes.json().catch(() => null);
        toast.error(data?.error?.message || "创建记录失败");
        return;
      }

      const recordData = await recordRes.json();
      const recordId = recordData.data.id;

      // Step 2: Trigger generation
      const genRes = await fetch(`/api/records/${recordId}/generate`, {
        method: "POST",
      });

      if (!genRes.ok) {
        const data = await genRes.json().catch(() => null);
        toast.error(data?.error?.message || "生成文档失败");
        return;
      }

      toast.success("文档生成成功");
      router.push(`/records/${recordId}`);
    } catch {
      toast.error("生成文档失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>表单字段</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sorted.map((ph) => (
              <div key={ph.key} className="space-y-2">
                <Label htmlFor={ph.key}>
                  {ph.label}
                  {ph.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                <div className={ph.enablePicker ? "flex gap-2" : ""}>
                  {ph.inputType === "TEXT" ? (
                    <Input
                      id={ph.key}
                      value={formData[ph.key]}
                      onChange={(e) => handleChange(ph.key, e.target.value)}
                      placeholder={`请输入${ph.label}`}
                      aria-invalid={!!errors[ph.key]}
                      disabled={saving || generating}
                      className={ph.enablePicker ? "flex-1" : "w-full"}
                    />
                  ) : (
                    <Textarea
                      id={ph.key}
                      value={formData[ph.key]}
                      onChange={(e) => handleChange(ph.key, e.target.value)}
                      placeholder={`请输入${ph.label}`}
                      rows={3}
                      aria-invalid={!!errors[ph.key]}
                      disabled={saving || generating}
                      className={ph.enablePicker ? "flex-1" : "w-full"}
                    />
                  )}
                  {ph.enablePicker && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenPicker(ph)}
                      disabled={saving || generating}
                    >
                      选择数据
                    </Button>
                  )}
                </div>
                {errors[ph.key] && (
                  <p className="text-sm text-destructive">{errors[ph.key]}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={handleSaveDraft}
          disabled={saving || generating}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "保存中..." : "保存草稿"}
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={saving || generating}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generating ? "生成中..." : "确认生成"}
        </Button>
      </div>

      {/* Data Picker Dialog */}
      <DataPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        placeholderId={activePickerPlaceholder?.id ?? ""}
        fields={tableFields}
        onSelect={handlePickerSelect}
      />
    </div>
  );
}
