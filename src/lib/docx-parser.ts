import JSZip from "jszip";
import { readFile } from "fs/promises";

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
