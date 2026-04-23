import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getAutomationMock = vi.fn();
const subscribeToAutomationMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/automation.service", () => ({
  getAutomation: getAutomationMock,
}));

vi.mock("@/lib/services/automation-realtime.service", () => ({
  subscribeToAutomation: subscribeToAutomationMock,
}));

describe("api/automations/[id]/realtime route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET({ signal: new AbortController().signal } as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("streams a connected event for an owned automation", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getAutomationMock.mockResolvedValue({
      success: true,
      data: { id: "aut-1", name: "同步作者信息" },
    });
    subscribeToAutomationMock.mockReturnValue(() => undefined);
    const { GET } = await import("./route");
    const controller = new AbortController();

    const response = await GET({ signal: controller.signal } as never, {
      params: Promise.resolve({ id: "aut-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  });
});
