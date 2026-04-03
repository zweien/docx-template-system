"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CollectionAssigneePicker,
  type CollectionAssigneeOption,
} from "./collection-assignee-picker";
import { CollectionAttachmentsUpload } from "./collection-attachments-upload";
import { CollectionRenameRuleEditor } from "./collection-rename-rule-editor";

interface CustomVariableRow {
  key: string;
  value: string;
}

function toDatetimeLocalValue(value: Date) {
  const offset = value.getTimezoneOffset();
  const localDate = new Date(value.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function CollectionTaskForm({
  assigneeOptions,
  onCreated,
}: {
  assigneeOptions: CollectionAssigneeOption[];
  onCreated?: (taskId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [dueAt, setDueAt] = useState(toDatetimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [renameRule, setRenameRule] = useState("{任务标题}_{姓名}");
  const [customVariables, setCustomVariables] = useState<CustomVariableRow[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renameVariables = customVariables.reduce<Record<string, string>>((result, item) => {
    const key = item.key.trim();
    const value = item.value.trim();
    if (key && value) {
      result[key] = value;
    }
    return result;
  }, {});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("instruction", instruction);
      formData.set("dueAt", dueAt);
      formData.set("renameRule", renameRule);
      formData.set("renameVariables", JSON.stringify(renameVariables));
      assigneeIds.forEach((assigneeId) => formData.append("assigneeIds", assigneeId));
      attachments.forEach((attachment) => formData.append("attachments", attachment));

      const response = await fetch("/api/collections", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        data?: { id: string };
        error?: { message?: string };
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "创建任务失败");
      }

      if (onCreated) {
        onCreated(payload.data.id);
      } else {
        window.location.assign(`/collections/${payload.data.id}`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "创建任务失败");
    } finally {
      setSubmitting(false);
    }
  }

  function updateVariable(index: number, field: keyof CustomVariableRow, value: string) {
    setCustomVariables((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新建文档收集任务</CardTitle>
        <CardDescription>填写基础信息后即可创建任务并分配提交人。</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="collection-title">任务标题</Label>
              <Input
                id="collection-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：营业执照收集"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="collection-instruction">提交说明</Label>
              <Textarea
                id="collection-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="说明文件要求、格式和注意事项"
                rows={5}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="collection-due-at">截止时间</Label>
              <Input
                id="collection-due-at"
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>提交人</Label>
              <CollectionAssigneePicker
                options={assigneeOptions}
                value={assigneeIds}
                onChange={setAssigneeIds}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>自定义变量</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCustomVariables((current) => [...current, { key: "", value: "" }])}
              >
                新增变量
              </Button>
            </div>

            <div className="space-y-2">
              {customVariables.length === 0 ? (
                <p className="text-sm text-muted-foreground">未配置自定义变量时，可直接使用内置变量。</p>
              ) : (
                customVariables.map((item, index) => (
                  <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <Input
                      placeholder="变量名，例如 部门"
                      value={item.key}
                      onChange={(event) => updateVariable(index, "key", event.target.value)}
                    />
                    <Input
                      placeholder="预设值，例如 财务部"
                      value={item.value}
                      onChange={(event) => updateVariable(index, "value", event.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setCustomVariables((current) =>
                          current.filter((_, currentIndex) => currentIndex !== index)
                        )
                      }
                    >
                      删除
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <CollectionRenameRuleEditor
            value={renameRule}
            onChange={setRenameRule}
            customVariables={renameVariables}
          />

          <CollectionAttachmentsUpload files={attachments} onChange={setAttachments} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              创建任务
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
