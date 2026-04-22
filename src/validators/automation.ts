import { z } from "zod";

const automationCanvasNodeSchema = z.object({
  id: z.string().trim().min(1, "节点 ID 不能为空"),
  type: z.string().trim().min(1, "节点类型不能为空"),
  x: z.number(),
  y: z.number(),
});

const automationCanvasEdgeSchema = z.object({
  source: z.string().trim().min(1, "边 source 不能为空"),
  target: z.string().trim().min(1, "边 target 不能为空"),
  handle: z.string().trim().min(1).optional(),
});

export const automationTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("record_created") }),
  z.object({
    type: z.literal("record_updated"),
    fieldKeys: z.array(z.string().trim().min(1)).optional(),
  }),
  z.object({ type: z.literal("record_deleted") }),
  z.object({
    type: z.literal("field_changed"),
    fieldKey: z.string().trim().min(1, "字段变更触发器必须指定字段"),
    from: z.unknown().optional(),
    to: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("schedule"),
    schedule: z.object({
      mode: z.enum(["daily", "weekly", "monthly"]),
      time: z.string().regex(/^\d{2}:\d{2}$/, "时间格式必须为 HH:mm"),
      weekday: z.number().int().min(0).max(6).optional(),
      dayOfMonth: z.number().int().min(1).max(31).optional(),
    }),
  }),
  z.object({ type: z.literal("manual") }),
]);

const automationTriggerTypeSchema = z.enum([
  "record_created",
  "record_updated",
  "record_deleted",
  "field_changed",
  "schedule",
  "manual",
]);

const automationConditionLeafSchema = z.object({
  kind: z.literal("leaf"),
  field: z.string().trim().min(1, "条件字段不能为空"),
  op: z.enum(["eq", "ne", "contains", "gt", "lt"]),
  value: z.unknown(),
});

export type AutomationConditionInput =
  | z.infer<typeof automationConditionLeafSchema>
  | {
      kind: "group";
      operator: "AND" | "OR";
      conditions: AutomationConditionInput[];
    };

export const automationConditionSchema: z.ZodType<AutomationConditionInput> = z.lazy(() =>
  z.union([
    automationConditionLeafSchema,
    z.object({
      kind: z.literal("group"),
      operator: z.enum(["AND", "OR"]),
      conditions: z.array(automationConditionSchema),
    }),
  ])
);

const automationActionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("update_field"),
    fieldKey: z.string().trim().min(1),
    value: z.unknown(),
  }),
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("create_record"),
    tableId: z.string().trim().min(1),
    values: z.record(z.string(), z.unknown()),
  }),
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("call_webhook"),
    url: z.string().url("Webhook URL 不合法"),
    method: z.enum(["POST", "PUT"]),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
  }),
  z.object({
    id: z.string().trim().min(1),
    type: z.literal("add_comment"),
    target: z.literal("current_record"),
    content: z.string().trim().min(1, "评论内容不能为空"),
  }),
]);

export const automationDefinitionSchema = z.object({
  version: z.literal(1),
  canvas: z.object({
    nodes: z.array(automationCanvasNodeSchema),
    edges: z.array(automationCanvasEdgeSchema),
  }),
  trigger: automationTriggerSchema,
  condition: automationConditionSchema.nullable(),
  thenActions: z.array(automationActionSchema),
  elseActions: z.array(automationActionSchema),
});

export const createAutomationSchema = z.object({
  name: z.string().trim().min(1, "自动化名称不能为空"),
  description: z.string().trim().max(1000).optional(),
  enabled: z.boolean().default(true),
  triggerType: automationTriggerTypeSchema,
  definition: automationDefinitionSchema,
});

export const updateAutomationSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  enabled: z.boolean().optional(),
  triggerType: automationTriggerTypeSchema.optional(),
  definition: automationDefinitionSchema.optional(),
});

export const manualAutomationRunSchema = z.object({
  recordId: z.string().trim().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
