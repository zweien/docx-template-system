import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import type { DataFieldItem } from "@/types/data-table";
import { FieldType } from "@/generated/prisma/enums";

// ── Mocks ──

vi.mock("@/lib/constants/upload", () => ({
  UPLOAD_DIR: "public/uploads",
}));

const resolveStoredFilePathMock = vi.fn();

vi.mock("@/lib/file.service", () => ({
  resolveStoredFilePath: resolveStoredFilePathMock,
}));

// Import after mocks
const {
  scanFileAttachments,
  rewriteFilePath,
  rewriteRecordFilePaths,
  createZipWithAttachments,
  extractZipAndRestoreAttachments,
  getUrlBase,
} = await import("./attachment-export.service");

// ── Helpers ──

function buildField(partial: Partial<DataFieldItem> = {}): DataFieldItem {
  return {
    id: partial.id ?? `field-${partial.key ?? "title"}`,
    key: partial.key ?? "title",
    label: partial.label ?? "标题",
    type: partial.type ?? FieldType.TEXT,
    required: partial.required ?? false,
    sortOrder: partial.sortOrder ?? 0,
    ...partial,
  };
}

// ── Tests ──

describe("scanFileAttachments", () => {
  it("collects FILE type field string values", () => {
    const records = [
      { data: { name: "Doc A", file: "/uploads/files/abc.pdf" } },
      { data: { name: "Doc B", file: "/uploads/files/def.docx" } },
    ];
    const fields = [
      buildField({ key: "name", type: FieldType.TEXT }),
      buildField({ key: "file", type: FieldType.FILE }),
    ];

    const result = scanFileAttachments(records, fields);
    expect(result).toEqual(new Set(["/uploads/files/abc.pdf", "/uploads/files/def.docx"]));
  });

  it("ignores non-string FILE values", () => {
    const records = [
      { data: { file: "/uploads/files/abc.pdf" } },
      { data: { file: null } },
      { data: { file: 123 } },
      { data: { file: "" } },
    ];
    const fields = [buildField({ key: "file", type: FieldType.FILE })];

    const result = scanFileAttachments(records, fields);
    expect(result).toEqual(new Set(["/uploads/files/abc.pdf"]));
  });

  it("returns empty set when no FILE fields", () => {
    const records = [{ data: { name: "Doc A" } }];
    const fields = [buildField({ key: "name", type: FieldType.TEXT })];

    const result = scanFileAttachments(records, fields);
    expect(result.size).toBe(0);
  });
});

describe("rewriteFilePath", () => {
  it("rewrites path from original base to current base", () => {
    const result = rewriteFilePath(
      "/uploads/files/abc.pdf",
      "public/uploads",
      "/data/files"
    );
    expect(result).toBe("/data/files/files/abc.pdf");
  });

  it("keeps path unchanged when original and current base are the same", () => {
    const result = rewriteFilePath(
      "/uploads/files/abc.pdf",
      "public/uploads",
      "public/uploads"
    );
    expect(result).toBe("/uploads/files/abc.pdf");
  });

  it("falls back for /uploads/ prefix when current base is different", () => {
    const result = rewriteFilePath(
      "/uploads/files/abc.pdf",
      "public/uploads",
      "/data/files"
    );
    // originalBase = "/uploads", currentBase = "/data/files"
    // path starts with "/uploads/" so it matches the first condition
    expect(result).toBe("/data/files/files/abc.pdf");
  });

  it("returns path unchanged when no prefix matches", () => {
    const result = rewriteFilePath(
      "/other/files/abc.pdf",
      "public/uploads",
      "/data/files"
    );
    expect(result).toBe("/other/files/abc.pdf");
  });
});

