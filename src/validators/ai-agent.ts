import { z } from "zod";

// ========== Chat Schemas ==========

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1, "消息内容不能为空"),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1, "消息不能为空").max(2000, "消息最长2000字符"),
  tableId: z.string().optional(),
  conversationId: z.string().optional(),
  attachmentIds: z.array(z.string().min(1)).max(10, "附件最多10个").optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .max(20, "历史记录最多20条")
    .optional(),
});

export const createConversationSchema = z.object({
  initialTableId: z.string().optional(),
  title: z.string().trim().min(1).max(120).optional(),
});

export const renameConversationSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(120, "标题最长120字符"),
});

export const conversationMessageSchema = z.object({
  message: z.string().min(1, "消息不能为空").max(4000, "消息最长4000字符"),
  attachmentIds: z.array(z.string().min(1)).max(10, "附件最多10个").optional(),
  tableId: z.string().optional(),
});

// ========== Aggregate Schemas ==========

export const aggregateFilterSchema = z.object({
  field: z.string().min(1, "字段不能为空"),
  operator: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in"]),
  value: z.unknown(),
});

export const aggregateRequestSchema = z.object({
  tableId: z.string().min(1, "表ID不能为空"),
  field: z.string().min(1, "字段不能为空"),
  operation: z.enum(["count", "sum", "avg", "min", "max"]),
  filters: z.array(aggregateFilterSchema).optional(),
});

// ========== Confirm Schemas ==========

export const confirmRequestSchema = z.object({
  confirmToken: z.string().min(1, "确认令牌不能为空"),
  // action 已存储在 token 内部，无需重复传递
});

// ========== Type Exports ==========

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type RenameConversationInput = z.infer<typeof renameConversationSchema>;
export type ConversationMessageInput = z.infer<typeof conversationMessageSchema>;
export type AggregateFilter = z.infer<typeof aggregateFilterSchema>;
export type AggregateRequestInput = z.infer<typeof aggregateRequestSchema>;
export type ConfirmRequestInput = z.infer<typeof confirmRequestSchema>;
