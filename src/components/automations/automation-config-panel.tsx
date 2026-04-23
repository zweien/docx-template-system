"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AutomationActionNode,
  AutomationDefinition,
  AutomationTrigger,
  CallWebhookAction,
  CreateRecordAction,
  UpdateFieldAction,
  UpdateRelatedRecordsAction,
  AddCommentAction,
} from "@/types/automation";

type ConfigPanelProps = {
  value: AutomationDefinition;
  selectedNodeId: string | null;
  onChange: (nextValue: AutomationDefinition) => void;
};

function createDefaultCondition() {
  return {
    kind: "group" as const,
    operator: "AND" as const,
    conditions: [
      {
        kind: "leaf" as const,
        field: "record.status",
        op: "eq" as const,
        value: "",
      },
    ],
  };
}

function updateAction(
  value: AutomationDefinition,
  actionId: string,
  updater: (action: AutomationActionNode) => AutomationActionNode
): AutomationDefinition {
  return {
    ...value,
    thenActions: value.thenActions.map((action) =>
      action.id === actionId ? updater(action) : action
    ),
    elseActions: value.elseActions.map((action) =>
      action.id === actionId ? updater(action) : action
    ),
  };
}

export function AutomationConfigPanel({
  value,
  selectedNodeId,
  onChange,
}: ConfigPanelProps) {
  if (!selectedNodeId) {
    return (
      <Card className="bg-card/90">
        <CardContent className="px-5 py-12 text-center text-sm text-muted-foreground">
          选择左侧节点后，在这里配置触发器、条件和动作参数。
        </CardContent>
      </Card>
    );
  }

  if (selectedNodeId === "trigger-1") {
    const trigger = value.trigger;

    function updateTrigger(nextTrigger: AutomationTrigger) {
      onChange({ ...value, trigger: nextTrigger });
    }

    return (
      <Card className="bg-card/90">
        <CardHeader>
          <CardTitle className="text-base font-[520]">触发器配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-[520] text-foreground">触发类型</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
              value={trigger.type}
              onChange={(event) => {
                const nextType = event.target.value as AutomationTrigger["type"];
                if (nextType === "record_updated") {
                  updateTrigger({ type: nextType, fieldKeys: [] });
                  return;
                }
                if (nextType === "field_changed") {
                  updateTrigger({ type: nextType, fieldKey: "status" });
                  return;
                }
                if (nextType === "schedule") {
                  updateTrigger({
                    type: nextType,
                    schedule: { mode: "daily", time: "09:00" },
                  });
                  return;
                }
                updateTrigger({ type: nextType });
              }}
            >
              <option value="record_created">记录创建时</option>
              <option value="record_updated">记录更新时</option>
              <option value="record_deleted">记录删除时</option>
              <option value="field_changed">字段变更时</option>
              <option value="schedule">定时触发</option>
              <option value="manual">手动触发</option>
            </select>
          </div>

          {trigger.type === "field_changed" && (
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">监听字段</label>
              <Input
                value={trigger.fieldKey}
                onChange={(event) =>
                  updateTrigger({ ...trigger, fieldKey: event.target.value })
                }
              />
            </div>
          )}

          {trigger.type === "schedule" && (
            <div className="grid gap-3">
              <div className="space-y-2">
                <label className="text-sm font-[520] text-foreground">执行频率</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
                  value={trigger.schedule.mode}
                  onChange={(event) =>
                    updateTrigger({
                      ...trigger,
                      schedule: {
                        ...trigger.schedule,
                        mode: event.target.value as "daily" | "weekly" | "monthly",
                      },
                    })
                  }
                >
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-[520] text-foreground">时间</label>
                <Input
                  value={trigger.schedule.time}
                  onChange={(event) =>
                    updateTrigger({
                      ...trigger,
                      schedule: { ...trigger.schedule, time: event.target.value },
                    })
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (value.canvas.nodes.some((node) => node.id === selectedNodeId && node.type === "condition")) {
    const condition =
      value.condition?.kind === "group" ? value.condition : createDefaultCondition();
    const leaf = condition.conditions[0];
    const firstLeaf =
      leaf && leaf.kind === "leaf"
        ? leaf
        : {
            kind: "leaf" as const,
            field: "record.status",
            op: "eq" as const,
            value: "",
          };

    return (
      <Card className="bg-card/90">
        <CardHeader>
          <CardTitle className="text-base font-[520]">条件配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-[520] text-foreground">逻辑关系</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
              value={condition.operator}
              onChange={(event) =>
                onChange({
                  ...value,
                  condition: {
                    ...condition,
                    operator: event.target.value as "AND" | "OR",
                    conditions: [firstLeaf],
                  },
                })
              }
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-[520] text-foreground">字段路径</label>
            <Input
              value={firstLeaf.field}
              onChange={(event) =>
                onChange({
                  ...value,
                  condition: {
                    ...condition,
                    conditions: [{ ...firstLeaf, field: event.target.value }],
                  },
                })
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-[520] text-foreground">操作符</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
              value={firstLeaf.op}
              onChange={(event) =>
                onChange({
                  ...value,
                  condition: {
                    ...condition,
                    conditions: [
                      {
                        ...firstLeaf,
                        op: event.target.value as "eq" | "ne" | "contains" | "gt" | "lt",
                      },
                    ],
                  },
                })
              }
            >
              <option value="eq">等于</option>
              <option value="ne">不等于</option>
              <option value="contains">包含</option>
              <option value="gt">大于</option>
              <option value="lt">小于</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-[520] text-foreground">比较值</label>
            <Input
              value={String(firstLeaf.value ?? "")}
              onChange={(event) =>
                onChange({
                  ...value,
                  condition: {
                    ...condition,
                    conditions: [{ ...firstLeaf, value: event.target.value }],
                  },
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  const action =
    value.thenActions.find((item) => item.id === selectedNodeId) ??
    value.elseActions.find((item) => item.id === selectedNodeId) ??
    null;
  if (!action) {
    return null;
  }

  return (
    <Card className="bg-card/90">
      <CardHeader>
        <CardTitle className="text-base font-[520]">动作配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-[520] text-foreground">动作类型</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
            value={action.type}
            onChange={(event) => {
              const nextType = event.target.value as AutomationActionNode["type"];
              const nextAction: AutomationActionNode =
                nextType === "update_field"
                  ? { id: action.id, type: nextType, fieldKey: "status", value: "" }
                  : nextType === "create_record"
                    ? { id: action.id, type: nextType, tableId: value.canvas.nodes[0]?.id ?? "", values: {} }
                    : nextType === "update_related_records"
                      ? {
                          id: action.id,
                          type: nextType,
                          relationFieldKey: "relation",
                          targetScope: "all",
                          values: {},
                        }
                    : nextType === "call_webhook"
                      ? { id: action.id, type: nextType, url: "", method: "POST" }
                      : { id: action.id, type: nextType, target: "current_record", content: "" };
              onChange(updateAction(value, action.id, () => nextAction));
            }}
          >
            <option value="add_comment">添加评论</option>
            <option value="update_field">更新字段</option>
            <option value="create_record">创建记录</option>
            <option value="update_related_records">更新关联记录</option>
            <option value="call_webhook">调用 Webhook</option>
          </select>
        </div>

        {action.type === "update_field" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">字段 Key</label>
              <Input
                value={(action as UpdateFieldAction).fieldKey}
                onChange={(event) =>
                  onChange(
                    updateAction(value, action.id, (current) => ({
                      ...(current as UpdateFieldAction),
                      fieldKey: event.target.value,
                    }))
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">写入值</label>
              <Input
                value={String((action as UpdateFieldAction).value ?? "")}
                onChange={(event) =>
                  onChange(
                    updateAction(value, action.id, (current) => ({
                      ...(current as UpdateFieldAction),
                      value: event.target.value,
                    }))
                  )
                }
              />
            </div>
          </>
        )}

        {action.type === "create_record" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">目标数据表 ID</label>
              <Input
                value={(action as CreateRecordAction).tableId}
                onChange={(event) =>
                  onChange(
                    updateAction(value, action.id, (current) => ({
                      ...(current as CreateRecordAction),
                      tableId: event.target.value,
                    }))
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">字段值 JSON</label>
              <Textarea
                value={JSON.stringify((action as CreateRecordAction).values, null, 2)}
                onChange={(event) => {
                  try {
                    const nextValues = JSON.parse(event.target.value) as Record<string, unknown>;
                    onChange(
                      updateAction(value, action.id, (current) => ({
                        ...(current as CreateRecordAction),
                        values: nextValues,
                      }))
                    );
                  } catch {
                    // 保持最后一个合法值，避免 UI 状态与 DSL 失配
                  }
                }}
              />
            </div>
          </>
        )}

        {action.type === "update_related_records" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">关系字段 Key</label>
              <Input
                value={(action as UpdateRelatedRecordsAction).relationFieldKey}
                onChange={(event) =>
                  onChange(
                    updateAction(value, action.id, (current) => ({
                      ...(current as UpdateRelatedRecordsAction),
                      relationFieldKey: event.target.value,
                    }))
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">作用范围</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
                value={(action as UpdateRelatedRecordsAction).targetScope}
                onChange={(event) =>
                  onChange(
                    updateAction(value, action.id, (current) => ({
                      ...(current as UpdateRelatedRecordsAction),
                      targetScope: event.target.value as "first" | "all",
                    }))
                  )
                }
              >
                <option value="first">first</option>
                <option value="all">all</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">更新值 JSON</label>
              <Textarea
                value={JSON.stringify((action as UpdateRelatedRecordsAction).values, null, 2)}
                onChange={(event) => {
                  try {
                    const nextValues = JSON.parse(event.target.value) as Record<string, unknown>;
                    onChange(
                      updateAction(value, action.id, (current) => ({
                        ...(current as UpdateRelatedRecordsAction),
                        values: nextValues,
                      }))
                    );
                  } catch {
                    // 保持最后一个合法值，避免 UI 状态与 DSL 失配
                  }
                }}
              />
            </div>
          </>
        )}

        {action.type === "call_webhook" && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">Webhook URL</label>
              <Input
                value={(action as CallWebhookAction).url}
                onChange={(event) =>
                  onChange(
                    updateAction(value, action.id, (current) => ({
                      ...(current as CallWebhookAction),
                      url: event.target.value,
                    }))
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-[520] text-foreground">请求方法</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
                value={(action as CallWebhookAction).method}
                onChange={(event) =>
                  onChange(
                    updateAction(value, action.id, (current) => ({
                      ...(current as CallWebhookAction),
                      method: event.target.value as "POST" | "PUT",
                    }))
                  )
                }
              >
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
          </>
        )}

        {action.type === "add_comment" && (
          <div className="space-y-2">
            <label className="text-sm font-[520] text-foreground">评论内容</label>
            <Textarea
              value={(action as AddCommentAction).content}
              onChange={(event) =>
                onChange(
                  updateAction(value, action.id, (current) => ({
                    ...(current as AddCommentAction),
                    content: event.target.value,
                  }))
                )
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
