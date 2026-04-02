import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildAttachmentMessageText,
  uploadAgent2Files,
} from "./file-attachments"

const fetchMock = vi.fn()

describe("file-attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  it("应上传附件并返回提取结果", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["name,amount"], { type: "text/csv" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            text: "name,amount",
            fileName: "sales.csv",
            fileType: "csv",
          },
        }),
      })

    const result = await uploadAgent2Files([
      {
        type: "file",
        filename: "sales.csv",
        mediaType: "text/csv",
        url: "blob:mock-sales",
      },
    ])

    expect(fetchMock).toHaveBeenNthCalledWith(1, "blob:mock-sales")
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/agent2/upload",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    )
    expect(result).toEqual([
      {
        text: "name,amount",
        fileName: "sales.csv",
        fileType: "csv",
      },
    ])
  })

  it("应把附件提取内容拼接进消息上下文", () => {
    expect(
      buildAttachmentMessageText("请总结这份表格", [
        {
          text: "name,amount\nAlice,100",
          fileName: "sales.csv",
          fileType: "csv",
        },
      ])
    ).toContain("## 当前消息附件内容")
  })
})
