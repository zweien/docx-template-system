import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatInput } from "./chat-input";

const fetchMock = vi.fn();

describe("ChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("上传附件后发送应带上附件 id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "att-1",
          fileName: "note.txt",
          mimeType: "text/plain",
          extractStatus: "pending",
        },
      }),
    });

    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByLabelText("上传附件"), {
      target: {
        files: [new File(["hello"], "note.txt", { type: "text/plain" })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("note.txt")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("输入消息，Enter 发送，Shift + Enter 换行"), {
      target: { value: "请分析这个文件" },
    });
    fireEvent.click(screen.getAllByRole("button")[1]);

    expect(onSend).toHaveBeenCalledWith("请分析这个文件", [
      expect.objectContaining({
        id: "att-1",
        fileName: "note.txt",
        mimeType: "text/plain",
        extractStatus: "pending",
      }),
    ]);
  });

  it("待解析附件应轮询并更新状态", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "att-1",
            fileName: "note.txt",
            mimeType: "text/plain",
            extractStatus: "pending",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "att-1",
            fileName: "note.txt",
            extractStatus: "completed",
            extractSummary: "已完成摘要",
          },
        }),
      });

    render(<ChatInput onSend={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("上传附件"), {
      target: {
        files: [new File(["hello"], "note.txt", { type: "text/plain" })],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("pending")).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(screen.getByText("completed")).toBeInTheDocument();
        expect(screen.getByText("已完成摘要")).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
  }, 6000);
});
