"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AutomationCanvas } from "@/components/automations/automation-canvas";
import { AutomationConfigPanel } from "@/components/automations/automation-config-panel";
import type { AutomationDefinition } from "@/types/automation";

type AutomationEditorProps = {
  automationId: string;
  initialName: string;
  initialDescription: string | null;
  initialEnabled: boolean;
  initialValue: AutomationDefinition;
};

function createDefaultAction(actionId: string) {
  return {
    id: actionId,
    type: "add_comment" as const,
    target: "current_record" as const,
    content: "",
  };
}

function createDefaultConditionNode() {
  return {
    id: "condition-1",
    type: "condition",
    x: 320,
    y: 120,
  };
}

function validateBeforeSave(nextValue: AutomationDefinition) {
  const triggerNodes = nextValue.canvas.nodes.filter((node) => node.type === "trigger");
  const conditionNodes = nextValue.canvas.nodes.filter((node) => node.type === "condition");

  if (triggerNodes.length !== 1) return "必须且只能存在一个触发器节点";
  if (conditionNodes.length > 1) return "第一期仅支持一个条件节点";
  return null;
}

export function AutomationEditor({
  automationId,
  initialName,
  initialDescription,
  initialEnabled,
  initialValue,
}: AutomationEditorProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [value, setValue] = useState(initialValue);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("trigger-1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const nextActionId = useMemo(
    () => value.thenActions.length + value.elseActions.length + 1,
    [value.elseActions.length, value.thenActions.length]
  );

  function addCondition() {
    if (value.canvas.nodes.some((node) => node.type === "condition")) {
      return;
    }
    setValue({
      ...value,
      canvas: {
        ...value.canvas,
        nodes: [...value.canvas.nodes, createDefaultConditionNode()],
      },
      condition: {
        kind: "group",
        operator: "AND",
        conditions: [
          {
            kind: "leaf",
            field: "record.status",
            op: "eq",
            value: "",
          },
        ],
      },
    });
    setSelectedNodeId("condition-1");
  }

  function addAction(branch: "THEN" | "ELSE") {
    const action = createDefaultAction(`action-${nextActionId}`);
    setValue({
      ...value,
      [branch === "THEN" ? "thenActions" : "elseActions"]: [
        ...(branch === "THEN" ? value.thenActions : value.elseActions),
        action,
      ],
      canvas: {
        ...value.canvas,
        nodes: [
          ...value.canvas.nodes,
          {
            id: action.id,
            type: "action",
            x: branch === "THEN" ? 560 : 560,
            y: branch === "THEN" ? 80 + value.thenActions.length * 96 : 240 + value.elseActions.length * 96,
          },
        ],
      },
    });
    setSelectedNodeId(action.id);
  }

  function removeCondition() {
    setValue({
      ...value,
      condition: null,
      canvas: {
        ...value.canvas,
        nodes: value.canvas.nodes.filter((node) => node.type !== "condition"),
      },
    });
    setSelectedNodeId("trigger-1");
  }

  function removeAction(actionId: string, branch: "THEN" | "ELSE") {
    setValue({
      ...value,
      [branch === "THEN" ? "thenActions" : "elseActions"]: (
        branch === "THEN" ? value.thenActions : value.elseActions
      ).filter((action) => action.id !== actionId),
      canvas: {
        ...value.canvas,
        nodes: value.canvas.nodes.filter((node) => node.id !== actionId),
      },
    });
    setSelectedNodeId("trigger-1");
  }

  async function handleSave() {
    const validationError = validateBeforeSave(value);
    setError(validationError);
    setSavedMessage(null);
    if (validationError) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          enabled,
          triggerType: value.trigger.type,
          definition: value,
        }),
      });

      const payload = (await response.json()) as
        | { success: true }
        | { error?: { message?: string } };

      if (!response.ok) {
        const message = "error" in payload ? payload.error?.message : undefined;
        setError(message ?? "保存自动化失败");
        return;
      }

      setError(null);
      setSavedMessage("自动化已保存");
    } catch {
      setError("保存自动化失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="bg-card/90">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-[520] text-foreground">自动化名称</label>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-[520] text-foreground">描述</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="space-y-2">
                <p className="text-sm font-[520] text-foreground">启用状态</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {enabled ? "当前自动生效" : "当前已停用"}
                  </span>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存自动化
              </Button>
            </div>
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <CircleAlert className="h-4 w-4" />
              {error}
            </div>
          ) : null}
          {savedMessage ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {savedMessage}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_380px]">
        <AutomationCanvas
          value={value}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onAddCondition={addCondition}
          onAddThenAction={() => addAction("THEN")}
          onAddElseAction={() => addAction("ELSE")}
          onRemoveCondition={removeCondition}
          onRemoveAction={removeAction}
        />
        <AutomationConfigPanel
          value={value}
          selectedNodeId={selectedNodeId}
          onChange={setValue}
        />
      </div>
    </div>
  );
}
