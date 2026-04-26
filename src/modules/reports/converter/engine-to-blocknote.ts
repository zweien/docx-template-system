/**
 * report-engine → BlockNote converter
 *
 * Converts report-engine payload blocks into BlockNote editor blocks
 * for display in the editor.
 */

export interface EngineBlock {
  type: string;
  [key: string]: unknown;
}

export interface BlockNoteBlock {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: BlockNoteBlock[];
}

let blockIdCounter = 0;

function nextId(): string {
  return `bn-${++blockIdCounter}`;
}

function bn(
  type: string,
  overrides: Partial<BlockNoteBlock> = {}
): BlockNoteBlock {
  return { id: nextId(), type, children: [], ...overrides };
}

/**
 * Convert an array of report-engine blocks into BlockNote blocks.
 */
export function engineToBlocknoteBlocks(
  blocks: EngineBlock[]
): BlockNoteBlock[] {
  const result: BlockNoteBlock[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const block of blocks as any[]) {
    switch (block.type) {
      case "heading":
        result.push(bn("heading", {
          props: { level: block.level || 2 },
          content: [{ type: "text", text: block.text || "" }],
        }));
        break;

      case "paragraph":
        result.push(bn("paragraph", {
          content: [{ type: "text", text: block.text || "" }],
        }));
        break;

      case "rich_paragraph":
        result.push(bn("paragraph", {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: (block.segments as any[] || []).map((seg: any) => ({
            type: "text",
            text: seg.text || "",
            styles: {
              ...(seg.bold ? { bold: true } : {}),
              ...(seg.italic ? { italic: true } : {}),
            },
          })),
        }));
        break;

      case "bullet_list":
        for (const item of block.items || []) {
          result.push(bn("bulletListItem", {
            content: [{ type: "text", text: item }],
          }));
        }
        break;

      case "numbered_list":
        for (const item of block.items || []) {
          result.push(bn("numberedListItem", {
            content: [{ type: "text", text: item }],
          }));
        }
        break;

      case "table":
      case "three_line_table":
      case "appendix_table":
        result.push(bn("table", {
          content: buildTableContent(block.headers || [], block.rows || []),
          props: { textColor: {} },
        }));
        if (block.title) {
          result.push(bn("tableCaption", {
            props: { text: block.title },
          }));
        }
        break;

      case "quote":
        result.push(bn("quote", {
          content: [{ type: "text", text: block.text || "" }],
        }));
        if (block.source) {
          result.push(bn("paragraph", {
            content: [{ type: "text", text: `—— ${block.source}` }],
          }));
        }
        break;

      case "note":
        result.push(bn("quote", {
          content: [{ type: "text", text: `注：${block.text || ""}` }],
        }));
        break;

      case "code_block":
        result.push(bn("codeBlock", {
          content: [{ type: "text", text: block.code || "" }],
        }));
        break;

      case "formula":
        result.push(bn("codeBlock", {
          props: { language: "latex" },
          content: [{ type: "text", text: `$${block.latex || ""}$` }],
        }));
        break;

      case "image": {
        const path = block.path || "";
        const url = /^https?:\/\//.test(path) ? path : "";
        if (url) {
          result.push(bn("image", {
            props: { url, caption: block.caption || "" },
          }));
        }
        break;
      }

      case "two_images_row": {
        // Flatten to individual image blocks
        for (const img of block.images || []) {
          const imgPath = img.path || "";
          const imgUrl = /^https?:\/\//.test(imgPath) ? imgPath : "";
          if (imgUrl) {
            result.push(bn("image", {
              props: { url: imgUrl, caption: img.caption || "" },
            }));
          }
        }
        break;
      }

      case "mermaid":
        result.push(bn("mermaidBlock", {
          props: { code: block.code || "" },
        }));
        break;

      case "horizontal_rule":
        result.push(bn("divider"));
        break;

      case "checklist":
        for (const item of block.items || []) {
          result.push(bn("checkListItem", {
            props: { checked: !!item.checked },
            content: [{ type: "text", text: item.text || "" }],
          }));
        }
        break;

      case "toc_placeholder":
        result.push(bn("paragraph", {
          content: [{ type: "text", text: block.title || "目录（自动生成）" }],
        }));
        break;

      case "columns": {
        // Flatten all column blocks sequentially
        for (const colBlocks of block.columns || []) {
          if (Array.isArray(colBlocks)) {
            const converted = engineToBlocknoteBlocks(colBlocks);
            result.push(...converted);
          }
        }
        break;
      }

      // page_break not supported by BlockNote, skip
      default:
        break;
    }
  }

  return result;
}

/**
 * Build BlockNote table content from headers + rows.
 */
function buildTableContent(
  headers: string[],
  rows: string[][]
): Record<string, unknown> {
  const allRows = [headers, ...rows];
  return {
    type: "tableContent",
    columnWidths: headers.map(() => undefined),
    rows: allRows.map((row) => ({
      cells: row.map((cell) => ({
        type: "tableCell",
        props: {
          backgroundColor: "transparent",
          textColor: "default",
          textAlignment: "left",
        },
        content: [{ type: "text", text: cell }],
      })),
    })),
  };
}

/**
 * Convert a report-engine payload into draft sections (BlockNote blocks).
 */
export function payloadToDraftSections(
  payload: { sections?: { id: string; blocks: EngineBlock[] }[] },
  existingSections: Record<string, BlockNoteBlock[]>,
  sectionEnabled: Record<string, boolean>, // eslint-disable-line @typescript-eslint/no-unused-vars
): Record<string, BlockNoteBlock[]> {
  const result: Record<string, BlockNoteBlock[]> = {};

  for (const [id, blocks] of Object.entries(existingSections)) {
    result[id] = blocks;
  }

  if (payload.sections) {
    for (const sec of payload.sections) {
      if (sec.id in result) {
        // Preserve template headings (blocks with id like "heading-{sectionId}-{idx}")
        const prefix = `heading-${sec.id}`;
        const templateHeadings = (result[sec.id] || []).filter(
          (b) => typeof b.id === "string" && b.id.startsWith(prefix)
        );
        const converted = engineToBlocknoteBlocks(sec.blocks || []);
        result[sec.id] = [...templateHeadings, ...converted];
      }
    }
  }

  return result;
}
