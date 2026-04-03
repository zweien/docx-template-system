import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const submitDocumentCollectionVersionMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/services/document-collection-submission.service", () => ({
  submitDocumentCollectionVersion: submitDocumentCollectionVersionMock,
}));

describe("api/collections/[id]/submissions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMultipartRequest(formData: FormData) {
    return {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request;
  }

  function createSubmissionFormData(note?: string) {
    const formData = new FormData();
    formData.set(
      "file",
      new Blob(["hello"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "test.docx"
    );

    if (note) {
      formData.set("note", note);
    }

    return formData;
  }

  it("POST 未登录时应返回 401", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(
      createMultipartRequest(new FormData()) as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("POST 缺少文件时应返回 400", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const { POST } = await import("./route");

    const formData = new FormData();
    formData.set("note", "补充说明");

    const response = await POST(
      createMultipartRequest(formData) as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(400);
    expect(submitDocumentCollectionVersionMock).not.toHaveBeenCalled();
  });

  it("POST 成功时应返回 201", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    submitDocumentCollectionVersionMock.mockResolvedValue({
      success: true,
      data: { id: "version-1" },
    });
    const { POST } = await import("./route");

    const formData = createSubmissionFormData("补充说明");

    const response = await POST(
      createMultipartRequest(formData) as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(submitDocumentCollectionVersionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        userId: "user-1",
        fileName: "test.docx",
        note: "补充说明",
      })
    );
    expect(body.success).toBe(true);
  });

  it("POST service 返回 NOT_FOUND 时应返回 404", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    submitDocumentCollectionVersionMock.mockResolvedValue({
      success: false,
      error: { code: "NOT_FOUND", message: "任务不存在" },
    });
    const { POST } = await import("./route");

    const formData = createSubmissionFormData();

    const response = await POST(
      createMultipartRequest(formData) as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(404);
  });

  it("POST service 返回 TASK_CLOSED 时应返回 409", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    submitDocumentCollectionVersionMock.mockResolvedValue({
      success: false,
      error: { code: "TASK_CLOSED", message: "任务已关闭，无法提交" },
    });
    const { POST } = await import("./route");

    const formData = createSubmissionFormData();

    const response = await POST(
      createMultipartRequest(formData) as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(response.status).toBe(409);
  });

  it("POST service 返回 SUBMIT_FAILED 时应返回 500", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    submitDocumentCollectionVersionMock.mockResolvedValue({
      success: false,
      error: { code: "SUBMIT_FAILED", message: "上传版本失败" },
    });
    const { POST } = await import("./route");

    const formData = createSubmissionFormData();

    const response = await POST(
      createMultipartRequest(formData) as never,
      { params: Promise.resolve({ id: "task-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("SUBMIT_FAILED");
  });
});
