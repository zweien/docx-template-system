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

interface Placeholder {
  key: string;
  label: string;
  inputType: "TEXT" | "TEXTAREA";
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
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
                {ph.inputType === "TEXT" ? (
                  <Input
                    id={ph.key}
                    value={formData[ph.key]}
                    onChange={(e) => handleChange(ph.key, e.target.value)}
                    placeholder={`请输入${ph.label}`}
                    aria-invalid={!!errors[ph.key]}
                    disabled={saving || generating}
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
                  />
                )}
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
    </div>
  );
}
