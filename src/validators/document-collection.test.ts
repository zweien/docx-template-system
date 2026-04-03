import { describe, expect, it } from "vitest";
import {
  createDocumentCollectionTaskSchema,
  documentCollectionListQuerySchema,
  submitDocumentCollectionNoteSchema,
} from "./document-collection";

describe("document-collection validators", () => {
  it("校验创建任务 payload", () => {
    const result = createDocumentCollectionTaskSchema.parse({
      title: "合同扫描件收集",
      instruction: "请上传签字盖章后的扫描件",
      dueAt: "2026-04-10T18:00:00.000Z",
      assigneeIds: ["u1", "u2"],
      renameRule: "{前缀}_{姓名}_{序号}",
      renameVariables: { 前缀: "法务部" },
    });

    expect(result.assigneeIds).toEqual(["u1", "u2"]);
    expect(result.renameVariables).toEqual({ 前缀: "法务部" });
  });

  it("renameVariables 应默认为空对象", () => {
    const result = createDocumentCollectionTaskSchema.parse({
      title: "合同扫描件收集",
      instruction: "请上传签字盖章后的扫描件",
      dueAt: "2026-04-10T18:00:00.000Z",
      assigneeIds: ["u1"],
      renameRule: "{姓名}_{序号}",
    });

    expect(result.renameVariables).toEqual({});
  });

  it("应拒绝与保留变量重名的自定义变量", () => {
    expect(() =>
      createDocumentCollectionTaskSchema.parse({
        title: "合同扫描件收集",
        instruction: "请上传签字盖章后的扫描件",
        dueAt: "2026-04-10T18:00:00.000Z",
        assigneeIds: ["u1"],
        renameRule: "{姓名}_{序号}",
        renameVariables: { 姓名: "张三" },
      })
    ).toThrow();
  });

  it("应拒绝 trim 后为空的变量名", () => {
    expect(() =>
      createDocumentCollectionTaskSchema.parse({
        title: "合同扫描件收集",
        instruction: "请上传签字盖章后的扫描件",
        dueAt: "2026-04-10T18:00:00.000Z",
        assigneeIds: ["u1"],
        renameRule: "{姓名}_{序号}",
        renameVariables: { "   ": "法务部" },
      })
    ).toThrow();
  });

  it("应拒绝 trim 后为空的变量值", () => {
    expect(() =>
      createDocumentCollectionTaskSchema.parse({
        title: "合同扫描件收集",
        instruction: "请上传签字盖章后的扫描件",
        dueAt: "2026-04-10T18:00:00.000Z",
        assigneeIds: ["u1"],
        renameRule: "{姓名}_{序号}",
        renameVariables: { 前缀: "   " },
      })
    ).toThrow();
  });

  it("校验列表查询参数", () => {
    const result = documentCollectionListQuerySchema.parse({
      scope: "assigned",
      status: "active",
      search: "张三",
    });

    expect(result).toEqual({
      scope: "assigned",
      status: "active",
      search: "张三",
    });
  });

  it("校验提交备注", () => {
    expect(
      submitDocumentCollectionNoteSchema.parse({
        note: "补充盖章页",
      })
    ).toEqual({
      note: "补充盖章页",
    });
  });
});
