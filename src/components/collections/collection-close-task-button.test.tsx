import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionCloseTaskButton } from "./collection-close-task-button";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

describe("CollectionCloseTaskButton", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("点击后应调用关闭任务接口并刷新页面", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "task-1", status: "CLOSED" } }),
    } as Response);

    render(<CollectionCloseTaskButton taskId="task-1" />);

    fireEvent.click(screen.getByRole("button", { name: "关闭任务" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/collections/task-1", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "close" }),
      });
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
