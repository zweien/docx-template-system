// src/lib/agent2/detail-preview.ts
import * as helpers from "./tool-helpers"

export interface DetailPreview {
  title: string
  type: "record" | "paper" | "template" | "code" | "generic"
  fields?: Array<{ label: string; value: string }>
  summary?: string
  recordCount?: number
  items?: Array<{ id: string; label: string }>
}

/** 格式化字段值为可读字符串 */
export function formatFieldValue(value: unknown): string {
  if (value == null) return "-"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ")
  return JSON.stringify(value)
}

/** 从记录数据中提取可读标题 */
export function extractRecordTitle(data: Record<string, unknown>): string {
  // 优先使用常见标题字段
  for (const key of ["title_en", "title_cn", "name", "title"]) {
    const val = data[key]
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  // 使用第一个非空字符串字段
  for (const [key, val] of Object.entries(data)) {
    if (key === "id" || key === "tableId") continue
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  return `记录 ${data.id ?? "未知"}`
}

/**
 * 根据工具名和参数预取操作对象详情。
 * 失败时返回 null，不影响确认流程。
 */
export async function fetchDetailPreview(
  toolName: string,
  args: unknown
): Promise<DetailPreview | null> {
  try {
    const input = args as Record<string, unknown>

    switch (toolName) {
      case "deleteRecord":
      case "updateRecord": {
        const result = await helpers.getRecord(input.recordId as string)
        if (!result.success) return null
        const data = result.data as Record<string, unknown>
        return {
          title: extractRecordTitle(data),
          type: "record",
          fields: Object.entries(data)
            .filter(([k]) => k !== "id" && k !== "tableId")
            .filter(([_, v]) => v != null && v !== "")
            .map(([key, value]) => ({
              label: key,
              value: formatFieldValue(value),
            })),
        }
      }

      case "importPaper": {
        const paperData = input.paperData as Record<string, unknown>
        const authors = input.authors as Array<Record<string, unknown>>
        return {
          title: `论文: ${(paperData.title_en as string) || (paperData.title_cn as string) || "未知"}`,
          type: "paper",
          fields: [
            { label: "英文标题", value: (paperData.title_en as string) || "-" },
            { label: "中文标题", value: (paperData.title_cn as string) || "-" },
            { label: "年份", value: paperData.publish_year ? String(paperData.publish_year) : "-" },
            { label: "期刊/会议", value: (paperData.venue_name as string) || "-" },
            { label: "DOI", value: (paperData.doi as string) || "-" },
          ].filter((f) => f.value !== "-"),
          summary: `共 ${authors.length} 位作者: ${authors.map((a) => a.name).join(", ")}`,
        }
      }

      case "generateDocument": {
        const result = await helpers.getTemplateDetail(input.templateId as string)
        if (!result.success) return null
        const formData = input.formData as Record<string, unknown>
        return {
          title: `模板: ${result.data.name}`,
          type: "template",
          fields: result.data.placeholders.map((p) => ({
            label: p.key,
            value: formatFieldValue(formData?.[p.key]) || "(空)",
          })),
        }
      }

      case "batchDeleteRecords":
      case "batchUpdateRecords": {
        const ids = (
          toolName === "batchDeleteRecords"
            ? input.recordIds
            : (input.updates as Array<{ recordId: string }>)?.map((u) => u.recordId)
        ) as string[]
        if (!ids || ids.length === 0) return null

        const previews = await Promise.all(
          ids.slice(0, 10).map(async (id) => {
            const result = await helpers.getRecord(id)
            return {
              id,
              label: result.success ? extractRecordTitle(result.data as Record<string, unknown>) : id,
            }
          })
        )
        return {
          title: `批量操作 ${ids.length} 条记录`,
          type: "record",
          recordCount: ids.length,
          items: previews,
        }
      }

      default:
        return null
    }
  } catch {
    return null
  }
}
