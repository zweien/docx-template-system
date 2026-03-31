import JSZip from "jszip";
import * as XLSX from "xlsx";

type ExtractTextResult =
  | { success: true; data: { text: string; summary: string } }
  | { success: false; error: { code: string; message: string } };

interface ExtractTextInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

const SUPPORTED_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
]);

const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

function buildSummary(text: string) {
  return text.slice(0, 240);
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function extractTextFromDocxXml(xml: string) {
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

async function extractDocxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");

  if (!documentXml) {
    throw new Error("无效的 docx 文件：缺少 word/document.xml");
  }

  const xmlContent = await documentXml.async("string");
  return extractTextFromDocxXml(xmlContent);
}

function extractXlsxText(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const texts = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    return [sheetName, csv].filter(Boolean).join("\n");
  }).filter(Boolean);

  return texts.join("\n\n");
}

export async function extractTextFromBuffer(
  input: ExtractTextInput
): Promise<ExtractTextResult> {
  const ext = getFileExtension(input.fileName);

  try {
    if (SUPPORTED_TEXT_MIME_TYPES.has(input.mimeType) || ["txt", "md", "csv"].includes(ext)) {
      const text = input.buffer.toString("utf-8");
      return {
        success: true,
        data: {
          text,
          summary: buildSummary(text),
        },
      };
    }

    if (DOCX_MIME_TYPES.has(input.mimeType) || ext === "docx") {
      const text = await extractDocxText(input.buffer);
      return {
        success: true,
        data: {
          text,
          summary: buildSummary(text),
        },
      };
    }

    if (XLSX_MIME_TYPES.has(input.mimeType) || ["xlsx", "xls"].includes(ext)) {
      const text = extractXlsxText(input.buffer);
      return {
        success: true,
        data: {
          text,
          summary: buildSummary(text),
        },
      };
    }

    return {
      success: false,
      error: {
        code: "UNSUPPORTED_FILE_TYPE",
        message: `暂不支持解析 ${input.fileName}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "EXTRACTION_FAILED",
        message: error instanceof Error ? error.message : `解析 ${input.fileName} 失败`,
      },
    };
  }
}
