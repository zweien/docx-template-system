"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Sparkles, X, Send, Loader2, Check, Undo2, ChevronDown, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ModelItem {
  id: string;
  name: string;
  providerId: string;
  modelId: string;
}

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
  onFill: (values: Record<string, string | string[]>) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type FillValue = string | string[];

function toComparableValue(value: FillValue): string {
  return Array.isArray(value) ? JSON.stringify(value) : value;
}

/** Extract JSON block from AI response */
function extractFillValues(text: string): Record<string, FillValue> | null {
  // Try to find ```json ... ``` block
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (typeof parsed === "object" && parsed !== null) {
      const result: Record<string, FillValue> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" || typeof v === "number") {
          result[k] = String(v);
        } else if (Array.isArray(v) && v.every((item) => typeof item === "string")) {
          result[k] = v as string[];
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
  const [suggestions, setSuggestions] = useState<Record<string, FillValue> | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [lastAppliedCount, setLastAppliedCount] = useState(0);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modelName, setModelName] = useState("默认模型");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  // Fetch available models on mount
  useEffect(() => {
    let active = true;
    fetch("/api/agent2/models")
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data?.success) return;
        setModels(data.data);
        // Try to load saved default model from settings
        fetch("/api/agent2/settings")
          .then((r) => r.json())
          .then((settings) => {
            if (!active) return;
            const saved = settings.success ? settings.data.defaultModel : null;
            if (saved) {
              setSelectedModel(saved);
              const found = data.data.find((m: ModelItem) => m.id === saved);
              setModelName(found ? found.name : saved);
            } else if (data.data.length > 0) {
              // Default to first model (usually env-configured default)
              setSelectedModel(data.data[0].id);
              setModelName(data.data[0].name);
            }
          })
          .catch(() => {
            if (!active || data.data.length === 0) return;
            setSelectedModel(data.data[0].id);
            setModelName(data.data[0].name);
          });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Close model menu on outside click
  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
          ...(selectedModel ? { model: selectedModel } : {}),
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
        setSuggestions((prev) => ({
          ...(prev ?? {}),
          ...values,
        }));
        setSelectedKeys((prev) => {
          const next = new Set(prev);
          for (const key of Object.keys(values)) {
            next.add(key);
          }
          return next;
        });
        setLastAppliedCount(0);
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
  }, [input, loading, messages, templateId, templateName, fields, currentValues, selectedModel]);

  const handleStop = useCallback(() => {
    if (!loading) return;
    abortRef.current?.abort();
  }, [loading]);

  const handleApply = () => {
    if (!suggestions) return;
    const toApply: Record<string, FillValue> = {};
    for (const key of selectedKeys) {
      const suggested = suggestions[key];
      if (suggested === undefined) continue;
      const current = currentValues[key] ?? "";
      if (toComparableValue(suggested) !== current) {
        toApply[key] = suggested;
      }
    }
    const changedCount = Object.keys(toApply).length;
    if (changedCount > 0) {
      onFill(toApply);
    }
    setLastAppliedCount(changedCount);
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

  const effectiveSelectedCount = useMemo(() => {
    if (!suggestions) return 0;
    let count = 0;
    for (const key of selectedKeys) {
      const suggested = suggestions[key];
      if (suggested === undefined) continue;
      const current = currentValues[key] ?? "";
      if (toComparableValue(suggested) !== current) {
        count += 1;
      }
    }
    return count;
  }, [suggestions, selectedKeys, currentValues]);

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
            <div className="flex items-center gap-1">
              {/* Model selector */}
              {models.length > 0 && (
                <div className="relative" ref={modelMenuRef}>
                  <button
                    type="button"
                    onClick={() => setModelMenuOpen(!modelMenuOpen)}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors max-w-[160px]"
                  >
                    <span className="truncate">{modelName}</span>
                    <ChevronDown className="size-3 shrink-0" />
                  </button>
                  {modelMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] max-h-60 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent transition-colors",
                            m.id === selectedModel && "bg-accent"
                          )}
                          onClick={() => {
                            setSelectedModel(m.id);
                            setModelName(m.name);
                            setModelMenuOpen(false);
                          }}
                        >
                          <span className="size-4 shrink-0 flex items-center justify-center rounded bg-muted text-[9px] font-semibold text-muted-foreground uppercase">
                            {m.providerId.slice(0, 2)}
                          </span>
                          <span className="flex-1 truncate text-left">{m.name}</span>
                          {m.id === selectedModel && (
                            <Check className="size-3 shrink-0 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button variant="ghost" size="icon-xs" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
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
          {suggestions && (
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
                        {toComparableValue(value) === (currentValues[key] ?? "") && (
                          <span className="text-emerald-600 text-[10px]">已是最新</span>
                        )}
                        {hasExistingValue(key) && (
                          <span className="text-amber-500 text-[10px]">覆盖</span>
                        )}
                      </div>
                      <div className="text-muted-foreground truncate">{Array.isArray(value) ? value.join(", ") : value}</div>
                    </div>
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={handleApply}
                disabled={effectiveSelectedCount === 0}
              >
                <Undo2 className="size-3.5" />
                应用增量字段（{effectiveSelectedCount}）
              </Button>
            </div>
          )}

          {lastAppliedCount > 0 && (
            <div className="border-t px-4 py-2 text-xs text-green-600 text-center">
              本次已填充 {lastAppliedCount} 个字段
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
              {loading && (
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0 size-9"
                  onClick={handleStop}
                  aria-label="停止回答"
                >
                  <Square className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
