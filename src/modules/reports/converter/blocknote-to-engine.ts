export interface EngineBlock {
  type: string;
  [key: string]: unknown;
}

interface ContentSegment {
  text?: string;
  styles?: Record<string, unknown>;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((s): s is ContentSegment => typeof s === "object" && s !== null && "text" in s)
      .map((s) => s.text || "")
      .join("");
  }
  return "";
}

function hasInlineStyles(content: unknown[]): boolean {
  return content.some((seg) =>
    typeof seg === "object" && seg !== null && "styles" in seg && Object.keys((seg as ContentSegment).styles || {}).length > 0
  );
}

interface BlockLike {
  type: string;
  content?: unknown;
  props?: Record<string, unknown>;
}

export function convertBlocknoteToEngine(blocks: BlockLike[]): EngineBlock[] {
  const result: EngineBlock[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    if (!block || typeof block !== "object" || !block.type) { i++; continue; }

    switch (block.type) {
      case "heading":
        result.push({ type: "heading", text: extractText(block.content), level: block.props?.level || 2 });
        break;

      case "paragraph": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = (block.content || []) as any[];
        if (hasInlineStyles(content)) {
          result.push({
            type: "rich_paragraph",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            segments: content.map((seg: any) => ({
              text: seg.text || "",
              ...(seg.styles?.bold && { bold: true }),
              ...(seg.styles?.italic && { italic: true }),
            })),
          });
        } else {
          result.push({ type: "paragraph", text: extractText(content) });
        }
        break;
      }

      case "bulletListItem": {
        const items: string[] = [];
        while (i < blocks.length && blocks[i]?.type === "bulletListItem") {
          items.push(extractText(blocks[i].content));
          i++;
        }
        result.push({ type: "bullet_list", items });
        continue;
      }

      case "numberedListItem": {
        const items: string[] = [];
        while (i < blocks.length && blocks[i]?.type === "numberedListItem") {
          items.push(extractText(blocks[i].content));
          i++;
        }
        result.push({ type: "numbered_list", items });
        continue;
      }

      case "table": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableContent = block.content as any;
        const rows: string[][] = [];
        if (tableContent?.rows) {
          for (const row of tableContent.rows) {
            rows.push((row.cells || []).map((cell: BlockLike) => extractText(cell.content)));
          }
        }
        if (rows.length > 0) {
          result.push({ type: "table", title: "", headers: rows[0], rows: rows.slice(1) });
        }
        break;
      }

      case "tableCaption": {
        const captionText = block.props?.text || "";
        if (captionText && result.length > 0 && result[result.length - 1].type === "table") {
          result[result.length - 1].title = captionText;
        }
        break;
      }

      case "quote":
        result.push({ type: "quote", text: extractText(block.content) });
        break;

      case "codeBlock": {
        const code = extractText(block.content);
        const lang = block.props?.language || "";
        if (lang === "mermaid") {
          result.push({ type: "mermaid", code });
        } else {
          result.push({ type: "code_block", code });
        }
        break;
      }

      case "image": {
        const url = block.props?.url || block.props?.src || "";
        if (url) {
          result.push({ type: "image", path: url, caption: block.props?.caption || "" });
        }
        break;
      }

      case "mermaidBlock":
        result.push({ type: "mermaid", code: block.props?.code || "" });
        break;

      case "divider":
        result.push({ type: "horizontal_rule" });
        break;

      case "checkListItem": {
        const items: string[] = [];
        const checked: boolean[] = [];
        while (i < blocks.length && blocks[i]?.type === "checkListItem") {
          items.push(extractText(blocks[i].content));
          checked.push(!!blocks[i].props?.checked);
          i++;
        }
        result.push({ type: "checklist", items, checked });
        continue;
      }
    }
    i++;
  }

  return result;
}
