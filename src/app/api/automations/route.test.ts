import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const listAutomationsMock = vi.fn();
const createAutomationMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/automation.service", () => ({
  listAutomations: listAutomationsMock,
  createAutomation: createAutomationMock,
}));

describe("api/automations route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("GET 应返回当前用户的自动化列表", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    listAutomationsMock.mockResolvedValue({
      success: true,
      data: [{ id: "aut-1", name: "自动化一" }],
    });
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listAutomationsMock).toHaveBeenCalledWith("user-1");
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("POST 应校验请求并创建自动化", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createAutomationMock.mockResolvedValue({
      success: true,
      data: { id: "aut-1", name: "新自动化" },
    });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/automations", {
        method: "POST",
        body: JSON.stringify({
          tableId: "tbl-1",
          name: "新自动化",
          enabled: true,
          triggerType: "manual",
          definition: {
            version: 1,
            canvas: {
              nodes: [{ id: "trigger-1", type: "trigger", x: 0, y: 0 }],
              edges: [],
            },
            trigger: { type: "manual" },
            condition: null,
            thenActions: [],
            elseActions: [],
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createAutomationMock).toHaveBeenCalledWith({
      tableId: "tbl-1",
      userId: "user-1",
      input: {
        name: "新自动化",
        description: undefined,
        enabled: true,
        triggerType: "manual",
        definition: {
          version: 1,
          canvas: {
            nodes: [{ id: "trigger-1", type: "trigger", x: 0, y: 0 }],
            edges: [],
          },
          trigger: { type: "manual" },
          condition: null,
          thenActions: [],
          elseActions: [],
        },
      },
    });
    expect(body.success).toBe(true);
  });

  it("POST 应接受空描述创建自动化", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    createAutomationMock.mockResolvedValue({
      success: true,
      data: { id: "aut-1", name: "新自动化" },
    });
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/automations", {
        method: "POST",
        body: JSON.stringify({
          tableId: "tbl-1",
          name: "新自动化",
          description: null,
          enabled: true,
          triggerType: "manual",
          definition: {
            version: 1,
            canvas: {
              nodes: [{ id: "trigger-1", type: "trigger", x: 0, y: 0 }],
              edges: [],
            },
            trigger: { type: "manual" },
            condition: null,
            thenActions: [],
            elseActions: [],
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }) as never
    );

    expect(response.status).toBe(201);
    expect(createAutomationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ description: null }),
      })
    );
  });
});
