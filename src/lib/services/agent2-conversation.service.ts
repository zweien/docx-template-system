import { db } from "@/lib/db";
import type {
  Agent2ConversationItem,
  Agent2ConversationDetail,
} from "@/types/agent2";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

function mapConversationItem(row: {
  id: string;
  title: string;
  isFavorite: boolean;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}): Agent2ConversationItem {
  return {
    id: row.id,
    title: row.title,
    isFavorite: row.isFavorite,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listConversations(
  userId: string
): Promise<ServiceResult<Agent2ConversationItem[]>> {
  const conversations = await db.agent2Conversation.findMany({
    where: { userId },
    orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }],
  });

  return {
    success: true,
    data: conversations.map(mapConversationItem),
  };
}

export async function createConversation(
  userId: string,
  data?: { title?: string; model?: string }
): Promise<ServiceResult<Agent2ConversationItem>> {
  const conversation = await db.agent2Conversation.create({
    data: {
      userId,
      title: data?.title ?? "新对话",
      model: data?.model ?? "gpt-4o",
    },
  });

  return {
    success: true,
    data: mapConversationItem(conversation),
  };
}

export async function updateConversation(
  id: string,
  userId: string,
  data: { title?: string; isFavorite?: boolean }
): Promise<ServiceResult<Agent2ConversationItem>> {
  const existing = await db.agent2Conversation.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "会话不存在" },
    };
  }

  const updated = await db.agent2Conversation.update({
    where: { id },
    data,
  });

  return {
    success: true,
    data: mapConversationItem(updated),
  };
}

export async function deleteConversation(
  id: string,
  userId: string
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.agent2Conversation.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "会话不存在" },
    };
  }

  await db.agent2Conversation.delete({
    where: { id },
  });

  return {
    success: true,
    data: { id },
  };
}

export async function getConversation(
  id: string,
  userId: string
): Promise<ServiceResult<Agent2ConversationDetail>> {
  const conversation = await db.agent2Conversation.findFirst({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "会话不存在" },
    };
  }

  const { messages, ...rest } = conversation;

  return {
    success: true,
    data: {
      ...mapConversationItem(rest),
      userId: rest.userId,
      messages: messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        parts: m.parts as unknown[],
        attachments: m.attachments as Agent2ConversationDetail["messages"][number]["attachments"],
        createdAt: m.createdAt.toISOString(),
      })),
    },
  };
}
