export interface EngineBlock {
  type: string;
  [key: string]: any;
}

function extractText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((s: any) => typeof s === "object" && s.text)
      .map((s: any) => s.text)
      .join("");
  }
  return "";
}

function hasInlineStyles(content: any[]): boolean {
  return content.some((seg: any) => typeof seg === "object" && seg.styles && Object.keys(seg.styles).length > 0);
}

export function convertBlocknoteToEngine(blocks: any[]): EngineBlock[] {
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
        const content = block.content || [];
        if (hasInlineStyles(content)) {
          result.push({
            type: "rich_paragraph",
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
        const tableContent = block.content;
        const rows: string[][] = [];
        if (tableContent?.rows) {
          for (const row of tableContent.rows) {
            rows.push((row.cells || []).map((cell: any) => extractText(cell.content)));
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
