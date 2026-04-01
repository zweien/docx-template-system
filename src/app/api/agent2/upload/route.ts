import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SUPPORTED_MIME_TYPES = new Set([
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const SUPPORTED_EXTENSIONS = new Set([
  ".csv",
  ".xlsx",
  ".xls",
  ".docx",
  ".txt",
]);

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : "";
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请上传文件" } },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: {
            code: "FILE_TOO_LARGE",
            message: "文件大小不能超过 10MB",
          },
        },
        { status: 400 }
      );
    }

    const ext = getExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.has(ext) && !SUPPORTED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          error: {
            code: "UNSUPPORTED_TYPE",
            message: "不支持的文件类型，仅支持 CSV、Excel、Word、TXT 文件",
          },
        },
        { status: 400 }
      );
    }

    let text = "";
    let fileType = ext.replace(".", "");

    const buffer = Buffer.from(await file.arrayBuffer());

    if (ext === ".csv" || ext === ".xlsx" || ext === ".xls") {
      // Parse spreadsheet files
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName];
        text = XLSX.utils.sheet_to_csv(sheet);
      }
      fileType = ext === ".csv" ? "csv" : "excel";
    } else if (ext === ".docx") {
      // Parse Word documents
      const zip = await JSZip.loadAsync(buffer);
      const docXml = zip.file("word/document.xml");
      if (docXml) {
        const xmlContent = await docXml.async("string");
        // Extract text from XML — strip tags
        text = xmlContent
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      }
      fileType = "docx";
    } else {
      // Plain text
      text = buffer.toString("utf-8");
      fileType = "txt";
    }

    return NextResponse.json({
      success: true,
      data: {
        text,
        fileName: file.name,
        fileType,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "文件解析失败",
        },
      },
      { status: 500 }
    );
  }
}
