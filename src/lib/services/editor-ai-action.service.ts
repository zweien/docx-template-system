import { db } from "@/lib/db";
import type { EditorAIActionItem, EditorAIActionCreateInput, EditorAIActionUpdateInput } from "@/types/editor-ai";
import type { ServiceResult } from "@/types/data-table";

// ── Helpers ──

function mapActionItem(row: {
  id: string;
  name: string;
  icon: string | null;
  prompt: string;
  category: string;
  scope: string;
  sortOrder: number;
  isBuiltIn: boolean;
  enabled: boolean;
  userId: string | null;
  createdAt: Date;
}): EditorAIActionItem {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    prompt: row.prompt,
    category: row.category,
    scope: row.scope as EditorAIActionItem["scope"],
    sortOrder: row.sortOrder,
    isBuiltIn: row.isBuiltIn,
    enabled: row.enabled,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Query functions ──

export async function listAvailableActions(
  userId: string
): Promise<ServiceResult<EditorAIActionItem[]>> {
  const actions = await db.editorAIAction.findMany({
    where: {
      OR: [
        { userId: null, enabled: true },
        { userId },
      ],
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return {
    success: true,
    data: actions.map(mapActionItem),
  };
}

export async function listAllActions(): Promise<
  ServiceResult<EditorAIActionItem[]>
> {
  const actions = await db.editorAIAction.findMany({
    where: { userId: null },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return {
    success: true,
    data: actions.map(mapActionItem),
  };
}

export async function getActionForUser(
  id: string,
  userId: string
): Promise<ServiceResult<EditorAIActionItem>> {
  const action = await db.editorAIAction.findFirst({
    where: {
      id,
      OR: [
        { userId: null, enabled: true },
        { userId },
      ],
    },
  });

  if (!action) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "AI 动作不存在" },
    };
  }

  return {
    success: true,
    data: mapActionItem(action),
  };
}

// ── Create functions ──

export async function createUserAction(
  userId: string,
  data: EditorAIActionCreateInput
): Promise<ServiceResult<EditorAIActionItem>> {
  const action = await db.editorAIAction.create({
    data: {
      name: data.name,
      icon: data.icon ?? null,
      prompt: data.prompt,
      category: data.category ?? "general",
      scope: data.scope ?? "selection",
      isBuiltIn: false,
      enabled: true,
      userId,
    },
  });

  return {
    success: true,
    data: mapActionItem(action),
  };
}

export async function createGlobalAction(
  data: EditorAIActionCreateInput
): Promise<ServiceResult<EditorAIActionItem>> {
  const action = await db.editorAIAction.create({
    data: {
      name: data.name,
      icon: data.icon ?? null,
      prompt: data.prompt,
      category: data.category ?? "general",
      scope: data.scope ?? "selection",
      isBuiltIn: false,
      enabled: true,
      userId: null,
    },
  });

  return {
    success: true,
    data: mapActionItem(action),
  };
}

// ── Update function ──

export async function updateAction(
  id: string,
  data: EditorAIActionUpdateInput,
  userId: string,
  isAdmin: boolean
): Promise<ServiceResult<EditorAIActionItem>> {
  const existing = await db.editorAIAction.findFirst({
    where: { id },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "AI 动作不存在" },
    };
  }

  // Ownership check: non-admin can only edit their own actions
  if (!isAdmin && existing.userId !== userId) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "无权修改此动作" },
    };
  }

  // Built-in protection: cannot modify built-in actions
  if (existing.isBuiltIn) {
    return {
      success: false,
      error: { code: "BUILT_IN_PROTECTED", message: "内置动作不可修改" },
    };
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.icon !== undefined) updateData.icon = data.icon ?? null;
  if (data.prompt !== undefined) updateData.prompt = data.prompt;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.scope !== undefined) updateData.scope = data.scope;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const updated = await db.editorAIAction.update({
    where: { id },
    data: updateData,
  });

  return {
    success: true,
    data: mapActionItem(updated),
  };
}

// ── Delete function ──

export async function deleteAction(
  id: string,
  userId: string,
  isAdmin: boolean
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.editorAIAction.findFirst({
    where: { id },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "AI 动作不存在" },
    };
  }

  // Ownership check: non-admin can only delete their own actions
  if (!isAdmin && existing.userId !== userId) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "无权删除此动作" },
    };
  }

  // Built-in protection: cannot delete built-in actions
  if (existing.isBuiltIn) {
    return {
      success: false,
      error: { code: "BUILT_IN_PROTECTED", message: "内置动作不可删除" },
    };
  }

  await db.editorAIAction.delete({
    where: { id },
  });

  return {
    success: true,
    data: { id },
  };
}

// ── Prompt rendering ──

export function renderPrompt(
  template: string,
  vars: { selection?: string; context?: string; instruction?: string }
): string {
  let result = template;
  if (vars.selection !== undefined) {
    result = result.replace(/\{\{selection\}\}/g, vars.selection);
  }
  if (vars.context !== undefined) {
    result = result.replace(/\{\{context\}\}/g, vars.context);
  }
  if (vars.instruction !== undefined) {
    result = result.replace(/\{\{instruction\}\}/g, vars.instruction);
  }
  return result;
}
