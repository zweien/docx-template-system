"use client";

import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems, FormattingToolbar, FormattingToolbarController, getFormattingToolbarItems } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import "@blocknote/shadcn/style.css";
import "@blocknote/xl-ai/style.css";
import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { DefaultChatTransport } from "ai";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  getAISlashMenuItems,
} from "@blocknote/xl-ai";
import { en as coreDictionary } from "@blocknote/core/locales";
import { en as aiDictionary } from "@blocknote/xl-ai/locales";
import {
  engineToBlocknoteBlocks,
  type EngineBlock,
  type BlockNoteBlock,
} from "@/modules/reports/converter/engine-to-blocknote";
import { reportSchema } from "@/modules/reports/schema/blocknote-schema";

interface SectionEditorProps {
  blocks: EngineBlock[];
  onChange: (blocks: BlockNoteBlock[]) => void;
  scrollToBlockId?: string;
  onScrolled?: () => void;
}

function isBlockNoteBlocks(blocks: EngineBlock[]): boolean {
  return blocks.length > 0 && blocks.every(
    (b) => typeof b === "object" && b != null && "id" in b && "type" in b && "children" in b
  );
}

interface BlockLike {
  type: string;
  id?: string;
  content?: unknown[];
  children?: unknown[];
  props?: Record<string, unknown>;
}

function migrateMermaidBlocks(blocks: BlockLike[]): BlockLike[] {
  return blocks.map((block) => {
    if (block.type === "codeBlock" && block.props?.language === "mermaid") {
      const content = block.content || [];
      const code = content
        .map((seg) => (typeof seg === "object" && seg !== null && "text" in seg ? String((seg as Record<string, unknown>).text) : ""))
        .join("");
      return {
        id: block.id,
        type: "mermaidBlock",
        props: { code },
        children: block.children || [],
      };
    }
    return block;
  });
}

const UNSUPPORTED_STYLES = new Set(["subscript", "superscript"]);

