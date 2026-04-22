"use client";

import { GitBranch, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AutomationDefinition } from "@/types/automation";

type CanvasProps = {
  value: AutomationDefinition;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onAddCondition: () => void;
  onAddThenAction: () => void;
  onAddElseAction: () => void;
  onRemoveCondition: () => void;
  onRemoveAction: (actionId: string, branch: "THEN" | "ELSE") => void;
};

function NodeCard({
  title,
  subtitle,
  selected,
  onClick,
  children,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`w-full rounded-2xl border text-left transition-all ${
        selected
          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
          : "border-border/70 bg-background/80 hover:border-border"
      }`}
    >
      <div className="space-y-1 p-4">
        <p className="text-sm font-[520] text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

export function AutomationCanvas({
  value,
  selectedNodeId,
  onSelectNode,
  onAddCondition,
  onAddThenAction,
  onAddElseAction,
  onRemoveCondition,
  onRemoveAction,
}: CanvasProps) {
  const conditionNode = value.canvas.nodes.find((node) => node.type === "condition") ?? null;

  return (
    <Card className="bg-card/90">
      <CardContent className="space-y-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-[520] uppercase tracking-[0.18em] text-muted-foreground">
              受限画布
            </p>
            <h3 className="mt-1 text-lg font-[520] text-foreground">触发器 → 条件 → 分支动作</h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            当前结构受限，避免画布失控
          </div>
        </div>

        <div className="space-y-4">
          <NodeCard
            title="触发器"
            subtitle={value.trigger.type}
            selected={selectedNodeId === "trigger-1"}
            onClick={() => onSelectNode("trigger-1")}
          />

          <div className="pl-6">
            {conditionNode ? (
              <div className="space-y-2">
                <NodeCard
                  title="条件分支"
                  subtitle={value.condition ? value.condition.operator : "AND"}
                  selected={selectedNodeId === conditionNode.id}
                  onClick={() => onSelectNode(conditionNode.id)}
                >
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveCondition();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </NodeCard>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={onAddCondition}>
                <Plus className="h-4 w-4" />
                添加条件节点
              </Button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-[520] text-foreground">Then 分支</p>
                  <p className="text-xs text-muted-foreground">条件满足时顺序执行</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onAddThenAction}>
                  <Plus className="h-4 w-4" />
                  添加动作
                </Button>
              </div>

              <div className="space-y-2">
                {value.thenActions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    暂无动作
                  </div>
                ) : (
                  value.thenActions.map((action) => (
                    <NodeCard
                      key={action.id}
                      title={action.type}
                      subtitle={action.id}
                      selected={selectedNodeId === action.id}
                      onClick={() => onSelectNode(action.id)}
                    >
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveAction(action.id, "THEN");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </NodeCard>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-[520] text-foreground">Else 分支</p>
                  <p className="text-xs text-muted-foreground">条件不满足时顺序执行</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onAddElseAction}>
                  <Plus className="h-4 w-4" />
                  添加动作
                </Button>
              </div>

              <div className="space-y-2">
                {value.elseActions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                    暂无动作
                  </div>
                ) : (
                  value.elseActions.map((action) => (
                    <NodeCard
                      key={action.id}
                      title={action.type}
                      subtitle={action.id}
                      selected={selectedNodeId === action.id}
                      onClick={() => onSelectNode(action.id)}
                    >
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveAction(action.id, "ELSE");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </NodeCard>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
            <Play className="h-4 w-4 text-primary" />
            保存时会校验触发器唯一性与基础拓扑结构。
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