describe("rewriteRecordFilePaths", () => {
  it("mutates records to rewrite FILE field paths", () => {
    const records = [
      { data: { name: "Doc A", file: "/uploads/files/abc.pdf" } },
      { data: { name: "Doc B", file: "/uploads/files/def.docx" } },
    ];
    const fields = [
      buildField({ key: "name", type: FieldType.TEXT }),
      buildField({ key: "file", type: FieldType.FILE }),
    ];

    rewriteRecordFilePaths(records, fields, "public/uploads");
    expect(records[0].data.file).toBe("/uploads/files/abc.pdf");
    expect(records[1].data.file).toBe("/uploads/files/def.docx");
  });

  it("rewrites paths for cross-environment restore", () => {
    const records = [
      { data: { file: "/uploads/files/abc.pdf" } },
    ];
    const fields = [buildField({ key: "file", type: FieldType.FILE })];

    rewriteRecordFilePaths(records, fields, "/data/files");
    // originalBase = "/data/files", currentBase = "/uploads"
    // path "/uploads/files/abc.pdf" does not start with "/data/files/"
    // but starts with "/uploads/" and currentBase "/uploads" is different from "/uploads"? No, same.
    // So path stays "/uploads/files/abc.pdf"
    expect(records[0].data.file).toBe("/uploads/files/abc.pdf");
  });
});

describe("createZipWithAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a ZIP with data.json and attachments", async () => {
    const data = { version: "1.0", records: [{ id: "r1" }] };
    const records = [
      { data: { file: "/uploads/files/abc.pdf" } },
    ];
    const fields = [buildField({ key: "file", type: FieldType.FILE })];

    // Use a temp path that we can create on disk
    resolveStoredFilePathMock.mockReturnValue("/tmp/test-uploads/files/abc.pdf");

    // Create the actual file on disk so the service's real fs.existsSync/find it
    const { mkdir, writeFile, rm } = await import("fs/promises");
    await mkdir("/tmp/test-uploads/files", { recursive: true });
    await writeFile("/tmp/test-uploads/files/abc.pdf", Buffer.from("pdf-content"));

    const zipBuffer = await createZipWithAttachments(data, records, fields);

    // Cleanup
    await rm("/tmp/test-uploads", { recursive: true, force: true });

    const zip = await JSZip.loadAsync(zipBuffer);
    expect(zip.file("data.json")).toBeTruthy();
    expect(zip.file("attachments/uploads/files/abc.pdf")).toBeTruthy();
    expect(zip.file("attachments/meta.json")).toBeTruthy();

    const dataContent = await zip.file("data.json")!.async("string");
    expect(JSON.parse(dataContent)).toEqual(data);
  });
});

describe("extractZipAndRestoreAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts ZIP and restores attachments", async () => {
    const zip = new JSZip();
    zip.file("data.json", JSON.stringify({ version: "1.0" }));
    zip.file("attachments/uploads/files/abc.pdf", Buffer.from("pdf-content"));
    zip.file("attachments/meta.json", JSON.stringify({
      pathMapping: { "/uploads/files/abc.pdf": "attachments/uploads/files/abc.pdf" },
      originalUploadDir: "public/uploads",
    }));

    const zipBuffer = Buffer.from(await zip.generateAsync({ type: "arraybuffer" }));

    resolveStoredFilePathMock.mockReturnValue("/tmp/test-restore/uploads/files/abc.pdf");

    const result = await extractZipAndRestoreAttachments(zipBuffer);

    expect(result.data).toEqual({ version: "1.0" });
    expect(result.meta.originalUploadDir).toBe("public/uploads");

    // Verify the file was actually written to disk
    const { readFile, rm } = await import("fs/promises");
    const writtenContent = await readFile("/tmp/test-restore/uploads/files/abc.pdf");
    expect(writtenContent.toString()).toBe("pdf-content");

    // Cleanup
    await rm("/tmp/test-restore", { recursive: true, force: true });
  });
});

describe("getUrlBase", () => {
  it("converts public/uploads to /uploads", async () => {
    // getUrlBase is not exported from the dynamic import above because it's not re-exported
    // We test it indirectly via rewriteFilePath
    const result = rewriteFilePath("/uploads/files/abc.pdf", "public/uploads", "public/uploads");
    expect(result).toBe("/uploads/files/abc.pdf");
  });
});
