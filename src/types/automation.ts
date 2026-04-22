export type AutomationTrigger =
  | { type: "record_created" }
  | { type: "record_updated"; fieldKeys?: string[] }
  | { type: "record_deleted" }
  | { type: "field_changed"; fieldKey: string; from?: unknown; to?: unknown }
  | {
      type: "schedule";
      schedule: {
        mode: "daily" | "weekly" | "monthly";
        time: string;
        weekday?: number;
        dayOfMonth?: number;
      };
    }
  | { type: "manual" };

export type AutomationConditionLeaf = {
  kind: "leaf";
  field: string;
  op: "eq" | "ne" | "contains" | "gt" | "lt";
  value: unknown;
};

export type AutomationConditionGroup = {
  kind: "group";
  operator: "AND" | "OR";
  conditions: Array<AutomationConditionLeaf | AutomationConditionGroup>;
};

export type AutomationActionNode =
  | { id: string; type: "update_field"; fieldKey: string; value: unknown }
  | { id: string; type: "create_record"; tableId: string; values: Record<string, unknown> }
  | {
      id: string;
      type: "call_webhook";
      url: string;
      method: "POST" | "PUT";
      headers?: Record<string, string>;
      body?: unknown;
    }
  | { id: string; type: "add_comment"; target: "current_record"; content: string };

export type AutomationCanvasNode = {
  id: string;
  type: string;
  x: number;
  y: number;
};

export type AutomationCanvasEdge = {
  source: string;
  target: string;
  handle?: string;
};

export type AutomationDefinition = {
  version: 1;
  canvas: {
    nodes: AutomationCanvasNode[];
    edges: AutomationCanvasEdge[];
  };
  trigger: AutomationTrigger;
  condition: AutomationConditionGroup | null;
  thenActions: AutomationActionNode[];
  elseActions: AutomationActionNode[];
};

export type AutomationTriggerType = AutomationTrigger["type"];
export type AutomationRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED";
export type AutomationTriggerSource = "EVENT" | "SCHEDULE" | "MANUAL";
export type AutomationRunBranch = "THEN" | "ELSE";
export type AutomationRunStepStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED";

export interface AutomationActorSnapshot {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface AutomationExecutionContext {
  tableId: string;
  record: Record<string, unknown> | null;
  previousRecord: Record<string, unknown> | null;
  changedFields: string[];
  triggeredAt: string;
  actor?: AutomationActorSnapshot | null;
}

export interface EnqueueAutomationRunInput {
  automationId: string;
  triggerSource: AutomationTriggerSource;
  triggerPayload: Record<string, unknown>;
  contextSnapshot: AutomationExecutionContext;
}

export interface AutomationItem {
  id: string;
  tableId: string;
  tableName?: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  definitionVersion: number;
  createdById: string;
  updatedById: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AutomationDetail extends AutomationItem {
  definition: AutomationDefinition;
}

export interface AutomationRunItem {
  id: string;
  automationId: string;
  status: AutomationRunStatus;
  triggerSource: AutomationTriggerSource;
  triggerPayload: Record<string, unknown>;
  contextSnapshot: Record<string, unknown>;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
}

export interface AutomationRunStepItem {
  id: string;
  runId: string;
  nodeId: string;
  stepType: AutomationActionNode["type"];
  branch: AutomationRunBranch;
  status: AutomationRunStepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  durationMs: number | null;
}
