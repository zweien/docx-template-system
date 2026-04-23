import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutomationDetailLive } from "@/components/automations/automation-detail-live";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/automations/automation-run-actions", () => ({
  AutomationRunActions: ({ automationId }: { automationId: string }) => (
    <div data-testid="run-actions">{automationId}</div>
  ),
}));

vi.mock("@/components/automations/automation-run-log", () => ({
  AutomationRunLog: ({
    detailReloadToken,
  }: {
    detailReloadToken?: number;
  }) => <div data-testid="detail-reload-token">{detailReloadToken ?? 0}</div>,
}));

const useAutomationRunRealtimeMock = vi.fn();

vi.mock("@/hooks/use-automation-run-realtime", () => ({
  useAutomationRunRealtime: (options: unknown) => useAutomationRunRealtimeMock(options),
}));

describe("AutomationDetailLive", () => {
  it("increments detail reload token when a step update arrives", () => {
    let onRunStepUpdated:
      | ((event: { runId: string; stepId: string; status: "SUCCEEDED" | "FAILED" }) => void)
      | undefined;

    useAutomationRunRealtimeMock.mockImplementation(
      (options: {
        onRunStepUpdated?: typeof onRunStepUpdated;
      }) => {
        onRunStepUpdated = options.onRunStepUpdated;
        return { isConnected: true };
      }
    );

    render(
      <AutomationDetailLive
        automationId="aut-1"
        initialRuns={[
          {
            id: "run-1",
            automationId: "aut-1",
            status: "RUNNING",
            triggerSource: "MANUAL",
            triggerPayload: {},
            contextSnapshot: {},
            startedAt: "2026-04-23T00:00:00.000Z",
            finishedAt: null,
            durationMs: null,
            errorCode: null,
            errorMessage: null,
            createdAt: "2026-04-23T00:00:00.000Z",
          },
        ]}
      />
    );

    expect(screen.getByTestId("detail-reload-token")).toHaveTextContent("0");
    act(() => {
      onRunStepUpdated?.({ runId: "run-1", stepId: "step-1", status: "SUCCEEDED" });
    });
    expect(screen.getByTestId("detail-reload-token")).toHaveTextContent("1");
  });
});
