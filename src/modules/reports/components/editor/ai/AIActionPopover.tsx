"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Settings, ChevronDown, Copy, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorAIActionItem } from "@/types/editor-ai";
import { executeAIAction } from "./AIActionExecutor";
import { useEditorAIStore } from "./useEditorAIStore";

function extractBlockText(block: any): string {
  if (!block?.content) return "";
  return block.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("");
}

interface AIActionPopoverProps {
  globalActions: EditorAIActionItem[];
  userActions: EditorAIActionItem[];
  selection: string;
  selectedBlockIds: string[];
  context: string;
  editor: any;
  executing: boolean;
  onExecutingChange: (v: boolean) => void;
  onOpenSidebar: () => void;
  onEditAction: (action: EditorAIActionItem) => void;
  onCreateAction: () => void;
}

export function AIActionPopover({
  globalActions,
  userActions,
  selection,
  selectedBlockIds,
  context,
  editor,
  executing,
  onExecutingChange,
  onOpenSidebar,
  onEditAction,
  onCreateAction,
}: AIActionPopoverProps) {
  const result = useEditorAIStore((s) => s.actionDialogResult);
  const setResult = useEditorAIStore((s) => s.setActionDialogResult);
  const resetResult = useEditorAIStore((s) => s.resetActionDialogResult);
  const abortRef = useRef<AbortController | null>(null);
  const [input, setInput] = useState("");

  const handleExecute = useCallback(
    (action: EditorAIActionItem) => {
      if (executing) return;

      setResult("");
      onExecutingChange(true);

      const controller = new AbortController();
      abortRef.current = controller;

      executeAIAction({
        actionId: action.id,
        selection: selection || undefined,
        context: context || undefined,
        onChunk: (text) => setResult(text),
        onDone: (text) => {
          setResult(text);
          onExecutingChange(false);
          abortRef.current = null;
        },
        onError: (message) => {
          setResult(`错误: ${message}`);
          onExecutingChange(false);
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
    onExecutingChange(true);

    const controller = new AbortController();
    abortRef.current = controller;

    executeAIAction({
      prompt: input.trim(),
      selection: selection || undefined,
      context: context || undefined,
      onChunk: (text) => setResult(text),
      onDone: (text) => {
        setResult(text);
        onExecutingChange(false);
        abortRef.current = null;
      },
      onError: (message) => {
        setResult(`错误: ${message}`);
        onExecutingChange(false);
        abortRef.current = null;
      },
      signal: controller.signal,
    });

    setInput("");
  }, [input, executing, selection, context]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    onExecutingChange(false);
  }, []);

  const handleReplace = useCallback(() => {
    if (!result || !editor) return;
    try {
      const newBlocks = editor.tryParseMarkdownToBlocks?.(result);
      if (!newBlocks?.length) return;

      // Strategy 1: Replace by block IDs directly using the stored snapshot
      if (selectedBlockIds.length > 0) {
        const docBlocks = editor.document ?? editor.topLevelBlocks ?? [];
        const blocksToReplace = docBlocks.filter((b: any) =>
          selectedBlockIds.includes(b.id),
        );
        if (blocksToReplace.length > 0) {
          editor.replaceBlocks(blocksToReplace, newBlocks);
          return;
        }
      }

      // Strategy 2: Find block containing the selection text
      if (selection) {
        const docBlocks = editor.document ?? editor.topLevelBlocks ?? [];
        const match = docBlocks.find((b: any) => {
          const text = extractBlockText(b);
          return text && selection && text.includes(selection.trim());
        });
        if (match) {
          editor.replaceBlocks([match], newBlocks);
          return;
        }
      }

      // Strategy 3: Use focused block
      const focused = editor.focusBlock;
      if (focused) {
        editor.replaceBlocks([focused], newBlocks);
      }
    } catch (err) {
      console.error("[AIActionPopover] replace error:", err);
    }
  }, [result, editor, selectedBlockIds, selection]);

  const handleInsert = useCallback(() => {
    if (!result || !editor) return;
    try {
      const newBlocks = editor.tryParseMarkdownToBlocks?.(result);
      if (!newBlocks?.length) return;
      const focused = editor.focusBlock;
      if (focused) {
        editor.insertBlocks(newBlocks, focused, "after");
      }
    } catch {}
  }, [result, editor]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch {}
  }, [result]);

  return (
    <div className="flex w-80 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">✨ AI 助手</span>
        <span className="text-xs text-muted-foreground">
          {executing ? "正在生成..." : "选择操作或输入指令"}
        </span>
      </div>

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
        <div className="flex flex-col gap-1.5">
          <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-2 text-xs">
            <pre className="whitespace-pre-wrap font-sentence">{result}</pre>
            {executing && <span className="ml-0.5 inline-block animate-pulse">▌</span>}
          </div>
          {/* Action buttons */}
          {!executing && (
            <div className="flex items-center gap-1">
              {selection && (
                <Button
                  variant="default"
                  size="xs"
                  className="h-6 gap-1 text-xs"
                  onClick={(e) => { e.stopPropagation(); handleReplace(); }}
                  title="替换选中的原文"
                >
                  <ArrowRightLeft className="size-3" />
                  替换原文
                </Button>
              )}
              <Button
                variant="outline"
                size="xs"
                className="h-6 gap-1 text-xs"
                onClick={(e) => { e.stopPropagation(); handleInsert(); }}
                title="插入到光标后"
              >
                插入
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="h-6 gap-1 text-xs"
                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                title="复制到剪贴板"
              >
                <Copy className="size-3" />
                复制
              </Button>
            </div>
          )}
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
