import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTransportMock, sendMailMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

function setSmtpEnv() {
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "bot@example.com";
  process.env.SMTP_PASS = "secret";
  process.env.SMTP_FROM = "机器人 <bot@example.com>";
  delete process.env.SMTP_SECURE;
}

describe("email.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_SECURE;
    createTransportMock.mockReturnValue({
      sendMail: sendMailMock,
    });
    sendMailMock.mockResolvedValue({
      messageId: "msg-1",
    });
  });

  it("returns configuration error when smtp env is missing", async () => {
    const service = await import("./email.service");
    const result = await service.sendEmail({
      to: "user@example.com",
      subject: "测试",
      text: "正文",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("EMAIL_NOT_CONFIGURED");
    }
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("sends email through configured smtp transport", async () => {
    setSmtpEnv();
    const service = await import("./email.service");
    const result = await service.sendEmail({
      to: "user@example.com",
      subject: "测试主题",
      text: "第一行\n第二行",
    });

    expect(result).toEqual({
      success: true,
      data: { messageId: "msg-1" },
    });
    expect(createTransportMock).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "bot@example.com",
        pass: "secret",
      },
    });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "机器人 <bot@example.com>",
        to: "user@example.com",
        subject: "测试主题",
        text: "第一行\n第二行",
        html: "第一行<br />第二行",
      })
    );
  });
});
