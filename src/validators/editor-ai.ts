// src/validators/editor-ai.ts
import { z } from "zod";

export const createActionSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().max(10).optional(),
  prompt: z.string().min(1).max(2000),
  category: z.enum(["general", "writing", "translation", "analysis"]).optional(),
  scope: z.enum(["selection", "paragraph", "document"]).optional(),
});

export const updateActionSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().max(10).optional(),
  prompt: z.string().min(1).max(2000).optional(),
  category: z.enum(["general", "writing", "translation", "analysis"]).optional(),
  scope: z.enum(["selection", "paragraph", "document"]).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const executeActionSchema = z.object({
  actionId: z.string().optional(),
  prompt: z.string().max(2000).optional(),
  selection: z.string().optional(),
  context: z.string().optional(),
  instruction: z.string().max(1000).optional(),
  model: z.string().optional(),
}).refine((data) => data.actionId || data.prompt, {
  message: "必须提供 actionId 或 prompt",
});

export const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1),
    })
  ).min(1),
  model: z.string().min(1),
  context: z.object({
    sectionContent: z.string().optional(),
    pinnedSelections: z.array(z.string()).optional(),
  }).optional(),
});

export type CreateActionInput = z.infer<typeof createActionSchema>;
export type UpdateActionInput = z.infer<typeof updateActionSchema>;
export type ExecuteActionInput = z.infer<typeof executeActionSchema>;
export type ChatInput = z.infer<typeof chatSchema>;
