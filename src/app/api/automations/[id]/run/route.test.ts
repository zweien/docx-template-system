import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const triggerAutomationManuallyMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/automation-trigger.service", () => ({
  triggerAutomationManually: triggerAutomationManuallyMock,
}));

describe("api/automations/[id]/run route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST({} as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("POST 应手动触发自动化", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    triggerAutomationManuallyMock.mockResolvedValue({
      success: true,
      data: { runId: "run-1" },
    });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/automations/aut-1/run", {
        method: "POST",
        body: JSON.stringify({ recordId: "rec-1", payload: { source: "qa" } }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
      { params: Promise.resolve({ id: "aut-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(triggerAutomationManuallyMock).toHaveBeenCalledWith({
      automationId: "aut-1",
      userId: "user-1",
      recordId: "rec-1",
      payload: { source: "qa" },
    });
    expect(body.success).toBe(true);
  });
});
