/**
 * report-engine → BlockNote converter
 *
 * Converts report-engine payload blocks into BlockNote editor blocks
 * for display in the editor.
 */

export interface EngineBlock {
  type: string;
  [key: string]: any;
}

export interface BlockNoteBlock {
  id: string;
  type: string;
  props?: Record<string, any>;
  content?: any;
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

  for (const block of blocks) {
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
          content: (block.segments || []).map((seg: any) => ({
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

      case "three_line_table":
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
        break;

      case "note":
        result.push(bn("quote", {
          content: [{ type: "text", text: block.text || "" }],
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
          content: [{ type: "text", text: `$${block.formula || ""}$` }],
        }));
        break;

      case "image": {
        const path = block.path || "";
        // Only include images with valid URLs (http/https/blob/data)
        const url = /^https?:\/\//.test(path) ? path : "";
        if (!url) break;
        result.push(bn("image", {
          props: {
            url,
            width: block.width,
            caption: block.caption || "",
          },
        }));
        break;
      }

      case "mermaid":
        result.push(bn("mermaidBlock", {
          props: { code: block.code || "" },
        }));
        break;

      // page_break not supported by BlockNote, skip

      case "horizontal_rule":
        result.push(bn("divider"));
        break;

      case "checklist":
        for (let i = 0; i < (block.items || []).length; i++) {
          result.push(bn("checkListItem", {
            props: { checked: !!block.checked?.[i] },
            content: [{ type: "text", text: block.items[i] }],
          }));
        }
        break;

      // Blocks not supported by BlockNote are silently skipped
      default:
        break;
    }
  }

  return result;
}

/**
 * Build BlockNote table content from headers + rows.
 * BlockNote table content must be { type: "tableContent", rows: [...] }.
 */
function buildTableContent(
  headers: string[],
  rows: string[][]
): any {
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
 *
 * For each section in the payload whose id matches an existing draft section,
 * the engine blocks are converted to BlockNote blocks and replace the draft
 * section content. Sections not present in the payload are left untouched.
 */
export function payloadToDraftSections(
  payload: { sections?: { id: string; blocks: EngineBlock[] }[] },
  existingSections: Record<string, any[]>,
  sectionEnabled: Record<string, boolean>
): Record<string, any[]> {
  const result: Record<string, any[]> = {};

  // Keep existing sections that are not in the payload
  for (const [id, blocks] of Object.entries(existingSections)) {
    result[id] = blocks;
  }

  // Override with payload sections
  if (payload.sections) {
    for (const sec of payload.sections) {
      if (sec.id in result) {
        result[sec.id] = engineToBlocknoteBlocks(sec.blocks || []);
      }
    }
  }

  return result;
}
