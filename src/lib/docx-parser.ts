import JSZip from "jszip";
import { readFile } from "fs/promises";

export interface ParseResult {
  simplePlaceholders: string[];
  tableBlocks: Array<{ name: string; columns: string[] }>;
}

/**
 * Extract {{ key }} placeholders from a docx file.
 *
 * Process:
 * 1. Unzip docx with JSZip
 * 2. Read word/document.xml
 * 3. For each <w:p> paragraph, merge all <w:r>/<w:t> text nodes
 *    (this solves the problem where Word splits {{ xxx }} across multiple XML runs)
 * 4. Extract unique placeholder keys using regex /\{\{(\w+)\}\}/g
 * 5. Return deduplicated keys
 */
export async function extractPlaceholders(filePath: string): Promise<string[]> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");

  if (!documentXml) {
    throw new Error("无效的 docx 文件：缺少 word/document.xml");
  }

  const xmlContent = await documentXml.async("string");
  const text = extractTextFromXml(xmlContent);
  const placeholders = matchPlaceholders(text);

  return placeholders;
}

function extractTextFromXml(xml: string): string {
  // Split by <w:p> paragraphs, merge all <w:t> text within each paragraph
  const paragraphs: string[] = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let match;

  while ((match = paragraphRegex.exec(xml)) !== null) {
    const paragraphXml = match[0];
    let paragraphText = "";
    const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let textMatch;

    while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
      paragraphText += textMatch[1];
    }

    if (paragraphText.trim()) {
      paragraphs.push(paragraphText);
    }
  }

  return paragraphs.join("\n");
}

function matchPlaceholders(text: string): string[] {
  const regex = /\{\{\s*([\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+)\s*\}\}/g;
  const keys = new Set<string>();
  let match;

  while ((match = regex.exec(text)) !== null) {
    keys.add(match[1]);
  }

  return Array.from(keys);
}

// ── Block marker regex for {{#name}} / {{/name}} ──

const CJK_RANGE = "\\u4e00-\\u9fff\\u3400-\\u4dbf\\uf900-\\ufaff";
const blockStartRegex = new RegExp(`\\{\\{\\s*#([\\w${CJK_RANGE}]+)\\s*\\}\\}`, "g");
const blockEndRegex = new RegExp(`\\{\\{\\s*/([\\w${CJK_RANGE}]+)\\s*\\}\\}`, "g");

/**
 * Parse a docx file into structured placeholders, recognizing
 * `{{#name}}...{{/name}}` table blocks in addition to simple `{{key}}` placeholders.
 */
export async function parseStructuredPlaceholders(filePath: string): Promise<ParseResult> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");

  if (!documentXml) {
    throw new Error("无效的 docx 文件：缺少 word/document.xml");
  }

  const xmlContent = await documentXml.async("string");
  const text = extractTextFromXml(xmlContent);

  // Collect all block start/end markers with their positions
  const starts: Array<{ name: string; index: number }> = [];
  const ends: Array<{ name: string; index: number }> = [];

  let match;
  blockStartRegex.lastIndex = 0;
  while ((match = blockStartRegex.exec(text)) !== null) {
    starts.push({ name: match[1], index: match.index });
  }

  blockEndRegex.lastIndex = 0;
  while ((match = blockEndRegex.exec(text)) !== null) {
    ends.push({ name: match[1], index: match.index });
  }

  // Validate blocks: each name must have exactly 1 start and 1 end, start before end
  const blockNames = new Set(starts.map((s) => s.name));
  const tableBlocks: ParseResult["tableBlocks"] = [];

  for (const name of blockNames) {
    const blockStarts = starts.filter((s) => s.name === name);
    const blockEnds = ends.filter((e) => e.name === name);

    if (blockStarts.length !== 1 || blockEnds.length !== 1) {
      throw new Error(`表格块 "{{#${name}}}" 必须有且仅有一个起始标记和一个结束标记`);
    }

    if (blockStarts[0].index >= blockEnds[0].index) {
      throw new Error(`表格块 "{{#${name}}}" 的结束标记必须在起始标记之后`);
    }

    const blockStartIdx = blockStarts[0].index;
    const blockEndIdx = blockEnds[0].index;
    const blockText = text.slice(blockStartIdx, blockEndIdx);

    // Extract column keys from within the block, excluding the #name marker itself
    const columnRegex = /\{\{\s*([\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+)\s*\}\}/g;
    const columnKeys = new Set<string>();
    let colMatch;
    while ((colMatch = columnRegex.exec(blockText)) !== null) {
      const key = colMatch[1];
      // Skip the block name marker (e.g. {{#items}} captures "items")
      if (key !== name) {
        columnKeys.add(key);
      }
    }

    tableBlocks.push({ name, columns: Array.from(columnKeys) });
  }

  // Collect ranges covered by blocks so we can identify simple placeholders outside blocks
  const blockRanges: Array<{ start: number; end: number }> = tableBlocks.map((block) => {
    const startEntry = starts.find((s) => s.name === block.name)!;
    const endEntry = ends.find((e) => e.name === block.name)!;
    return { start: startEntry.index, end: endEntry.index };
  });

  // Extract all simple placeholders that are NOT inside any block
  const placeholderRegex = /\{\{\s*([\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+)\s*\}\}/g;
  const simpleKeys = new Set<string>();

  placeholderRegex.lastIndex = 0;
  while ((match = placeholderRegex.exec(text)) !== null) {
    const matchStart = match.index;

    // Skip if this placeholder is inside any block range
    const insideBlock = blockRanges.some(
      (range) => matchStart > range.start && matchStart < range.end
    );

    if (!insideBlock) {
      simpleKeys.add(match[1]);
    }
  }

  return {
    simplePlaceholders: Array.from(simpleKeys),
    tableBlocks,
  };
}
