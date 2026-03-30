import JSZip from "jszip";
import { readFile } from "fs/promises";

export interface ParseResult {
  simplePlaceholders: string[];
  tableBlocks: Array<{ name: string; columns: string[] }>;
  choiceBlocks: Array<{
    key: string;
    mode: "single" | "multiple";
    options: Array<{
      value: string;
      label: string;
      paragraphIndex: number;
      markerText: string;
    }>;
  }>;
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

function extractParagraphTextsFromXml(xml: string): string[] {
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

  return paragraphs;
}

interface InlineChoiceToken {
  type: "text" | "sym";
  value: string;
}

function extractParagraphTokenGroupsFromXml(xml: string): InlineChoiceToken[][] {
  const paragraphs: InlineChoiceToken[][] = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paragraphMatch;

  while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
    const paragraphXml = paragraphMatch[0];
    const tokens: InlineChoiceToken[] = [];
    const childRegex = /<w:r[\s>][\s\S]*?<\/w:r>/g;
    let childMatch;

    while ((childMatch = childRegex.exec(paragraphXml)) !== null) {
      const runXml = childMatch[0];
      const symMatches = Array.from(
        runXml.matchAll(/<w:sym[^>]*w:char="([^"]+)"[^>]*\/>/g)
      );

      if (symMatches.length > 0) {
        for (const symMatch of symMatches) {
          tokens.push({ type: "sym", value: symMatch[1].toUpperCase() });
        }
        continue;
      }

      const textMatches = Array.from(runXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g));
      for (const textMatch of textMatches) {
        if (textMatch[1]) {
          tokens.push({ type: "text", value: textMatch[1] });
        }
      }
    }

    if (tokens.length > 0) {
      paragraphs.push(tokens);
    }
  }

  return paragraphs;
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
const choiceControlRegex = new RegExp(
  `\\{\\{\\s*选项:([\\w${CJK_RANGE}]+)\\|(single|multiple)\\s*\\}\\}`
);
const choiceOptionRegex = /^([□☐☑])\s*(.+)$/;
const checkedSymChars = new Set(["0052"]);
const uncheckedSymChars = new Set(["00A3"]);

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
  const paragraphTexts = extractParagraphTextsFromXml(xmlContent);
  const paragraphTokenGroups = extractParagraphTokenGroupsFromXml(xmlContent);

  const choiceBlocks: ParseResult["choiceBlocks"] = [];

  for (let i = 0; i < paragraphTexts.length; i++) {
    const controlMatch = paragraphTexts[i].match(choiceControlRegex);
    if (!controlMatch) {
      continue;
    }

    const key = controlMatch[1];
    const mode = controlMatch[2] as "single" | "multiple";
    const options: ParseResult["choiceBlocks"][number]["options"] = [];

    let cursor = i + 1;
    while (cursor < paragraphTexts.length) {
      const paragraphText = paragraphTexts[cursor];
      if (
        !paragraphText.trim() ||
        choiceControlRegex.test(paragraphText) ||
        blockStartRegex.test(paragraphText) ||
        blockEndRegex.test(paragraphText) ||
        /\{\{\s*[\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+\s*\}\}/.test(paragraphText)
      ) {
        break;
      }

      const optionMatch = paragraphText.match(choiceOptionRegex);
      if (!optionMatch) {
        break;
      }

      options.push({
        value: optionMatch[2],
        label: optionMatch[2],
        paragraphIndex: cursor,
        markerText: optionMatch[1],
      });
      cursor++;
    }

    if (options.length === 0) {
      throw new Error(`选项组 "${key}" 至少需要一个选项项`);
    }

    choiceBlocks.push({ key, mode, options });
  }

  for (let i = 0; i < paragraphTokenGroups.length; i++) {
    const tokens = paragraphTokenGroups[i];
    if (!tokens.some((token) => token.type === "sym")) {
      continue;
    }

    const leadingText = tokens
      .filter((token) => token.type === "text")
      .map((token) => token.value)
      .join("");
    const firstSeparatorIndex = leadingText.search(/[:：]/);
    if (firstSeparatorIndex < 0) {
      continue;
    }

    const key = leadingText.slice(0, firstSeparatorIndex).trim();
    if (!key || choiceBlocks.some((block) => block.key === key)) {
      continue;
    }

    const options: ParseResult["choiceBlocks"][number]["options"] = [];
    let pendingMarker: string | null = null;

    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
      const token = tokens[tokenIndex];
      if (token.type === "sym") {
        if (checkedSymChars.has(token.value)) {
          pendingMarker = "☑";
        } else if (uncheckedSymChars.has(token.value)) {
          pendingMarker = "☐";
        }
        continue;
      }

      if (!pendingMarker) {
        continue;
      }

      let optionLabel = token.value;
      while (
        tokenIndex + 1 < tokens.length &&
        tokens[tokenIndex + 1].type === "text"
      ) {
        optionLabel += tokens[tokenIndex + 1].value;
        tokenIndex++;
      }

      optionLabel = optionLabel.trim();
      if (!optionLabel || optionLabel === ":" || optionLabel === "：") {
        continue;
      }

      options.push({
        value: optionLabel,
        label: optionLabel,
        paragraphIndex: i,
        markerText: pendingMarker,
      });
      pendingMarker = null;
    }

    if (options.length >= 2) {
      choiceBlocks.push({
        key,
        mode: key.includes("多") ? "multiple" : "single",
        options,
      });
    }
  }

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

  const simplePlaceholders = Array.from(simpleKeys).filter((key) => {
    return !choiceBlocks.some((block) => block.key === key);
  });

  return {
    simplePlaceholders,
    tableBlocks,
    choiceBlocks,
  };
}
