import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAttachmentStatusPoller } from "./use-attachment-status-poller";

const fetchMock = vi.fn();

describe("useAttachmentStatusPoller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("应刷新 pending 附件状态", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "att-1",
          fileName: "note.txt",
          extractStatus: "completed",
          extractSummary: "摘要",
        },
      }),
    });

    const { result } = renderHook(() =>
      useAttachmentStatusPoller([
        {
          id: "att-1",
          fileName: "note.txt",
          extractStatus: "pending",
          extractSummary: null,
        },
      ])
    );

    await waitFor(
      () => {
        expect(result.current[0]?.extractStatus).toBe("completed");
        expect(result.current[0]?.extractSummary).toBe("摘要");
      },
      { timeout: 4000 }
    );
  }, 6000);
});
