import { afterEach, describe, expect, it, vi } from "vitest";

const mkdirMock = vi.fn();
const writeFileMock = vi.fn();
const copyFileMock = vi.fn();
const unlinkMock = vi.fn();
const rmMock = vi.fn();
const existsSyncMock = vi.fn();

vi.mock("fs", () => ({
  existsSync: existsSyncMock,
  default: {
    existsSync: existsSyncMock,
  },
}));

vi.mock("fs/promises", () => ({
  writeFile: writeFileMock,
  mkdir: mkdirMock,
  copyFile: copyFileMock,
  unlink: unlinkMock,
  rm: rmMock,
  default: {
    writeFile: writeFileMock,
    mkdir: mkdirMock,
    copyFile: copyFileMock,
    unlink: unlinkMock,
    rm: rmMock,
  },
}));

describe("file.service collection helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("saveTemplateDraft 应始终保存为 draft.docx 且 copyToVersion 复用草稿文件", async () => {
    existsSyncMock
      .mockReturnValueOnce(false)
      .mockReturnValue(false);
    writeFileMock.mockResolvedValue(undefined);
    copyFileMock.mockResolvedValue(undefined);

    const { saveTemplateDraft, copyToVersion } = await import("./file.service");
    const draft = await saveTemplateDraft(
      "tpl-1",
      Buffer.from("task"),
      "草稿.DOCX"
    );

    expect(draft.fileName).toBe("draft.docx");
    expect(draft.urlPath).toBe("/uploads/templates/tpl-1/draft.docx");

    existsSyncMock.mockReturnValueOnce(true);
    const copiedVersion = await copyToVersion("tpl-1", 2);

    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining("draft.docx"),
      Buffer.from("task")
    );
    expect(copyFileMock).toHaveBeenCalledWith(
      expect.stringContaining("draft.docx"),
      expect.stringContaining("v2.docx")
    );
    expect(copiedVersion.urlPath).toBe("/uploads/templates/tpl-1/v2.docx");
    expect(mkdirMock).toHaveBeenCalled();
  });

  it("collection helpers 应写入非 public 目录，但保留 /uploads/collections 外部路径标识", async () => {
    existsSyncMock
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValue(false);
    writeFileMock.mockResolvedValue(undefined);

    const {
      resolveStoredFilePath,
      saveCollectionTaskAttachment,
      saveCollectionSubmissionFile,
    } = await import("./file.service");

    const taskAttachment = await saveCollectionTaskAttachment(
      Buffer.from("attachment"),
      "参考附件.docx",
      "task-1",
      "att-1"
    );
    const { copyTemplateToDocument } = await import("./file.service");
    const document = await copyTemplateToDocument("/tmp/template.docx", "doc-1.docx", "doc-1");
    const submission = await saveCollectionSubmissionFile(
      Buffer.from("submission"),
      "提交稿.docx",
      "version-1"
    );

    expect(taskAttachment.urlPath).toBe("/uploads/collections/tasks/task-1/att-1.docx");
    expect(document.urlPath).toBe("/uploads/documents/doc-1.docx");
    expect(submission.urlPath).toBe("/uploads/collections/submissions/version-1.docx");
    expect(taskAttachment.filePath).toContain("/.data/uploads/collections/tasks/task-1/att-1.docx");
    expect(submission.filePath).toContain("/.data/uploads/collections/submissions/version-1.docx");
    existsSyncMock.mockImplementation((filePath: string) => filePath.includes("/.data/uploads/collections/"));
    expect(resolveStoredFilePath("/uploads/collections/submissions/version-1.docx")).toContain(
      "/.data/uploads/collections/submissions/version-1.docx"
    );
    expect(resolveStoredFilePath("/tmp/existing-absolute.docx")).toBe("/tmp/existing-absolute.docx");
  });
});
