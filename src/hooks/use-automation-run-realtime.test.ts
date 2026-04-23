import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutomationRunRealtime } from "@/hooks/use-automation-run-realtime";

class MockEventSource {
  static instances: MockEventSource[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
}

describe("useAutomationRunRealtime", () => {
  it("creates an EventSource and forwards run update events", () => {
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    const onRunUpdated = vi.fn();

    renderHook(() =>
      useAutomationRunRealtime({
        automationId: "aut-1",
        onRunUpdated,
      })
    );

    const instance = MockEventSource.instances[0];
    instance.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "automation_run_updated",
          automationId: "aut-1",
          run: {
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
        }),
      })
    );

    expect(onRunUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "run-1", status: "RUNNING" })
    );
  });
});
