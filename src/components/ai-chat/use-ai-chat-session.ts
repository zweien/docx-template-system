"use client";

import { useEffect, useState } from "react";

interface ConversationSummary {
  id: string;
  title: string;
  initialTableId?: string | null;
}

interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Array<{
    id: string;
    fileName: string;
    extractStatus?: "pending" | "processing" | "completed" | "failed";
    extractSummary?: string | null;
    extractError?: string | null;
  }>;
}

interface UseAIChatSessionOptions {
  initialTableId?: string;
}

type ConversationTitleUpdated = {
  conversationId: string;
  title: string;
};

async function parseResponseJson<T>(response: Response): Promise<T | null> {
  if ("text" in response && typeof response.text === "function") {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  if ("json" in response && typeof response.json === "function") {
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeMessage(message: {
  id: string;
  role: string;
  content: string;
  attachments?: Array<{
    id?: string;
    fileName?: string;
    extractStatus?: "pending" | "processing" | "completed" | "failed";
    extractSummary?: string | null;
    extractError?: string | null;
    attachment?: {
      id: string;
      fileName: string;
      extractStatus?: "pending" | "processing" | "completed" | "failed";
      extractSummary?: string | null;
      extractError?: string | null;
    };
  }>;
}): SessionMessage {
  const normalizedRole = message.role.toLowerCase() as
    | "user"
    | "assistant"
    | "system";

  return {
    id: message.id,
    role: normalizedRole,
    content: message.content,
    attachments: message.attachments?.map((item) => {
      const attachment = item.attachment ?? item;
      const normalized = {
        id: attachment.id!,
        fileName: attachment.fileName!,
        extractStatus: attachment.extractStatus?.toLowerCase() as
          | "pending"
          | "processing"
          | "completed"
          | "failed"
          | undefined,
        extractSummary: attachment.extractSummary ?? null,
      };
      return attachment.extractError
        ? { ...normalized, extractError: attachment.extractError }
        : normalized;
    }),
  };
}

export function useAIChatSession(options: UseAIChatSessionOptions) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchConversationMessages(conversationId: string) {
    const response = await fetch(`/api/ai/conversations/${conversationId}/messages`);
    const result = await parseResponseJson<{
      success?: boolean;
      data?: Array<Parameters<typeof normalizeMessage>[0]>;
    }>(response);
    if (!response.ok || !result?.success || !result.data) {
      return false;
    }

    setMessages(result.data.map(normalizeMessage));
    return true;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/ai/conversations");
        const result = await parseResponseJson<{
          success?: boolean;
          data?: ConversationSummary[];
        }>(response);
        if (cancelled || !response.ok || !result?.success) {
          return;
        }

        const nextConversations = result.data ?? [];
        const initialConversationId = nextConversations[0]?.id ?? null;

        setConversations(nextConversations);
        setCurrentConversationId((currentId) => currentId ?? initialConversationId);

        if (!cancelled && initialConversationId) {
          await fetchConversationMessages(initialConversationId);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createConversation() {
    const response = await fetch("/api/ai/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        initialTableId: options.initialTableId,
      }),
    });
    const result = await parseResponseJson<{
      success?: boolean;
      data?: ConversationSummary;
    }>(response);
    if (!response.ok || !result?.success || !result.data) {
      return null;
    }

    setConversations((current) => [result.data, ...current]);
    setCurrentConversationId(result.data.id);
    setMessages([]);
    return result.data as ConversationSummary;
  }

  async function selectConversation(conversationId: string) {
    setCurrentConversationId(conversationId);
    await fetchConversationMessages(conversationId);
  }

  async function renameConversation(conversationId: string, title: string) {
    const response = await fetch(`/api/ai/conversations/${conversationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });
    const result = await parseResponseJson<{
      success?: boolean;
      data?: ConversationSummary;
    }>(response);
    if (!response.ok || !result?.success || !result.data) {
      return null;
    }

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title: result.data.title }
          : conversation
      )
    );

    return result.data as ConversationSummary;
  }

  function updateConversationTitle({
    conversationId,
    title,
  }: ConversationTitleUpdated) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, title }
          : conversation
      )
    );
  }

  async function deleteConversation(conversationId: string) {
    const response = await fetch(`/api/ai/conversations/${conversationId}`, {
      method: "DELETE",
    });
    const result = await parseResponseJson<{
      success?: boolean;
      data?: { count: number };
    }>(response);
    if (!response.ok || !result?.success) {
      return false;
    }

    setConversations((current) =>
      current.filter((conversation) => conversation.id !== conversationId)
    );
    setMessages((current) =>
      currentConversationId === conversationId ? [] : current
    );
    setCurrentConversationId((current) =>
      current === conversationId ? null : current
    );
    return true;
  }

  return {
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
  };
}
