import { z } from "zod";

export const createConversationSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  model: z.string().optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  isFavorite: z.boolean().optional(),
});

export const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant", "system"]),
      parts: z.array(z.unknown()),
      metadata: z.unknown().optional(),
    })
  ),
  model: z.string().min(1),
});

export const toolConfirmSchema = z.object({
  approved: z.boolean(),
});

export const createModelSchema = z.object({
  name: z.string().min(1).max(100),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
});

export const updateModelSchema = z.object({
  name: z.string().min(1).max(100),
  modelId: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
});

export const updateSettingsSchema = z.object({
  autoConfirmTools: z.record(z.string(), z.boolean()).optional(),
  defaultModel: z.string().optional(),
  showReasoning: z.boolean().optional(),
});

// Inferred types
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type ToolConfirmInput = z.infer<typeof toolConfirmSchema>;
export type CreateModelInput = z.infer<typeof createModelSchema>;
export type UpdateModelInput = z.infer<typeof updateModelSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
