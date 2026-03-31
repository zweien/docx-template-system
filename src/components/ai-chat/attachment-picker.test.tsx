import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentPicker } from "./attachment-picker";

const fetchMock = vi.fn();

describe("AttachmentPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("选择文件后应上传并回传附件元数据", async () => {
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

    const onUploaded = vi.fn();
    render(<AttachmentPicker onUploaded={onUploaded} />);

    const input = screen.getByLabelText("上传附件");
    fireEvent.change(input, {
      target: {
        files: [new File(["hello"], "note.txt", { type: "text/plain" })],
      },
    });

    await waitFor(() => {
      expect(onUploaded).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "att-1",
          fileName: "note.txt",
        })
      );
    });
  });

  it("上传接口返回空响应体时不应抛错", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => "",
    });

    const onUploaded = vi.fn();
    render(<AttachmentPicker onUploaded={onUploaded} />);

    const input = screen.getByLabelText("上传附件");
    fireEvent.change(input, {
      target: {
        files: [new File(["hello"], "note.txt", { type: "text/plain" })],
      },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(onUploaded).not.toHaveBeenCalled();
  });
});
