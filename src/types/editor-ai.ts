// src/types/editor-ai.ts

export interface EditorAIActionItem {
  id: string;
  name: string;
  icon: string | null;
  prompt: string;
  category: string;
  scope: "selection" | "paragraph" | "document";
  sortOrder: number;
  isBuiltIn: boolean;
  enabled: boolean;
  userId: string | null;
  createdAt: string;
}

export interface EditorAIActionCreateInput {
  name: string;
  icon?: string;
  prompt: string;
  category?: string;
  scope?: "selection" | "paragraph" | "document";
}

export interface EditorAIActionUpdateInput {
  name?: string;
  icon?: string;
  prompt?: string;
  category?: string;
  scope?: "selection" | "paragraph" | "document";
  enabled?: boolean;
  sortOrder?: number;
}

export interface EditorAIExecuteRequest {
  actionId?: string;
  prompt?: string;
  selection?: string;
  context?: string;
  instruction?: string;
  model?: string;
}

export interface EditorAIChatRequest {
  messages: Array<{ role: string; content: string }>;
  model: string;
  context?: {
    sectionContent?: string;
    pinnedSelections?: string[];
  };
}

export interface PinnedSelection {
  id: string;
  text: string;
  blockIds: string[];
  timestamp: number;
}
