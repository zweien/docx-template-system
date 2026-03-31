import { db } from "@/lib/db";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

interface CreateUserMessageInput {
  conversationId: string;
  content: string;
  attachmentIds?: string[];
}

interface CompleteAssistantMessageInput {
  messageId: string;
  content: string;
}

interface FailAssistantMessageInput {
  messageId: string;
  errorMessage: string;
}

function getMessageDelegates() {
  const delegates = db as unknown as {
    aiMessage?: {
      create: (args: unknown) => Promise<unknown>;
      findMany: (args: unknown) => Promise<unknown[]>;
      update: (args: unknown) => Promise<unknown>;
    };
    aiConversation?: {
      update: (args: unknown) => Promise<unknown>;
    };
  };

  if (!delegates.aiMessage || !delegates.aiConversation) {
    throw new Error("Prisma AI message delegates 不可用");
  }

  return {
    aiMessage: delegates.aiMessage,
    aiConversation: delegates.aiConversation,
  };
}

async function touchConversation(conversationId: string) {
  const { aiConversation } = getMessageDelegates();
  await aiConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });
}

export async function createUserMessage(
  input: CreateUserMessageInput
): Promise<ServiceResult<unknown>> {
  const { aiMessage } = getMessageDelegates();
  const message = await aiMessage.create({
    data: {
      conversationId: input.conversationId,
      role: "USER",
      status: "COMPLETED",
      content: input.content,
      attachments: input.attachmentIds?.length
        ? {
            create: input.attachmentIds.map((attachmentId) => ({
              attachment: {
                connect: { id: attachmentId },
              },
            })),
          }
        : undefined,
    },
    include: {
      attachments: true,
    },
  });

  await touchConversation(input.conversationId);

  return { success: true, data: message };
}

export async function createAssistantPlaceholder(
  conversationId: string
): Promise<ServiceResult<unknown>> {
  const { aiMessage } = getMessageDelegates();
  const message = await aiMessage.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      status: "STREAMING",
      content: "",
    },
    include: {
      attachments: true,
    },
  });

  await touchConversation(conversationId);

  return { success: true, data: message };
}

export async function completeAssistantMessage(
  input: CompleteAssistantMessageInput
): Promise<ServiceResult<unknown>> {
  const { aiMessage } = getMessageDelegates();
  const message = await aiMessage.update({
    where: { id: input.messageId },
    data: {
      status: "COMPLETED",
      content: input.content,
      errorMessage: null,
    },
    include: {
      attachments: true,
    },
  });

  return { success: true, data: message };
}

export async function failAssistantMessage(
  input: FailAssistantMessageInput
): Promise<ServiceResult<unknown>> {
  const { aiMessage } = getMessageDelegates();
  const message = await aiMessage.update({
    where: { id: input.messageId },
    data: {
      status: "FAILED",
      errorMessage: input.errorMessage,
    },
    include: {
      attachments: true,
    },
  });

  return { success: true, data: message };
}

export async function listMessagesByConversation(
  conversationId: string
): Promise<ServiceResult<unknown[]>> {
  const { aiMessage } = getMessageDelegates();
  const messages = await aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: {
      attachments: {
        include: {
          attachment: true,
        },
      },
    },
  });

  return { success: true, data: messages };
}
