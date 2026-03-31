import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { chat } from "@/lib/ai-agent/service";
import { encodeStreamEvent } from "@/lib/ai-agent/stream-events";
import { summarizeAttachmentContext } from "@/lib/ai-agent/context-window";
import {
  completeAssistantMessage,
  createAssistantPlaceholder,
  createUserMessage,
  failAssistantMessage,
  listMessagesByConversation,
} from "@/lib/services/ai-message.service";
import {
  deriveConversationTitleFromMessage,
  updateConversationTitleIfDefault,
} from "@/lib/services/ai-conversation.service";
import { listAttachmentsByIds } from "@/lib/services/ai-attachment.service";
import { conversationMessageSchema } from "@/validators/ai-agent";
import { ZodError } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function buildMessageInput(
  message: string,
  attachments: Array<{
    id: string;
    fileName: string;
    extractStatus?: string;
    extractSummary?: string | null;
  }>
) {
  if (attachments.length === 0) {
    return message;
  }

  const completedSummary = summarizeAttachmentContext(
    attachments.filter((attachment) => attachment.extractSummary)
  );
  const pendingAttachments = attachments
    .filter((attachment) => attachment.extractStatus === "pending")
    .map((attachment) => attachment.fileName);
  const processingAttachments = attachments
    .filter((attachment) => attachment.extractStatus === "processing")
    .map((attachment) => attachment.fileName);
  const failedAttachments = attachments
    .filter((attachment) => attachment.extractStatus === "failed")
    .map((attachment) => attachment.fileName);

  const sections = [
    completedSummary
      ? `## 当前消息附件摘要\n${completedSummary}`
      : "",
    pendingAttachments.length > 0
      ? `## 待解析附件\n${pendingAttachments.join("、")}`
      : "",
    processingAttachments.length > 0
      ? `## 解析中附件\n${processingAttachments.join("、")}`
      : "",
    failedAttachments.length > 0
      ? `## 解析失败附件\n${failedAttachments.join("、")}`
      : "",
  ].filter(Boolean);

  if (sections.length === 0) {
    return message;
  }

  return `${message}\n\n${sections.join("\n\n")}`;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const result = await listMessagesByConversation(id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = conversationMessageSchema.parse(body);

    const userMessageResult = await createUserMessage({
      conversationId: id,
      content: parsed.message,
      attachmentIds: parsed.attachmentIds,
    });
    if (!userMessageResult.success) {
      return NextResponse.json({ error: userMessageResult.error }, { status: 400 });
    }

    const assistantResult = await createAssistantPlaceholder(id);
    if (!assistantResult.success) {
      return NextResponse.json({ error: assistantResult.error }, { status: 400 });
    }

    const assistantMessage = assistantResult.data as { id: string };
    const generatedTitle = deriveConversationTitleFromMessage(parsed.message);
    const titleResult = await updateConversationTitleIfDefault({
      conversationId: id,
      userId: session.user.id,
      title: generatedTitle,
    });
    const conversationTitle =
      titleResult.success && titleResult.data.updated ? titleResult.data.title : undefined;
    const attachmentsResult = await listAttachmentsByIds(parsed.attachmentIds ?? []);

    // 获取历史消息并转换为 ChatMessage 格式
    // 注意：数据库中 role 是枚举 USER/ASSISTANT，需要转换为小写
    const historyResult = await listMessagesByConversation(id);
    const history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> =
      historyResult.success && historyResult.data
        ? (historyResult.data as Array<{ role: string; content: string }>)
            .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
            .map((m) => ({
              role: m.role === 'USER' ? 'user' : m.role === 'ASSISTANT' ? 'assistant' : 'system',
              content: m.content as string,
            }))
        : [];

    const messageInput =
      attachmentsResult.success
        ? buildMessageInput(
            parsed.message,
            attachmentsResult.data as Array<{
              id: string;
              fileName: string;
              extractStatus?: string;
              extractSummary?: string | null;
            }>
          )
        : parsed.message;
    const apiKey = process.env.AI_API_KEY;
    const baseURL = process.env.AI_BASE_URL;
    const model = process.env.AI_MODEL;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let assistantContent = "";

        controller.enqueue(
          encoder.encode(
            encodeStreamEvent({
              type: "message-created",
              messageId: assistantMessage.id,
              role: "assistant",
            })
          )
        );

        if (conversationTitle) {
          controller.enqueue(
            encoder.encode(
              encodeStreamEvent({
                type: "conversation-title",
                conversationId: id,
                title: conversationTitle,
              })
            )
          );
        }

        try {
          for await (const chunk of chat({
            message: messageInput,
            tableId: parsed.tableId,
            history,
            apiKey,
            baseURL,
            model,
          })) {
            if (chunk.type === "text") {
              assistantContent += chunk.content;
              controller.enqueue(
                encoder.encode(
                  encodeStreamEvent({
                    type: "text-delta",
                    messageId: assistantMessage.id,
                    content: chunk.content,
                  })
                )
              );
              continue;
            }

            if (chunk.type === "confirm") {
              controller.enqueue(
                encoder.encode(
                  encodeStreamEvent({
                    type: "confirm-required",
                    messageId: assistantMessage.id,
                    confirmToken: chunk.confirmToken ?? "",
                    content: chunk.content,
                  })
                )
              );
              continue;
            }

            if (chunk.type === "tool_call") {
              controller.enqueue(
                encoder.encode(
                  encodeStreamEvent({
                    type: "tool-call",
                    messageId: assistantMessage.id,
                    toolName: chunk.toolName ?? "unknown",
                    toolArgs: chunk.toolArgs,
                  })
                )
              );
              continue;
            }

            if (chunk.type === "result") {
              controller.enqueue(
                encoder.encode(
                  encodeStreamEvent({
                    type: "tool-result",
                    messageId: assistantMessage.id,
                    result: chunk.result,
                  })
                )
              );
              continue;
            }
          }

          await completeAssistantMessage({
            messageId: assistantMessage.id,
            content: assistantContent,
          });
          controller.enqueue(
            encoder.encode(
              encodeStreamEvent({
                type: "message-completed",
                messageId: assistantMessage.id,
              })
            )
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "未知错误";
          await failAssistantMessage({
            messageId: assistantMessage.id,
            errorMessage,
          });
          controller.enqueue(
            encoder.encode(
              encodeStreamEvent({
                type: "error",
                messageId: assistantMessage.id,
                content: errorMessage,
              })
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "发送消息失败",
        },
      },
      { status: 500 }
    );
  }
}
