import JSZip from "jszip";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { extractTextFromBuffer } from "./extract-text";

describe("extract-text", () => {
  it("应提取 txt 文本", async () => {
    const result = await extractTextFromBuffer({
      fileName: "note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("第一行\n第二行", "utf-8"),
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.text).toContain("第一行");
  });

  it("应提取 markdown 文本", async () => {
    const result = await extractTextFromBuffer({
      fileName: "note.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# 标题\n\n- 列表", "utf-8"),
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.text).toContain("# 标题");
  });

  it("应将 csv 扁平化为文本", async () => {
    const result = await extractTextFromBuffer({
      fileName: "table.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("姓名,部门\n张三,法务", "utf-8"),
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.text).toContain("姓名,部门");
  });

  it("应拒绝不支持的文件类型", async () => {
    const result = await extractTextFromBuffer({
      fileName: "image.png",
      mimeType: "image/png",
      buffer: Buffer.from("png"),
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("应提取 docx 文本", async () => {
    const zip = new JSZip();
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>第一段</w:t></w:r></w:p>
          <w:p><w:r><w:t>第二段</w:t></w:r></w:p>
        </w:body>
      </w:document>`
    );
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const result = await extractTextFromBuffer({
      fileName: "note.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.text).toContain("第一段");
  });

  it("应提取 xlsx 文本", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["姓名", "部门"],
      ["张三", "法务"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const result = await extractTextFromBuffer({
      fileName: "table.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.text).toContain("张三");
  });
});
