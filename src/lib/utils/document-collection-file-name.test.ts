import { describe, expect, it } from "vitest";
import { buildDocumentCollectionFileName } from "./document-collection-file-name";

describe("buildDocumentCollectionFileName", () => {
  it("替换任务变量和自定义变量", () => {
    const result = buildDocumentCollectionFileName("{前缀}_{姓名}_{序号}", {
      sequence: 3,
      submittedAt: new Date("2026-04-02T10:11:12.000Z"),
      taskTitle: "合同扫描件收集",
      name: "张三",
      email: "zhangsan@example.com",
      originalFileName: "原始文件.docx",
      version: 2,
      taskVariables: {
        前缀: "法务部",
      },
    });

    expect(result).toBe("法务部_张三_3.docx");
  });

  it("替换提交时间 原始文件名 版本号 并避免重复扩展名", () => {
    const result = buildDocumentCollectionFileName("{提交时间}_{原始文件名}_{版本号}.docx", {
      sequence: 1,
      submittedAt: new Date("2026-04-02T10:11:12.000Z"),
      taskTitle: "合同扫描件收集",
      name: "张三",
      email: "zhangsan@example.com",
      originalFileName: "原始文件.DOCX",
      version: 7,
      taskVariables: {},
    });

    expect(result).toMatch(/^20260402_\d{6}_原始文件_7\.docx$/);
  });

  it("清理非法字符并保留 docx 扩展名", () => {
    const result = buildDocumentCollectionFileName("{任务标题}_{姓名}", {
      sequence: 1,
      submittedAt: new Date("2026-04-02T10:11:12.000Z"),
      taskTitle: '合同<>:"/\\|?*收集',
      name: "张/三",
      email: "zhangsan@example.com",
      originalFileName: "原始文件.docx",
      version: 1,
      taskVariables: {},
    });

    expect(result).toBe("合同_________收集_张_三.docx");
  });
});
