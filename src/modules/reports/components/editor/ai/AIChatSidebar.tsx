"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from "react";
import {
  X,
  Send,
  Copy,
  ArrowDownToLine,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorAIStore } from "./useEditorAIStore";
import { useAIActions } from "./useAIActions";
import { SelectionAttachment } from "./SelectionAttachment";
import type { PinnedSelection } from "@/types/editor-ai";

// ---------- Model list ----------
const MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "deepseek-chat", label: "DeepSeek Chat" },
  { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  { value: "kimi-k2", label: "Kimi K2" },
];

// ---------- Props ----------
interface AIChatSidebarProps {
  editorRef: React.RefObject<any>;
}

// ---------- Component ----------
export function AIChatSidebar({ editorRef }: AIChatSidebarProps) {
  const {
    sidebarOpen,
    setSidebarOpen,
    messages,
    addMessage,
    clearMessages,
    pinnedSelections,
    removePinnedSelection,
    selectedModel,
    setSelectedModel,
    sectionContent,
  } = useEditorAIStore();

  const { globalActions } = useAIActions();

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, [input]);

  // ---------- Send message ----------
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    // Add user message to store
    const userPinnedSelections = pinnedSelections.length > 0 ? [...pinnedSelections] : undefined;
    addMessage({ role: "user", content: trimmed, pinnedSelections: userPinnedSelections });
    setInput("");
    setStreaming(true);

    // Build API messages (exclude system messages, add user pinned refs)
    const apiMessages = [
      ...messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role,
          content: m.content,
        })),
      { role: "user" as const, content: trimmed },
    ];

    const context: { sectionContent?: string; pinnedSelections?: string[] } = {};
    if (sectionContent) {
      context.sectionContent = sectionContent;
    }
    if (pinnedSelections.length > 0) {
      context.pinnedSelections = pinnedSelections.map((s) => s.text);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Add placeholder assistant message
    addMessage({ role: "assistant", content: "" });

    try {
      const res = await fetch("/api/editor-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          model: selectedModel,
          context: Object.keys(context).length > 0 ? context : undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // Update last assistant message with error
        updateLastAssistantMessage(`错误: ${body || `请求失败 (${res.status})`}`);
        setStreaming(false);
        abortRef.current = null;
        return;
      }

      // Stream reading
      const reader = res.body?.getReader();
      if (!reader) {
        updateLastAssistantMessage("错误: 无法读取响应流");
        setStreaming(false);
        abortRef.current = null;
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        updateLastAssistantMessage(accumulated);
      }

      setStreaming(false);
      abortRef.current = null;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        updateLastAssistantMessage((prev) => {
          const current = getCurrentAssistantContent();
          return current + "\n\n*已停止生成*";
        });
        setStreaming(false);
        abortRef.current = null;
        return;
      }
      updateLastAssistantMessage(
        `错误: ${err instanceof Error ? err.message : "未知错误"}`,
      );
      setStreaming(false);
      abortRef.current = null;
    }
  }, [
    input,
    streaming,
    pinnedSelections,
    messages,
    selectedModel,
    sectionContent,
    addMessage,
  ]);

  // ---------- Helpers to update last assistant message ----------
  const updateLastAssistantMessage = useCallback(
    (updater: string | ((prev: string) => string)) => {
      const currentMessages = useEditorAIStore.getState().messages;
      const lastIdx = currentMessages.length - 1;
      if (lastIdx < 0 || currentMessages[lastIdx].role !== "assistant") return;

      const lastMsg = currentMessages[lastIdx];
      const newContent =
        typeof updater === "function"
          ? (updater as (prev: string) => string)(lastMsg.content)
          : updater;

      useEditorAIStore.setState({
        messages: currentMessages.map((m, i) =>
          i === lastIdx ? { ...m, content: newContent } : m,
        ),
      });
    },
    [],
  );

  const getCurrentAssistantContent = useCallback(() => {
    const currentMessages = useEditorAIStore.getState().messages;
    const lastIdx = currentMessages.length - 1;
    if (lastIdx < 0 || currentMessages[lastIdx].role !== "assistant") return "";
    return currentMessages[lastIdx].content;
  }, []);

  // ---------- Stop streaming ----------
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  // ---------- Insert to editor ----------
  const handleInsertToEditor = useCallback(
    (content: string) => {
      try {
        const editor = editorRef.current;
        if (!editor?.tryParseMarkdownToBlocks || !editor?.insertBlocks) {
          return;
        }
        const blocks = editor.tryParseMarkdownToBlocks(content);
        if (blocks && blocks.length > 0) {
          editor.insertBlocks(blocks);
        }
      } catch {
        // Silently fail — the editor API might not be available
      }
    },
    [editorRef],
  );

  // ---------- Copy ----------
  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Fallback: no-op
    }
  }, []);

  // ---------- Quick action ----------
  // Replace template variables in prompt: {{selection}}, {{context}}, {{instruction}}
  const resolvePromptTemplate = useCallback(
    (template: string) => {
      let resolved = template;
      const selectionText = pinnedSelections.map((s) => s.text).join("\n---\n");
      resolved = resolved.replace(/\{\{selection\}\}/g, selectionText || "(未选中文本)");
      resolved = resolved.replace(/\{\{context\}\}/g, sectionContent || "(无章节内容)");
      // {{instruction}} is left as-is for user to fill in
      return resolved;
    },
    [pinnedSelections, sectionContent],
  );

  const handleQuickAction = useCallback(
    (prompt: string) => {
      const resolved = resolvePromptTemplate(prompt);
      setInput(resolved);
      textareaRef.current?.focus();
    },
    [resolvePromptTemplate],
  );

  // ---------- Keyboard ----------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (streaming) {
          handleStop();
        } else {
          handleSend();
        }
      }
    },
    [streaming, handleSend, handleStop],
  );

  // ---------- Render ----------
  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-medium">AI 助手</span>
        <div className="flex-1" />
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="h-6 rounded border bg-transparent px-1.5 text-xs outline-none focus:border-ring"
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setSidebarOpen(false)}
          title="关闭"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Context indicator */}
      {sectionContent && (
        <div className="border-b px-3 py-1.5 text-xs text-muted-foreground">
          📄 已关联当前章节
        </div>
      )}

      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="flex flex-col gap-3 p-3">
          {messages.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Sparkles className="mx-auto mb-2 size-8 text-muted-foreground/50" />
              <p>你好！我是 AI 助手</p>
              <p className="mt-1">可以帮你润色、改写、扩展文本</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const isLast =
              idx === messages.length - 1 && msg.role === "assistant";
            const isStreamingThis = isLast && streaming;

            // System message
            if (msg.role === "system") {
              return (
                <div
                  key={msg.id}
                  className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground"
                >
                  {msg.content}
                </div>
              );
            }

            // User message
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex flex-col items-end gap-1">
                  {msg.pinnedSelections && msg.pinnedSelections.length > 0 && (
                    <div className="flex flex-col gap-1 text-right">
                      {msg.pinnedSelections.map((sel) => (
                        <div
                          key={sel.id}
                          className="inline-flex items-center gap-1 text-xs text-blue-500"
                        >
                          <span>📎 引用了 ({sel.text.length} 字)</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // Assistant message
            return (
              <div
                key={msg.id}
                className="flex flex-col gap-1.5 rounded-lg border px-3 py-2"
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content || (isStreamingThis ? "" : "...")}
                  {isStreamingThis && (
                    <span className="ml-0.5 inline-block animate-pulse">▌</span>
                  )}
                </div>

                {/* Action buttons (only for completed messages with content) */}
                {msg.content && !isStreamingThis && (
                  <div className="flex items-center gap-1 border-t pt-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-5 gap-1 text-xs"
                      onClick={() => handleInsertToEditor(msg.content)}
                      title="插入到编辑器"
                    >
                      <ArrowDownToLine className="size-3" />
                      插入到编辑器
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-5 gap-1 text-xs"
                      onClick={() => handleCopy(msg.content)}
                      title="复制"
                    >
                      <Copy className="size-3" />
                      复制
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Quick action bar */}
      {globalActions.length > 0 && (
        <div className="border-t px-3 py-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {globalActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleQuickAction(action.prompt)}
                className="shrink-0 rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {action.icon || "🤖"} {action.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pinned selections */}
      {pinnedSelections.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t px-3 py-2">
          {pinnedSelections.map((sel) => (
            <SelectionAttachment
              key={sel.id}
              selection={sel}
              onRemove={removePinnedSelection}
            />
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Shift+Enter 换行)"
            rows={1}
            className="flex max-h-40 min-h-[2rem] flex-1 resize-none rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-ring"
            disabled={streaming}
          />
          <Button
            variant={streaming ? "destructive" : "default"}
            size="icon-xs"
            onClick={streaming ? handleStop : handleSend}
            disabled={!streaming && !input.trim()}
            title={streaming ? "停止" : "发送"}
          >
            {streaming ? (
              <ChevronDown className="size-3" />
            ) : (
              <Send className="size-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
