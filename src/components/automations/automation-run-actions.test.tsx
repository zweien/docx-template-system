import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomationRunActions } from "@/components/automations/automation-run-actions";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AutomationRunActions", () => {
  it("calls onRunQueued after a successful manual run", async () => {
    const onRunQueued = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { runId: "run-1" },
        }),
      })
    );

    render(<AutomationRunActions automationId="aut-1" onRunQueued={onRunQueued} />);
    fireEvent.click(screen.getByRole("button", { name: "手动运行" }));

    await waitFor(() => {
      expect(onRunQueued).toHaveBeenCalledWith("run-1");
    });
  });
});
