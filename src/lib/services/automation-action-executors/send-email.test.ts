import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeSendEmailAction } from "@/lib/services/automation-action-executors/send-email";

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}));

vi.mock("@/lib/services/email.service", () => ({
  sendEmail: sendEmailMock,
}));

describe("executeSendEmailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders record context into email fields", async () => {
    sendEmailMock.mockResolvedValue({
      success: true,
      data: { messageId: "msg-1" },
    });

    const result = await executeSendEmailAction({
      action: {
        id: "a1",
        type: "send_email",
        to: "{{ actor.email }}",
        subject: "论文 {{ record.title }} 已进入审批",
        body: "当前状态：{{ record.status }}",
      },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        recordId: "rec_1",
        record: {
          title: "论文 A",
          status: "reviewing",
        },
        previousRecord: null,
        changedFields: ["status"],
        triggerSource: "EVENT",
        triggeredAt: "2026-04-23T10:00:00.000Z",
        actor: {
          id: "usr_1",
          email: "reviewer@example.com",
        },
      },
      runId: "run_1",
    });

    expect(result.success).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "reviewer@example.com",
      subject: "论文 论文 A 已进入审批",
      text: "当前状态：reviewing",
    });
  });

  it("fails when rendered recipient is empty", async () => {
    const result = await executeSendEmailAction({
      action: {
        id: "a1",
        type: "send_email",
        to: "{{ actor.email }}",
        subject: "测试",
        body: "正文",
      },
      context: {
        automationId: "aut_1",
        tableId: "tbl_1",
        record: null,
        previousRecord: null,
        changedFields: [],
        triggerSource: "MANUAL",
        triggeredAt: "2026-04-23T10:00:00.000Z",
        actor: null,
      },
      runId: "run_1",
    });

    expect(result.success).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
