import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const listAutomationRunsMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/automation-run.service", () => ({
  listAutomationRuns: listAutomationRunsMock,
}));

describe("api/automations/[id]/runs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET({} as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("GET 应返回自动化运行记录", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listAutomationRunsMock.mockResolvedValue({
      success: true,
      data: [{ id: "run-1", status: "SUCCEEDED" }],
    });
    const { GET } = await import("./route");

    const response = await GET({} as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listAutomationRunsMock).toHaveBeenCalledWith("aut-1", "user-1");
    expect(body.success).toBe(true);
  });
});
