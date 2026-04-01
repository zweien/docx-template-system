import { db } from "@/lib/db";
import type { Agent2MessageItem } from "@/types/agent2";
import type { Prisma } from "@/generated/prisma/client";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function saveMessages(
  conversationId: string,
  userMessage: { role: string; parts: unknown[]; attachments?: unknown },
  assistantMessage: { role: string; parts: unknown[] }
): Promise<ServiceResult<Agent2MessageItem[]>> {
  const [user, assistant] = await db.$transaction([
    db.agent2Message.create({
      data: {
        conversationId,
        role: userMessage.role,
        parts: userMessage.parts as Prisma.InputJsonValue,
        attachments: userMessage.attachments != null
          ? (userMessage.attachments as Prisma.InputJsonValue)
          : undefined,
      },
    }),
    db.agent2Message.create({
      data: {
        conversationId,
        role: assistantMessage.role,
        parts: assistantMessage.parts as Prisma.InputJsonValue,
      },
    }),
  ]);

  return {
    success: true,
    data: [user, assistant].map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      parts: m.parts as unknown[],
      attachments: m.attachments as Agent2MessageItem["attachments"],
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function getMessages(
  conversationId: string
): Promise<ServiceResult<Agent2MessageItem[]>> {
  const messages = await db.agent2Message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return {
    success: true,
    data: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      parts: m.parts as unknown[],
      attachments: m.attachments as Agent2MessageItem["attachments"],
      createdAt: m.createdAt.toISOString(),
    })),
  };
}
