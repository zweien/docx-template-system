import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const updateAutomationMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/automation.service", () => ({
  updateAutomation: updateAutomationMock,
}));

describe("api/automations/[id]/toggle route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { PATCH } = await import("./route");

    const response = await PATCH({} as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("PATCH 应切换启用状态", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    updateAutomationMock.mockResolvedValue({
      success: true,
      data: { id: "aut-1", enabled: false },
    });
    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost/api/automations/aut-1/toggle", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
      { params: Promise.resolve({ id: "aut-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateAutomationMock).toHaveBeenCalledWith("aut-1", "user-1", {
      enabled: false,
    });
    expect(body.success).toBe(true);
  });
});
