"use client";

import { useMemo } from "react";

interface HeadingItem {
  id: string;
  text: string;
  level: number;
  sectionId: string;
}

interface OutlinePanelProps {
  sections: Record<string, Record<string, unknown>[]>;
  sectionEnabled: Record<string, boolean>;
  activeSection?: string;
  onNavigateHeading?: (sectionId: string, blockId: string) => void;
  collapsed?: boolean;
}

interface BlockLike {
  type?: string;
  id?: string;
  content?: unknown[];
  props?: Record<string, unknown>;
}

function extractHeadings(
  sections: Record<string, Record<string, unknown>[]>,
  sectionEnabled: Record<string, boolean>
): HeadingItem[] {
  const headings: HeadingItem[] = [];
  for (const [sectionId, blocks] of Object.entries(sections)) {
    if (sectionEnabled[sectionId] === false) continue;
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      const b = block as BlockLike;
      if (b.type === "heading" && b.id) {
        const text = Array.isArray(b.content)
          ? b.content
              .map((s) => (typeof s === "object" && s !== null && "text" in s ? String((s as Record<string, unknown>).text) : ""))
              .join("")
          : "";
        headings.push({
          id: b.id,
          text,
          level: (b.props?.level as number) || 2,
          sectionId,
        });
      }
    }
  }
  return headings;
}

export function OutlinePanel({
  sections,
  sectionEnabled,
  activeSection,
  onNavigateHeading,
  collapsed,
}: OutlinePanelProps) {
  if (collapsed) return null;

  const headings = useMemo(
    () => extractHeadings(sections, sectionEnabled),
    [sections, sectionEnabled]
  );

  if (headings.length === 0) {
    return <p className="px-3 pt-3 text-xs text-muted-foreground">暂无标题</p>;
  }

  return (
    <>
      <div className="px-3 pt-3 pb-2">
        <p className="text-xs font-medium text-muted-foreground">大纲</p>
      </div>
      <div className="flex-1 px-1 pb-3">
        {headings.map((h, idx) => {
          const isActive = h.sectionId === activeSection;
          const indent = Math.max(0, h.level - 1) * 12;
          return (
            <button
              key={`${idx}-${h.sectionId}-${h.id}`}
              onClick={() => onNavigateHeading?.(h.sectionId, h.id)}
              className={`block w-full text-left px-2 py-1 rounded text-xs truncate transition-colors ${
                isActive
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              style={{ paddingLeft: `${8 + indent}px` }}
              title={h.text}
            >
              {h.text || "(无标题)"}
            </button>
          );
        })}
      </div>
    </>
  );
}
