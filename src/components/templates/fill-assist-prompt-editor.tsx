"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FillAssistPromptEditorProps {
  templateId: string;
  initialValue: string | null;
}

export function FillAssistPromptEditor({
  templateId,
  initialValue,
}: FillAssistPromptEditorProps) {
  const [prompt, setPrompt] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fillAssistPrompt: prompt || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error?.message || "保存失败");
        return;
      }
      setDirty(false);
      toast.success("AI 填充提示词已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-[rgb(255_255_255_/_0.06)] bg-[rgb(255_255_255_/_0.02)] p-3">
      <Label className="text-sm font-[510] text-[#d0d6e0]">AI 填充提示词</Label>
      <p className="text-xs text-[#8a8f98]">
        配置后，用户填表时 AI 助手将遵循此指令来生成填充建议。留空则使用默认行为。
      </p>
      <Textarea
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setDirty(true);
        }}
        placeholder="例如：请使用正式公文用语填写，金额字段使用大写中文数字..."
        rows={4}
        className="text-sm"
      />
      {dirty && (
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          保存提示词
        </Button>
      )}
    </div>
  );
}
