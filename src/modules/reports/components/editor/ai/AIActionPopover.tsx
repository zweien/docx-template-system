"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PopoverDescription, PopoverHeader, PopoverTitle } from "@/components/ui/popover";
import type { EditorAIActionItem } from "@/types/editor-ai";
import { executeAIAction } from "./AIActionExecutor";

interface AIActionPopoverProps {
  globalActions: EditorAIActionItem[];
  userActions: EditorAIActionItem[];
  selection: string;
  context: string;
  onOpenSidebar: () => void;
  onEditAction: (action: EditorAIActionItem) => void;
  onCreateAction: () => void;
}

export function AIActionPopover({
  globalActions,
  userActions,
  selection,
  context,
  onOpenSidebar,
  onEditAction,
  onCreateAction,
}: AIActionPopoverProps) {
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState("");
  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleExecute = useCallback(
    (action: EditorAIActionItem) => {
      if (executing) return;

      setResult("");
      setExecuting(true);

      const controller = new AbortController();
      abortRef.current = controller;

      executeAIAction({
        actionId: action.id,
        selection: selection || undefined,
        context: context || undefined,
        onChunk: (text) => setResult(text),
        onDone: (text) => {
          setResult(text);
          setExecuting(false);
          abortRef.current = null;
        },
        onError: (message) => {
          setResult(`错误: ${message}`);
          setExecuting(false);
          abortRef.current = null;
        },
        signal: controller.signal,
      });
    },
    [executing, selection, context],
  );

  const handleFreeInput = useCallback(() => {
    if (!input.trim() || executing) return;

    setResult("");
    setExecuting(true);

    const controller = new AbortController();
    abortRef.current = controller;

    executeAIAction({
      prompt: input.trim(),
      selection: selection || undefined,
      context: context || undefined,
      onChunk: (text) => setResult(text),
      onDone: (text) => {
        setResult(text);
        setExecuting(false);
        abortRef.current = null;
      },
      onError: (message) => {
        setResult(`错误: ${message}`);
        setExecuting(false);
        abortRef.current = null;
      },
      signal: controller.signal,
    });

    setInput("");
  }, [input, executing, selection, context]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setExecuting(false);
  }, []);

  return (
    <div className="flex w-80 flex-col gap-3">
      <PopoverHeader>
        <PopoverTitle>✨ AI 助手</PopoverTitle>
        <PopoverDescription>
          {executing ? "正在生成..." : "选择操作或输入指令"}
        </PopoverDescription>
      </PopoverHeader>

      {/* Preset actions */}
      {globalActions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">常用操作</span>
          <div className="grid grid-cols-2 gap-1">
            {globalActions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="xs"
                className="justify-start text-left"
                disabled={executing}
                onClick={() => handleExecute(action)}
              >
                <span className="mr-1">{action.icon || "🤖"}</span>
                <span className="truncate">{action.name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* User templates */}
      {userActions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">我的模板</span>
          <div className="flex flex-col gap-0.5">
            {userActions.map((action) => (
              <div key={action.id} className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  className="flex-1 justify-start text-left"
                  disabled={executing}
                  onClick={() => handleExecute(action)}
                >
                  <span className="mr-1">{action.icon || "📄"}</span>
                  <span className="truncate">{action.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 w-6 shrink-0 p-0"
                  onClick={() => onEditAction(action)}
                  title="编辑模板"
                >
                  <Settings className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result preview */}
      {result && (
        <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-2 text-xs">
          <pre className="whitespace-pre-wrap font-sentence">{result}</pre>
          {executing && <span className="ml-0.5 inline-block animate-pulse">▌</span>}
        </div>
      )}

      {/* Free input */}
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="flex h-7 flex-1 rounded-md border bg-transparent px-2 text-xs outline-none focus:border-ring"
          placeholder="输入自定义指令..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (executing) {
                handleCancel();
              } else {
                handleFreeInput();
              }
            }
          }}
          disabled={executing}
        />
        <Button
          variant={executing ? "destructive" : "default"}
          size="xs"
          className="h-7 w-7 shrink-0 p-0"
          onClick={executing ? handleCancel : handleFreeInput}
          disabled={!executing && !input.trim()}
          title={executing ? "停止" : "发送"}
        >
          {executing ? <ChevronDown className="size-3" /> : <Send className="size-3" />}
        </Button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          type="button"
          className="hover:text-foreground"
          onClick={onCreateAction}
        >
          + 新建模板
        </button>
        <button
          type="button"
          className="hover:text-foreground"
          onClick={onOpenSidebar}
        >
          侧边栏对话
        </button>
      </div>
    </div>
  );
}
