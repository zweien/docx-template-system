import { db } from "@/lib/db";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

interface CreateConversationInput {
  userId: string;
  initialTableId?: string;
  title?: string;
}

interface RenameConversationInput {
  conversationId: string;
  userId: string;
  title: string;
}

interface DeleteConversationInput {
  conversationId: string;
  userId: string;
}

export const DEFAULT_CONVERSATION_TITLE = "新对话";

function getAiConversationDelegate() {
  const delegate = (db as unknown as {
    aiConversation?: {
      create: (args: unknown) => Promise<unknown>;
      deleteMany: (args: unknown) => Promise<unknown>;
      findFirst: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<unknown[]>;
      update: (args: unknown) => Promise<unknown>;
    };
  }).aiConversation;

  if (!delegate) {
    throw new Error("Prisma aiConversation delegate 不可用");
  }

  return delegate;
}

function sanitizeGeneratedTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "")
    .trim()
    .slice(0, 24);
}

export function deriveConversationTitleFromMessage(message: string): string {
  const normalized = message
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  const sentenceEnd = normalized.match(/^(.+?[。！？!?；;，,])/);
  const candidate = sentenceEnd?.[1] ?? normalized;
  return sanitizeGeneratedTitle(candidate) || DEFAULT_CONVERSATION_TITLE;
}

export async function updateConversationTitleIfDefault(input: {
  conversationId: string;
  userId: string;
  title: string;
}): Promise<ServiceResult<{ title: string; updated: boolean }>> {
  const aiConversation = getAiConversationDelegate();
  const existing = await aiConversation.findFirst({
    where: {
      id: input.conversationId,
      userId: input.userId,
    },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "会话不存在" },
    };
  }

  const currentTitle = (existing as { title?: string }).title;
  if (currentTitle && currentTitle !== DEFAULT_CONVERSATION_TITLE) {
    return {
      success: true,
      data: {
        title: currentTitle,
        updated: false,
      },
    };
  }

  const title = sanitizeGeneratedTitle(input.title) || DEFAULT_CONVERSATION_TITLE;
  await aiConversation.update({
    where: { id: input.conversationId },
    data: { title },
  });

  return {
    success: true,
    data: {
      title,
      updated: true,
    },
  };
}

export async function createConversation(
  input: CreateConversationInput
): Promise<ServiceResult<unknown>> {
  const aiConversation = getAiConversationDelegate();
  const conversation = await aiConversation.create({
    data: {
      userId: input.userId,
      title: input.title ?? DEFAULT_CONVERSATION_TITLE,
      initialTableId: input.initialTableId ?? null,
      runtime: "AI_SDK",
      lastMessageAt: new Date(),
    },
  });

  return { success: true, data: conversation };
}

export async function listConversationsByUser(
  userId: string
): Promise<ServiceResult<unknown[]>> {
  const aiConversation = getAiConversationDelegate();
  const conversations = await aiConversation.findMany({
    where: { userId },
    orderBy: { lastMessageAt: "desc" },
  });

  return { success: true, data: conversations };
}

export async function renameConversation(
  input: RenameConversationInput
): Promise<ServiceResult<unknown>> {
  const aiConversation = getAiConversationDelegate();
  const existing = await aiConversation.findFirst({
    where: {
      id: input.conversationId,
      userId: input.userId,
    },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "会话不存在" },
    };
  }

  const conversation = await aiConversation.update({
    where: { id: input.conversationId },
    data: { title: input.title },
  });

  return { success: true, data: conversation };
}

export async function deleteConversation(
  input: DeleteConversationInput
): Promise<ServiceResult<{ count: number }>> {
  const aiConversation = getAiConversationDelegate();
  const existing = await aiConversation.findFirst({
    where: {
      id: input.conversationId,
      userId: input.userId,
    },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "会话不存在" },
    };
  }

  const result = (await aiConversation.deleteMany({
    where: {
      id: input.conversationId,
      userId: input.userId,
    },
  })) as { count: number };

  return { success: true, data: result };
}
