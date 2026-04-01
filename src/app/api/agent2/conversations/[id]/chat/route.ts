import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { chatRequestSchema } from "@/validators/agent2";
import { getConversation } from "@/lib/services/agent2-conversation.service";
import { getSettings } from "@/lib/services/agent2-settings.service";
import { saveMessages, getMessages } from "@/lib/services/agent2-message.service";
import { resolveModel } from "@/lib/agent2/model-resolver";
import { buildSystemPrompt, truncateMessages } from "@/lib/agent2/context-builder";
import { createTools } from "@/lib/agent2/tools";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const { id: conversationId } = await params;
    const body = await request.json();
    const validated = chatRequestSchema.parse(body);

    // Verify conversation ownership
    const convResult = await getConversation(conversationId, session.user.id);
    if (!convResult.success) {
      return NextResponse.json(
        { error: convResult.error },
        { status: convResult.error.code === "NOT_FOUND" ? 404 : 400 }
      );
    }

    // Get user settings for auto-confirm
    const settingsResult = await getSettings(session.user.id);
    const autoConfirm = settingsResult.success
      ? (settingsResult.data.autoConfirmTools as Record<string, boolean>)
      : {};

    // Resolve model
    const model = await resolveModel(validated.model, session.user.id);

    // Build system prompt
    const systemPrompt = buildSystemPrompt();

    // Load conversation history from DB
    const historyResult = await getMessages(conversationId);
    const historyMessages: UIMessage[] = historyResult.success
      ? historyResult.data.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: m.parts as UIMessage["parts"],
          createdAt: new Date(m.createdAt),
        }))
      : [];

    // Extract the latest user message from the frontend payload
    const uiMessages = validated.messages as unknown as UIMessage[];
    const lastUserMessage = uiMessages[uiMessages.length - 1];
    const allMessages = [...historyMessages, lastUserMessage as unknown as UIMessage];

    // Convert UIMessages to ModelMessages and truncate to prevent context overflow
    const convertedMessages = await convertToModelMessages(allMessages);
    const messages = truncateMessages(convertedMessages as { role: string; content: string }[]) as typeof convertedMessages;

    // Create tools with auto-confirm settings
    const messageId = randomUUID();
    const tools = createTools(conversationId, messageId, autoConfirm);

    // Stream with AI SDK
    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      onFinish: async ({ response }) => {
        try {
          // Extract user text from parts
          const lastMsg = lastUserMessage;
          const userText = lastMsg?.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") || "";
          const userParts = [{ type: "text" as const, text: userText }];

          // ResponseMessage has `content` (string | ContentPart[]) not `parts`
          const assistantParts = response.messages.flatMap((m) => {
            if (typeof m.content === "string") {
              return [{ type: "text" as const, text: m.content }];
            }
            // content is an array of parts
            return (m.content as Array<{ type: string; text?: string; [key: string]: unknown }>).map(
              (part) => ({
                type: part.type,
                ...("text" in part ? { text: part.text } : {}),
              })
            );
          });

          await saveMessages(
            conversationId,
            { role: "user", parts: userParts },
            { role: "assistant", parts: assistantParts }
          );
        } catch (e) {
          console.error("Failed to save messages:", e);
        }
      },
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      sendSources: true,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }

    console.error("Chat error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "聊天请求失败",
        },
      },
      { status: 500 }
    );
  }
}
