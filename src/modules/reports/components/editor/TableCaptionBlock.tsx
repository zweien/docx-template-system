"use client";

import { createReactBlockSpec, type ReactCustomBlockRenderProps } from "@blocknote/react";
import { useCallback, useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TableCaptionBlockRender({ block, editor }: ReactCustomBlockRenderProps<any>) {
  const [localText, setLocalText] = useState(block.props.text || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const newText = block.props.text || "";
    if (newText !== localText) {
      setLocalText(newText);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.props.text]);

  const persistText = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        editor.updateBlock(block.id, {
          type: "tableCaption",
          props: { text },
        });
      }, 300);
    },
    [editor, block.id],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalText(val);
      persistText(val);
    },
    [persistText],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="my-1 flex items-center justify-center gap-2">
      <span className="text-xs text-[var(--text-tertiary)]">表题</span>
      <input
        ref={inputRef}
        type="text"
        value={localText}
        onChange={handleChange}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        placeholder="输入表格标题…"
        className="w-64 border-b border-[var(--border-standard)] bg-transparent px-1 py-0.5 text-center text-sm text-[var(--text-primary)] placeholder-[var(--text-quaternary)] focus:border-[var(--brand)] focus:outline-none"
      />
    </div>
  );
}

export const TableCaptionBlockSpec = createReactBlockSpec(
  {
    type: "tableCaption" as const,
    propSchema: {
      text: { default: "" },
    },
    content: "none" as const,
  },
  {
    render: TableCaptionBlockRender,
    meta: {
      selectable: false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toExternalHTML: (props: any) => (
      <figcaption>{props.block.props.text || ""}</figcaption>
    ),
    parse: (el: HTMLElement) => {
      if (el.tagName === "FIGCAPTION") {
        return { text: el.textContent || "" };
      }
      return undefined;
    },
  },
);
