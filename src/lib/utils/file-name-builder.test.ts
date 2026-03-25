import { describe, it, expect } from "vitest";
import { buildFileName, generateUniqueFileName, getFieldVariables } from "./file-name-builder";

describe("file-name-builder", () => {
  describe("buildFileName", () => {
    it("should return default name for empty pattern", () => {
      expect(buildFileName("", {})).toBe("document_1.docx");
      expect(buildFileName("   ", {})).toBe("document_1.docx");
    });

    it("should replace {date} variable", () => {
      const result = buildFileName("contract_{date}", {});
      expect(result).toMatch(/^contract_\d{4}-\d{2}-\d{2}$/);
    });

    it("should replace {time} variable", () => {
      const result = buildFileName("file_{time}", {});
      expect(result).toMatch(/^file_\d{6}$/);
    });

    it("should replace {序号} variable", () => {
      expect(buildFileName("doc_{序号}", {}, 1)).toBe("doc_1");
      expect(buildFileName("doc_{序号}", {}, 5)).toBe("doc_5");
    });

    it("should replace {_index} variable", () => {
      expect(buildFileName("doc_{_index}", {}, 3)).toBe("doc_3");
    });

    it("should replace field variables", () => {
      const recordData = { project_name: "智慧城市", person_name: "张三" };
      expect(buildFileName("{project_name}_合同", recordData)).toBe("智慧城市_合同");
      expect(buildFileName("{project_name}_{person_name}", recordData)).toBe("智慧城市_张三");
    });

    it("should keep placeholder for missing field values", () => {
      // Missing fields keep the placeholder in the output
      expect(buildFileName("{missing}_file", {})).toBe("{missing}_file");
    });

    it("should support double brace format", () => {
      expect(buildFileName("{{_index}}", {}, 2)).toBe("2");
    });

    it("should clean illegal characters", () => {
      const result = buildFileName("file<>:\"/\\|?*name", {});
      expect(result).toBe("file_________name");
    });

    it("should truncate long file names", () => {
      const longName = "a".repeat(250);
      const result = buildFileName(longName, {});
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("should combine multiple variables", () => {
      const recordData = { name: "项目" };
      const result = buildFileName("{name}_{date}_{序号}", recordData, 1);
      expect(result).toMatch(/^项目_\d{4}-\d{2}-\d{2}_1$/);
    });
  });

  describe("generateUniqueFileName", () => {
    it("should return original name if not exists", () => {
      const existing = new Set(["file1.docx", "file2.docx"]);
      expect(generateUniqueFileName("file3.docx", existing)).toBe("file3.docx");
    });

    it("should add counter for duplicate names", () => {
      const existing = new Set(["report.docx"]);
      expect(generateUniqueFileName("report.docx", existing)).toBe("report (2).docx");
    });

    it("should increment counter for multiple duplicates", () => {
      const existing = new Set(["report.docx", "report (2).docx", "report (3).docx"]);
      expect(generateUniqueFileName("report.docx", existing)).toBe("report (4).docx");
    });

    it("should handle files without extension", () => {
      const existing = new Set(["README"]);
      expect(generateUniqueFileName("README", existing)).toBe("README (2)");
    });
  });

  describe("getFieldVariables", () => {
    it("should convert fields to variable format", () => {
      const fields = [
        { key: "project_name", label: "项目名称" },
        { key: "budget", label: "预算金额" },
      ];
      const result = getFieldVariables(fields);
      expect(result).toEqual([
        { key: "{project_name}", description: "项目名称" },
        { key: "{budget}", description: "预算金额" },
      ]);
    });

    it("should return empty array for empty input", () => {
      expect(getFieldVariables([])).toEqual([]);
    });
  });
});
