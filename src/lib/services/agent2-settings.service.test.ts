import { beforeEach, describe, expect, it, vi } from "vitest"

const upsertMock = vi.fn()
const updateMock = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    agent2UserSettings: {
      upsert: upsertMock,
      update: updateMock,
    },
  },
}))

describe("agent2-settings.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.AI_MODEL = "MiniMax-M2.5"
  })

  it("读取设置时不应重写用户显式选择的 gpt-4o", async () => {
    upsertMock.mockResolvedValue({
      id: "settings-1",
      userId: "user-1",
      autoConfirmTools: {},
      defaultModel: "gpt-4o",
      showReasoning: true,
      createdAt: new Date("2026-04-02T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
    })

    const { getSettings } = await import("./agent2-settings.service")
    const result = await getSettings("user-1")

    expect(result.success).toBe(true)
    if (!result.success) {
      throw new Error("Expected success")
    }
    expect(result.data.defaultModel).toBe("gpt-4o")
    expect(updateMock).not.toHaveBeenCalled()
  })
})
