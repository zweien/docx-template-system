import { describe, expect, it, vi } from "vitest"
import { fetchDetailPreview, formatFieldValue, extractRecordTitle } from "./detail-preview"

// Mock tool-helpers
vi.mock("./tool-helpers", () => ({
  getRecord: vi.fn(),
  getTemplateDetail: vi.fn(),
}))

import { getRecord, getTemplateDetail } from "./tool-helpers"

const mockGetRecord = vi.mocked(getRecord)
const mockGetTemplateDetail = vi.mocked(getTemplateDetail)

describe("formatFieldValue", () => {
  it("字符串直接返回", () => {
    expect(formatFieldValue("hello")).toBe("hello")
  })

  it("数字转字符串", () => {
    expect(formatFieldValue(42)).toBe("42")
  })

  it("null/undefined 返回 -", () => {
    expect(formatFieldValue(null)).toBe("-")
    expect(formatFieldValue(undefined)).toBe("-")
  })

  it("数组用逗号连接", () => {
    expect(formatFieldValue(["a", "b", "c"])).toBe("a, b, c")
  })

  it("对象 JSON 序列化", () => {
    expect(formatFieldValue({ key: "val" })).toBe('{"key":"val"}')
  })
})

describe("extractRecordTitle", () => {
  it("优先使用 title_en", () => {
    expect(extractRecordTitle({ title_en: "Hello", title_cn: "你好", id: "1", tableId: "t1" }))
      .toBe("Hello")
  })

  it("其次使用 title_cn", () => {
    expect(extractRecordTitle({ title_cn: "你好", id: "1", tableId: "t1" }))
      .toBe("你好")
  })

  it("使用第一个非空字符串字段", () => {
    expect(extractRecordTitle({ name: "Alice", age: 30, id: "1", tableId: "t1" }))
      .toBe("Alice")
  })

  it("无可用字段时返回 记录 ID", () => {
    expect(extractRecordTitle({ id: "rec-123", tableId: "t1", age: 30 }))
      .toBe("记录 rec-123")
  })
})

describe("fetchDetailPreview", () => {
  it("deleteRecord 返回记录详情", async () => {
    mockGetRecord.mockResolvedValueOnce({
      success: true,
      data: { id: "r1", tableId: "t1", title_en: "Attention Is All You Need", year: 2017 },
    })

    const result = await fetchDetailPreview("deleteRecord", { recordId: "r1" })

    expect(result).toEqual({
      title: "Attention Is All You Need",
      type: "record",
      fields: expect.arrayContaining([
        { label: "title_en", value: "Attention Is All You Need" },
        { label: "year", value: "2017" },
      ]),
    })
  })

  it("deleteRecord 记录不存在时返回 null", async () => {
    mockGetRecord.mockResolvedValueOnce({
      success: false,
      error: { code: "NOT_FOUND", message: "记录不存在" },
    })

    const result = await fetchDetailPreview("deleteRecord", { recordId: "bad-id" })
    expect(result).toBeNull()
  })

  it("importPaper 返回论文详情", async () => {
    const result = await fetchDetailPreview("importPaper", {
      paperData: { title_en: "Test Paper", title_cn: "测试论文", publish_year: 2024, venue_name: "ICML", doi: "10.1234/test" },
      authors: [
        { name: "Alice", author_order: 1, is_first_author: "Y", is_corresponding_author: "N" },
        { name: "Bob", author_order: 2, is_first_author: "N", is_corresponding_author: "Y" },
      ],
    })

    expect(result).toEqual({
      title: "论文: Test Paper",
      type: "paper",
      fields: [
        { label: "英文标题", value: "Test Paper" },
        { label: "中文标题", value: "测试论文" },
        { label: "年份", value: "2024" },
        { label: "期刊/会议", value: "ICML" },
        { label: "DOI", value: "10.1234/test" },
      ],
      summary: "共 2 位作者: Alice, Bob",
    })
  })

  it("generateDocument 返回模板详情", async () => {
    mockGetTemplateDetail.mockResolvedValueOnce({
      success: true,
      data: {
        id: "tpl1",
        name: "论文报告",
        description: null,
        status: "PUBLISHED",
        placeholders: [
          { id: "p1", key: "title", label: "标题", inputType: "text", required: true, defaultValue: null },
        ],
      },
    })

    const result = await fetchDetailPreview("generateDocument", {
      templateId: "tpl1",
      formData: { title: "My Paper" },
    })

    expect(result).toEqual({
      title: "模板: 论文报告",
      type: "template",
      fields: [{ label: "title", value: "My Paper" }],
    })
  })

  it("batchDeleteRecords 返回批量预览（限制 10 条）", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `r${i}`)
    for (let i = 0; i < 10; i++) {
      mockGetRecord.mockResolvedValueOnce({
        success: true,
        data: { id: `r${i}`, tableId: "t1", title_en: `Paper ${i}` },
      })
    }

    const result = await fetchDetailPreview("batchDeleteRecords", { recordIds: ids })

    expect(result?.recordCount).toBe(12)
    expect(result?.items).toHaveLength(10)
    expect(result?.title).toBe("批量操作 12 条记录")
  })

  it("未知工具返回 null", async () => {
    const result = await fetchDetailPreview("unknownTool", {})
    expect(result).toBeNull()
  })

  it("异常时返回 null", async () => {
    mockGetRecord.mockRejectedValueOnce(new Error("DB error"))
    const result = await fetchDetailPreview("deleteRecord", { recordId: "r1" })
    expect(result).toBeNull()
  })
})
