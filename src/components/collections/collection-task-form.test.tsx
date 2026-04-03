import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionTaskForm } from "./collection-task-form";

describe("CollectionTaskForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("应通过命名规则编辑器插入变量并更新预览", () => {
    render(
      <CollectionTaskForm
        assigneeOptions={[
          { id: "user-1", name: "张三", email: "zhangsan@example.com" },
          { id: "user-2", name: "李四", email: "lisi@example.com" },
        ]}
        onCreated={vi.fn()}
      />
    );

    const renameRuleInput = screen.getByLabelText("文件命名规则");
    fireEvent.change(renameRuleInput, { target: { value: "归档_" } });
    fireEvent.click(screen.getByRole("button", { name: "插入变量 任务标题" }));
    fireEvent.click(screen.getByRole("button", { name: "插入变量 姓名" }));

    expect(renameRuleInput).toHaveValue("归档_{任务标题}{姓名}");
    expect(screen.getByText("预览：归档_营业执照收集张三.docx")).toBeInTheDocument();
  });

  it("提交时应把附件写入 FormData", async () => {
    const onCreated = vi.fn();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: "task-1" },
      }),
    } as Response);

    render(
      <CollectionTaskForm
        assigneeOptions={[{ id: "user-1", name: "张三", email: "zhangsan@example.com" }]}
        onCreated={onCreated}
      />
    );

    fireEvent.change(screen.getByLabelText("任务标题"), {
      target: { value: "季度资料收集" },
    });
    fireEvent.change(screen.getByLabelText("提交说明"), {
      target: { value: "请上传文档" },
    });
    fireEvent.click(screen.getByText("张三"));

    const fileInput = document.querySelector("input[type=\"file\"]") as HTMLInputElement;
    const attachment = new File(["hello"], "说明.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, {
      target: { files: [attachment] },
    });

    fireEvent.submit(screen.getByRole("button", { name: "创建任务" }).closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, requestInit] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/collections");
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.body).toBeInstanceOf(FormData);

    const formData = requestInit?.body as FormData;
    const files = formData.getAll("attachments");
    expect(files).toHaveLength(1);
    expect(files[0]).toBe(attachment);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("task-1"));
  });
});
