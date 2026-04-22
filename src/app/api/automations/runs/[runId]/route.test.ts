import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getAutomationRunDetailMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/automation-run.service", () => ({
  getAutomationRunDetail: getAutomationRunDetailMock,
}));

describe("api/automations/runs/[runId] route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET({} as never, {
      params: Promise.resolve({ runId: "run-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("GET 应返回运行详情", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getAutomationRunDetailMock.mockResolvedValue({
      success: true,
      data: {
        run: { id: "run-1", status: "FAILED" },
        steps: [{ id: "step-1", status: "FAILED" }],
      },
    });
    const { GET } = await import("./route");

    const response = await GET({} as never, {
      params: Promise.resolve({ runId: "run-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getAutomationRunDetailMock).toHaveBeenCalledWith("run-1", "user-1");
    expect(body.success).toBe(true);
  });
});