function sanitizeStyles(blocks: BlockLike[]): BlockLike[] {
  return blocks.map((block) => {
    if (!block.content || !Array.isArray(block.content)) return block;
    const content = block.content.map((seg) => {
      if (typeof seg !== "object" || seg === null || !("styles" in seg)) return seg;
      const styles = (seg as Record<string, unknown>).styles as Record<string, unknown>;
      if (!styles) return seg;
      const cleaned = { ...styles };
      let changed = false;
      for (const key of UNSUPPORTED_STYLES) {
        if (key in cleaned) { delete cleaned[key]; changed = true; }
      }
      if (!changed) return seg;
      return { ...seg, styles: cleaned };
    });
    return { ...block, content };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prepareBlocks(blocks: any[]): BlockLike[] {
  if (blocks.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = isBlockNoteBlocks(blocks) ? blocks : engineToBlocknoteBlocks(blocks as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return sanitizeStyles(migrateMermaidBlocks(raw as any[])).filter((b) => {
    if (b.type === "image" && !b.props?.url) return false;
    return true;
  });
}

const aiTransport = new DefaultChatTransport({ api: "/api/reports/chat" });

export function SectionEditor({ blocks, onChange, scrollToBlockId, onScrolled }: SectionEditorProps) {
  const { resolvedTheme } = useTheme();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useCreateBlockNote({
    schema: reportSchema,
    dictionary: { ...coreDictionary, ai: aiDictionary },
    extensions: [
      AIExtension({ transport: aiTransport }),
    ],
    uploadFile: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/reports/upload/image", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      return json.data?.url || json.url;
    },
  });

  // Load content after mount via replaceBlocks so errors can be caught
  const blocksLoadedRef = useRef(false);
  useEffect(() => {
    if (blocksLoadedRef.current) return;
    blocksLoadedRef.current = true;
    const prepared = prepareBlocks(blocks);
    if (prepared.length > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (editor as any).replaceBlocks(editor.document, prepared);
      } catch {}
    }
  }, [editor]);

  const lastDocJsonRef = useRef<string>("");
  const handleEditorChange = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const json = JSON.stringify(editor.document);
      if (json !== lastDocJsonRef.current) {
        lastDocJsonRef.current = json;
        onChangeRef.current(editor.document);
      }
    }, 300);
  }, [editor]);

  // Scroll to a specific block after editor mounts
  useEffect(() => {
    if (!scrollToBlockId) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(
        `[data-id="${scrollToBlockId}"]`
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        try { editor.setTextCursorPosition(scrollToBlockId, "start"); } catch {}
      }
      onScrolled?.();
    }, 150);
    return () => clearTimeout(timer);
  }, [scrollToBlockId, editor, onScrolled]);

  const getSlashMenuItems = useCallback(
    async (query: string) => {
      const defaultItems = getDefaultReactSlashMenuItems(editor);
      const mermaidItem = {
        key: "mermaidBlock" as unknown as string,
        title: "Mermaid Diagram",
        subtext: "插入 mermaid 流程图/图表",
        group: "Advanced" as unknown as string,
        aliases: ["mermaid", "diagram", "flowchart", "chart"],
        icon: (
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="16" width="7" height="5" rx={1} />
            <path d="M6.5 8v5.5a2 2 0 0 0 2 2H14" />
            <path d="M14 12l3.5 3.5" />
          </svg>
        ),
        onItemClick: () =>
          insertOrUpdateBlockForSlashMenu(editor, {
            type: "mermaidBlock",
            props: { code: "graph TD\n  A --> B" },
          }),
      };
      const captionItem = {
        key: "tableCaption" as unknown as string,
        title: "表题",
        subtext: "在表格上方插入表题/标题",
        group: "Advanced" as unknown as string,
        aliases: ["caption", "biaoti", "biao ti", "table caption", "title"],
        icon: (
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16" />
            <path d="M4 12h10" />
            <path d="M4 17h6" />
          </svg>
        ),
        onItemClick: () =>
          insertOrUpdateBlockForSlashMenu(editor, {
            type: "tableCaption",
            props: { text: "" },
          }),
      };

      // Insert custom items into the Advanced group
      const items = [...defaultItems];
      let insertIdx = items.length;
      for (let i = items.length - 1; i >= 0; i--) {
        if ((items[i] as Record<string, unknown>).group === "Advanced") {
          insertIdx = i + 1;
          break;
        }
      }
      items.splice(insertIdx, 0, mermaidItem, captionItem);

      // Add AI slash menu items
      const aiItems = getAISlashMenuItems(editor);
      items.push(...aiItems);

      return filterSuggestionItems(items, query);
    },
    [editor],
  );

  // Prevent popover close while a form popover (caption/rename) is open.
  // BlockNote's FileCaptionButton/FileNameButton call updateBlock on each keystroke,
  // which triggers ProseMirror transaction → React re-render → popover unmounts.
  // Fix: intercept updateBlock to suppress the transaction, and override the input's
  // value setter to prevent React from resetting the native value during re-renders.
  // When the popover closes, flush the last updateBlock to persist the data.
  useEffect(() => {
    const getPopoverInput = () =>
      document.querySelector(".bn-popover-content.bn-form-popover input") as HTMLInputElement | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origUpdateBlock = (editor as any).updateBlock.bind(editor);
    let popoverActive = false;
    let pendingBlockId = "";
    let pendingProps: Record<string, unknown> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).updateBlock = function (blockId: string, partial: any) {
      const popover = document.querySelector(".bn-popover-content.bn-form-popover");
      if (popover && partial.props) {
        const val = partial.props.caption ?? partial.props.name;
        if (val !== undefined) {
          popoverActive = true;
          pendingBlockId = blockId;
          pendingProps = partial.props;
          return;
        }
      }
      origUpdateBlock(blockId, partial);
    };

    // Watch for popover — override input value setter to prevent React from
    // resetting the user's typed text during controlled-component re-renders.
    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
    const guardedInputs = new WeakSet<HTMLInputElement>();
    const observer = new MutationObserver(() => {
      const popover = document.querySelector(".bn-popover-content.bn-form-popover");
      const input = getPopoverInput();

      if (popover && input && !guardedInputs.has(input)) {
        popoverActive = true;
        guardedInputs.add(input);
        Object.defineProperty(input, "value", {
          get() {
            return valueDescriptor.get!.call(this);
          },
          set(val: string) {
            if (!popoverActive) {
              valueDescriptor.set!.call(this, val);
            }
            // When popoverActive, ignore React's value reset — let the native
            // value persist so the user sees what they type.
          },
          configurable: true,
        });
      }

      // When popover closes, flush the pending updateBlock
      if (!popover && popoverActive) {
        popoverActive = false;
        if (pendingBlockId) {
          origUpdateBlock(pendingBlockId, { props: pendingProps });
          pendingBlockId = "";
          pendingProps = {};
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).updateBlock = origUpdateBlock;
      observer.disconnect();
    };
  }, [editor]);

  return (
    <div className="min-h-[400px]">
      <BlockNoteView
        editor={editor}
        onChange={handleEditorChange}
        theme={resolvedTheme === "light" ? "light" : "dark"}
        slashMenu={false}
        formattingToolbar={false}
        sideMenu
      >
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              {getFormattingToolbarItems()}
              <AIToolbarButton key="ai" />
            </FormattingToolbar>
          )}
        />
        <AIMenuController />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashMenuItems}
        />
      </BlockNoteView>
    </div>
  );
}
