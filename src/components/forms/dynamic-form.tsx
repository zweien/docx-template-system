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
import { cn } from "@/lib/utils";
import { DataPickerDialog } from "./data-picker-dialog";
import { DynamicTableField } from "./dynamic-table-field";
import { ChoicePickerField } from "./choice-picker-field";
import { AiFillAssistant } from "./ai-fill-assistant";

interface Placeholder {
  id: string;
  key: string;
  label: string;
  inputType: "TEXT" | "TEXTAREA" | "TABLE" | "CHOICE_SINGLE" | "CHOICE_MULTI";
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  sourceTableId?: string | null;
  sourceField?: string | null;
  enablePicker: boolean;
  columns?: Array<{ key: string; label: string }>;
  choiceConfig?: {
    mode: "single" | "multiple";
    options: Array<{ value: string; label: string }>;
    marker: { template: string; checked: string; unchecked: string };
  } | null;
  description?: string | null;
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
  initialData?: Record<string, string | string[] | Record<string, string>[]>;
  draftId?: string;
}

type FormFieldValue = string | string[] | Record<string, string>[];

export function DynamicForm({
  templateId,
  placeholders,
  initialData,
  draftId,
}: DynamicFormProps) {
  const router = useRouter();
  const sorted = [...placeholders].sort((a, b) => a.sortOrder - b.sortOrder);

  // Initialize form state
  const [formData, setFormData] = useState<Record<string, FormFieldValue>>(() => {
    const initial: Record<string, FormFieldValue> = {};
    for (const ph of sorted) {
      if (ph.inputType === "TABLE") {
        initial[ph.key] = (initialData?.[ph.key] as Record<string, string>[]) ?? [];
      } else if (ph.inputType === "CHOICE_MULTI") {
        initial[ph.key] = (initialData?.[ph.key] as string[]) ?? [];
      } else {
        initial[ph.key] = (initialData?.[ph.key] as string) ?? ph.defaultValue ?? "";
      }
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
      console.log("resolve-cascade response:", data);

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

  const handleTableChange = (key: string, rows: Record<string, string>[]) => {
    setFormData((prev) => ({ ...prev, [key]: rows }));
  };

  const handleChoiceChange = (key: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
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
      // Skip TABLE type - no validation needed for table data
      if (ph.inputType === "TABLE") continue;
      if (!ph.required) continue;

      const value = formData[ph.key];
      if (ph.inputType === "CHOICE_MULTI") {
        if (!Array.isArray(value) || value.length === 0) {
          newErrors[ph.key] = `${ph.label}不能为空`;
        }
        continue;
      }

      if (typeof value !== "string" || !value.trim()) {
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
                <Label htmlFor={ph.key} className="text-sm font-medium">
                  {ph.label}
                  {ph.required && (
                    <span className="text-destructive ml-1">*</span>
                  )}
                </Label>
                {ph.description && (
                  <p className="text-xs text-muted-foreground">{ph.description}</p>
                )}
                {ph.inputType === "TABLE" ? (
                  <DynamicTableField
                    label={ph.label}
                    columns={ph.columns ?? []}
                    value={(formData[ph.key] as Record<string, string>[]) ?? []}
                    onChange={(rows) => handleTableChange(ph.key, rows)}
                    disabled={saving || generating}
                  />
                ) : ph.inputType === "CHOICE_SINGLE" || ph.inputType === "CHOICE_MULTI" ? (
                  <ChoicePickerField
                    mode={ph.inputType === "CHOICE_SINGLE" ? "single" : "multiple"}
                    options={ph.choiceConfig?.options ?? []}
                    value={
                      ph.inputType === "CHOICE_MULTI"
                        ? ((formData[ph.key] as string[]) ?? [])
                        : ((formData[ph.key] as string) ?? "")
                    }
                    onChange={(value) => handleChoiceChange(ph.key, value)}
                    disabled={saving || generating}
                  />
                ) : (
                  <div className={cn(
                    "gap-2",
                    ph.enablePicker ? "flex flex-col sm:flex-row" : ""
                  )}>
                    {ph.inputType === "TEXT" ? (
                      <Input
                        id={ph.key}
                        value={formData[ph.key] as string}
                        onChange={(e) => handleChange(ph.key, e.target.value)}
                        placeholder={`请输入${ph.label}`}
                        aria-invalid={!!errors[ph.key]}
                        disabled={saving || generating}
                        className={cn(
                          "transition-colors",
                          ph.enablePicker ? "flex-1" : "w-full"
                        )}
                      />
                    ) : (
                      <Textarea
                        id={ph.key}
                        value={formData[ph.key] as string}
                        onChange={(e) => handleChange(ph.key, e.target.value)}
                        placeholder={`请输入${ph.label}`}
                        rows={3}
                        aria-invalid={!!errors[ph.key]}
                        disabled={saving || generating}
                        className={cn(
                          "transition-colors resize-none",
                          ph.enablePicker ? "flex-1" : "w-full"
                        )}
                      />
                    )}
                    {ph.enablePicker && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenPicker(ph)}
                        disabled={saving || generating}
                        className="shrink-0 w-full sm:w-auto"
                      >
                        选择数据
                      </Button>
                    )}
                  </div>
                )}
                {errors[ph.key] && (
                  <p className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    {errors[ph.key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons - responsive layout */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end pt-2">
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={saving || generating}
          className="w-full sm:w-auto"
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
          className="w-full sm:w-auto"
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

      {/* AI Fill Assistant */}
      <AiFillAssistant
        templateName={templateId}
        fields={sorted.map((ph) => ({
          key: ph.key,
          label: ph.label,
          type: ph.inputType,
          description: ph.description ?? undefined,
        }))}
        currentValues={Object.fromEntries(
          Object.entries(formData).map(([k, v]) => [
            k,
            typeof v === "string" ? v : JSON.stringify(v),
          ])
        )}
        onFill={(values) => {
          setFormData((prev) => ({ ...prev, ...values }));
          // Clear errors for filled fields
          setErrors((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(values)) {
              delete next[key];
            }
            return next;
          });
        }}
      />
    </div>
  );
}
