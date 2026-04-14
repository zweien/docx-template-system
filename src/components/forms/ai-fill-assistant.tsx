"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Send, Loader2, Check, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FieldInfo {
  key: string;
  label: string;
  type: string;
  description?: string;
  options?: { value: string; label: string }[];
}

interface AiFillAssistantProps {
  templateId: string;
  templateName: string;
  fields: FieldInfo[];
  currentValues: Record<string, string>;
  onFill: (values: Record<string, string>) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Extract JSON block from AI response */
function extractFillValues(text: string): Record<string, string> | null {
  // Try to find ```json ... ``` block
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (typeof parsed === "object" && parsed !== null) {
      // Only keep string values
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" || typeof v === "number") {
          result[k] = String(v);
        }
      }
      return Object.keys(result).length > 0 ? result : null;
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

export function AiFillAssistant({
  templateId,
  templateName,
  fields,
  currentValues,
  onFill,
}: AiFillAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, string> | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Reset suggestions when new messages arrive
  useEffect(() => {
    setSuggestions(null);
    setSelectedKeys(new Set());
    setApplied(false);
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      abortRef.current = new AbortController();

      const res = await fetch("/api/ai/fill-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          templateId,
          context: {
            templateName,
            fields,
            currentValues,
          },
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "请求失败" }));
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `出错了: ${err.error || "请稍后重试"}` },
        ]);
        return;
      }

      // Read stream
      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let fullContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullContent };
          return updated;
        });
      }

      // Try to extract fill values from the response
      const values = extractFillValues(fullContent);
      if (values) {
        setSuggestions(values);
        setSelectedKeys(new Set(Object.keys(values)));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "网络错误，请稍后重试" },
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading, messages, templateName, fields, currentValues]);

  const handleApply = () => {
    if (!suggestions) return;
    const toApply: Record<string, string> = {};
    for (const key of selectedKeys) {
      if (suggestions[key] !== undefined) {
        toApply[key] = suggestions[key];
      }
    }
    if (Object.keys(toApply).length > 0) {
      onFill(toApply);
      setApplied(true);
    }
  };

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const labelForKey = (key: string) => {
    return fields.find((f) => f.key === key)?.label ?? key;
  };

  const hasExistingValue = (key: string) => {
    const val = currentValues[key];
    return val !== undefined && val !== "";
  };

  return (
    <>
      {/* Floating button */}
      <Button
        size="icon"
        className={cn(
          "fixed top-20 right-6 z-50 rounded-full size-12 shadow-lg transition-transform",
          open && "scale-0"
        )}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-5" />
      </Button>

      {/* Panel */}
      {open && (
        <div className="fixed top-20 right-6 z-50 w-[400px] max-h-[520px] flex flex-col rounded-lg border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-sm font-medium">AI 填充助手</span>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ maxHeight: 300 }}>
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-8">
                描述你想要的内容，AI 将为你生成表单填充建议
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "text-sm rounded-lg px-3 py-2 max-w-[90%] whitespace-pre-wrap break-words",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted"
                )}
              >
                {msg.content || (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> 思考中...
                  </span>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions && !applied && (
            <div className="border-t px-4 py-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                填充建议（点击选择要应用的字段）
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Object.entries(suggestions).map(([key, value]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleKey(key)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-xs flex items-start gap-2 transition-colors",
                      selectedKeys.has(key)
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-muted/50 border border-transparent"
                    )}
                  >
                    <Check
                      className={cn(
                        "size-3.5 mt-0.5 shrink-0",
                        selectedKeys.has(key) ? "text-primary" : "text-muted-foreground/30"
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{labelForKey(key)}</span>
                        {hasExistingValue(key) && (
                          <span className="text-amber-500 text-[10px]">覆盖</span>
                        )}
                      </div>
                      <div className="text-muted-foreground truncate">{value}</div>
                    </div>
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={handleApply}
                disabled={selectedKeys.size === 0}
              >
                <Undo2 className="size-3.5" />
                应用选中字段（{selectedKeys.size}）
              </Button>
            </div>
          )}

          {applied && (
            <div className="border-t px-4 py-2 text-xs text-green-600 text-center">
              已填充 {selectedKeys.size} 个字段
            </div>
          )}

          {/* Input */}
          <div className="border-t px-3 py-2">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="描述你想要的内容..."
                className="min-h-[36px] max-h-[80px] resize-none text-sm"
                rows={1}
                disabled={loading}
              />
              <Button
                size="icon"
                className="shrink-0 size-9"
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
