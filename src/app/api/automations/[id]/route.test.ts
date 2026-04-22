import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getAutomationMock = vi.fn();
const updateAutomationMock = vi.fn();
const deleteAutomationMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/automation.service", () => ({
  getAutomation: getAutomationMock,
  updateAutomation: updateAutomationMock,
  deleteAutomation: deleteAutomationMock,
}));

describe("api/automations/[id] route", () => {
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

  it("PATCH 应更新自动化", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    updateAutomationMock.mockResolvedValue({
      success: true,
      data: { id: "aut-1", name: "已更新" },
    });
    const { PATCH } = await import("./route");

    const response = await PATCH(
      new Request("http://localhost/api/automations/aut-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "已更新", enabled: false }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never,
      { params: Promise.resolve({ id: "aut-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateAutomationMock).toHaveBeenCalledWith("aut-1", "user-1", {
      name: "已更新",
      enabled: false,
    });
    expect(body.success).toBe(true);
  });

  it("DELETE 找不到资源时应返回 404", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    deleteAutomationMock.mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "自动化不存在" },
    });
    const { DELETE } = await import("./route");

    const response = await DELETE({} as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("GET 应返回自动化详情", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getAutomationMock.mockResolvedValue({
      success: true,
      data: { id: "aut-1", name: "自动化一" },
    });
    const { GET } = await import("./route");

    const response = await GET({} as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getAutomationMock).toHaveBeenCalledWith("aut-1", "user-1");
    expect(body.success).toBe(true);
  });
});
