"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConversationSummary {
  id: string;
  title: string;
}

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  currentConversationId: string | null;
  isLoading?: boolean;
  onSelect: (conversationId: string) => void;
  onCreateConversation: () => void | Promise<void>;
  onRenameConversation?: (conversationId: string, title: string) => void | Promise<void>;
  onDeleteConversation?: (conversationId: string) => void | Promise<void>;
}

export function ConversationSidebar({
  conversations,
  currentConversationId,
  isLoading = false,
  onSelect,
  onCreateConversation,
  onRenameConversation,
  onDeleteConversation,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <aside className="flex h-full w-full max-w-72 flex-col border-r bg-white">
      <div className="border-b p-4">
        <Button className="w-full" onClick={() => void onCreateConversation()}>
          新建对话
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">加载会话中...</p>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无会话，先新建一个。</p>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 transition ${
                  conversation.id === currentConversationId
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                }`}
              >
                {deletingId === conversation.id ? (
                  <>
                    <p className="flex-1 text-sm">
                      确认删除“{conversation.title}”？
                    </p>
                    <button
                      aria-label={`确认删除${conversation.title}`}
                      className="rounded px-2 py-1 text-xs hover:bg-black/10"
                      onClick={() => {
                        void onDeleteConversation?.(conversation.id);
                        setDeletingId(null);
                      }}
                      type="button"
                    >
                      确认
                    </button>
                    <button
                      aria-label={`取消删除${conversation.title}`}
                      className="rounded px-2 py-1 text-xs hover:bg-black/10"
                      onClick={() => setDeletingId(null)}
                      type="button"
                    >
                      取消
                    </button>
                  </>
                ) : editingId === conversation.id ? (
                  <>
                    <Input
                      className="h-8 flex-1 bg-white text-zinc-900"
                      onChange={(event) => setDraftTitle(event.target.value)}
                      value={draftTitle}
                    />
                    <button
                      aria-label={`保存${conversation.title}`}
                      className="rounded p-1 hover:bg-black/10"
                      onClick={() => {
                        if (!draftTitle.trim()) {
                          return;
                        }

                        void onRenameConversation?.(
                          conversation.id,
                          draftTitle.trim()
                        );
                        setEditingId(null);
                        setDraftTitle("");
                      }}
                      type="button"
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="min-w-0 flex-1 truncate text-left text-sm"
                      onClick={() => onSelect(conversation.id)}
                      type="button"
                    >
                      {conversation.title}
                    </button>
                    <button
                      aria-label={`重命名${conversation.title}`}
                      className="rounded p-1 hover:bg-black/10"
                      onClick={() => {
                        setDeletingId(null);
                        setEditingId(conversation.id);
                        setDraftTitle(conversation.title);
                      }}
                      type="button"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button
                  aria-label={`删除${conversation.title}`}
                  className="rounded p-1 hover:bg-black/10"
                  onClick={() => {
                    setEditingId(null);
                    setDraftTitle("");
                    setDeletingId(conversation.id);
                  }}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
