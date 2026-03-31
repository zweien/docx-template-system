import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = {
  aiAttachment: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

describe("ai-attachment.service getAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应返回指定附件", async () => {
    dbMock.aiAttachment.findUnique.mockResolvedValue({
      id: "att-1",
      fileName: "note.txt",
      extractStatus: "completed",
    });

    const service = await import("./ai-attachment.service");
    const result = await service.getAttachment("att-1");

    expect(result.success).toBe(true);
    expect(dbMock.aiAttachment.findUnique).toHaveBeenCalledWith({
      where: { id: "att-1" },
    });
  });

  it("附件不存在时应返回 NOT_FOUND", async () => {
    dbMock.aiAttachment.findUnique.mockResolvedValue(null);

    const service = await import("./ai-attachment.service");
    const result = await service.getAttachment("missing");

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
