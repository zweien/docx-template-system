"use client";

import { AIChatClient } from "./ai-chat-client";
import { ConversationSidebar } from "./conversation-sidebar";
import { useAIChatSession } from "./use-ai-chat-session";

interface AIChatShellProps {
  initialTableId?: string;
}

export function AIChatShell({ initialTableId }: AIChatShellProps) {
  const {
    conversations,
    currentConversationId,
    messages,
    isLoading,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    updateConversationTitle,
    setCurrentConversationId,
  } = useAIChatSession({ initialTableId });

  const currentConversation = conversations.find(
    (conversation) => conversation.id === currentConversationId
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-lg border bg-card">
      <div className="hidden h-full min-h-0 shrink-0 lg:block lg:w-[280px]">
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          isLoading={isLoading}
          onSelect={(conversationId) => {
            setCurrentConversationId(conversationId);
            void selectConversation(conversationId);
          }}
          onCreateConversation={async () => { await createConversation(); }}
          onRenameConversation={async (conversationId, title) => {
            await renameConversation(conversationId, title);
          }}
          onDeleteConversation={async (conversationId) => {
            await deleteConversation(conversationId);
          }}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="border-b px-4 py-3">
          <h1 className="text-lg font-semibold">
            {currentConversation?.title ?? "AI 助手"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {initialTableId
              ? `当前上下文表: ${initialTableId}`
              : "支持流式回复、Markdown 展示与后续会话管理扩展"}
          </p>
        </div>
        <AIChatClient
          initialTableId={initialTableId}
          conversationId={currentConversationId}
          initialMessages={messages as Parameters<typeof AIChatClient>[0]["initialMessages"]}
          onCreateConversation={async () => { await createConversation(); return null; }}
          onConversationTitleChange={updateConversationTitle}
        />
      </div>
    </div>
  );
}
