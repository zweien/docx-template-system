// src/lib/agent2/tools.ts
import { tool } from "ai";
import { z } from "zod";
import * as helpers from "./tool-helpers";
import { fetchPaperByDOI } from "./doi-service";
import { fetchDetailPreview } from "./detail-preview";
import { importPaper as executeImportPaper } from "./paper-import-executor";
import {
  createConfirmToken,
  getRiskMessage,
} from "./confirm-store";

// ── ECharts option generator for generateChart ──

function generateEChartsOption(args: {
  type: "bar" | "line" | "pie" | "scatter" | "table";
  title: string;
  data: { labels: string[]; values: number[] };
  options?: {
    xLabel?: string;
    yLabel?: string;
    color?: string;
  };
}): Record<string, unknown> {
  const { type, title, data, options } = args;
  const color = options?.color;

  const baseOption: Record<string, unknown> = {
    title: { text: title },
    tooltip: {},
  };

  switch (type) {
    case "bar":
      return {
        ...baseOption,
        xAxis: {
          type: "category",
          data: data.labels,
          name: options?.xLabel,
        },
        yAxis: { type: "value", name: options?.yLabel },
        series: [
          {
            type: "bar",
            data: data.values,
            itemStyle: color ? { color } : undefined,
          },
        ],
      };

    case "line":
      return {
        ...baseOption,
        xAxis: {
          type: "category",
          data: data.labels,
          name: options?.xLabel,
        },
        yAxis: { type: "value", name: options?.yLabel },
        series: [
          {
            type: "line",
            data: data.values,
            itemStyle: color ? { color } : undefined,
          },
        ],
      };

    case "pie":
      return {
        ...baseOption,
        series: [
          {
            type: "pie",
            radius: "50%",
            data: data.labels.map((label, i) => ({
              name: label,
              value: data.values[i],
            })),
          },
        ],
      };

    case "scatter":
      return {
        ...baseOption,
        xAxis: { type: "value", name: options?.xLabel },
        yAxis: { type: "value", name: options?.yLabel },
        series: [
          {
            type: "scatter",
            data: data.values.map((v, i) => [i, v]),
            itemStyle: color ? { color } : undefined,
          },
        ],
      };

    case "table":
      return {
        type: "table",
        title,
        columns: data.labels,
        rows: [data.values],
      };

    default:
      return baseOption;
  }
}

// ── Tool factory ──

function readOnlyTool(description: string) {
  return tool({
    description: `${description}（需要管理员权限）`,
    inputSchema: z.object({ message: z.string().optional() }),
    execute: async () => ({
      error: "权限不足",
      message: "当前用户为普通用户，仅支持查询操作。如需修改数据，请联系管理员。",
    }),
  });
}

export function createTools(
  conversationId: string,
  messageId: string,
  userId?: string,
  userRole?: string
) {
  const isAdmin = userRole === "ADMIN";
  // Helper to wrap tools that need confirmation
  function wrapConfirm<T>(
    toolName: string,
    schema: z.ZodType<T>,
    description: string,
    _executeFn: (args: T) => Promise<unknown>
  ) {
    return tool({
      description,
      inputSchema: schema,
      execute: async (args: T) => {
        // Create confirm token
        const tokenResult = await createConfirmToken(
          conversationId,
          messageId,
          toolName,
          args
        );
        if (!tokenResult.success) {
          throw new Error(tokenResult.error.message);
        }

        return {
          _needsConfirm: true,
          token: tokenResult.data,
          toolName,
          toolInput: args,
          riskMessage: getRiskMessage(toolName),
          detailPreview: await fetchDetailPreview(toolName, args),
        };
      },
    });
  }

  return {
    // ── Data table tools (no confirm) ──
    listTables: tool({
      description: "列出所有可访问的数据表",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await helpers.listTables();
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      },
    }),

    getTableSchema: tool({
      description: "获取数据表结构和字段定义",
      inputSchema: z.object({
        tableId: z.string().describe("数据表 ID"),
      }),
      execute: async (args) => {
        const result = await helpers.getTableSchema(args.tableId);
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      },
    }),

    searchRecords: tool({
      description: "查询数据表记录，支持筛选、分页和排序",
      inputSchema: z.object({
        tableId: z.string().describe("数据表 ID"),
        filters: z
          .array(
            z.object({
              field: z.string(),
              operator: z.enum([
                "eq",
                "ne",
                "gt",
                "gte",
                "lt",
                "lte",
                "contains",
                "in",
                "isempty",
                "isnotempty",
              ]),
              value: z.unknown(),
            })
          )
          .optional()
          .describe("筛选条件数组"),
        page: z.number().optional().describe("页码，默认 1"),
        pageSize: z.number().optional().describe("每页条数，默认 10"),
        sortBy: z.string().optional().describe("排序字段"),
        sortOrder: z
          .enum(["asc", "desc"])
          .optional()
          .describe("排序方向，默认 desc"),
      }),
      execute: async (args) => {
        const result = await helpers.searchRecords({
          tableId: args.tableId,
          filters: args.filters?.map((f) => ({
            field: f.field,
            operator: f.operator,
            value: f.value,
          })),
          page: args.page,
          pageSize: args.pageSize,
          sortBy: args.sortBy,
          sortOrder: args.sortOrder,
        });
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      },
    }),

    aggregateRecords: tool({
      description: "对数据表记录进行聚合统计（count/sum/avg/min/max）",
      inputSchema: z.object({
        tableId: z.string().describe("数据表 ID"),
        field: z.string().describe("聚合字段"),
        operation: z
          .enum(["count", "sum", "avg", "min", "max"])
          .describe("聚合操作"),
        filters: z
          .array(
            z.object({
              field: z.string(),
              operator: z.enum([
                "eq",
                "ne",
                "gt",
                "gte",
                "lt",
                "lte",
                "contains",
                "in",
                "isempty",
                "isnotempty",
              ]),
              value: z.unknown(),
            })
          )
          .optional()
          .describe("筛选条件数组"),
      }),
      execute: async (args) => {
        const result = await helpers.aggregateRecords({
          tableId: args.tableId,
          field: args.field,
          operation: args.operation,
          filters: args.filters?.map((f) => ({
            field: f.field,
            operator: f.operator,
            value: f.value,
          })),
        });
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      },
    }),

    // ── Document tools ──
    listTemplates: tool({
      description: "列出所有文档模板",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await helpers.listTemplates();
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      },
    }),

    getTemplateDetail: tool({
      description: "获取模板详情，包含占位符字段列表",
      inputSchema: z.object({
        templateId: z.string().describe("模板 ID"),
      }),
      execute: async (args) => {
        const result = await helpers.getTemplateDetail(args.templateId);
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      },
    }),

    generateDocument: isAdmin ? wrapConfirm(
      "generateDocument",
      z.object({
        templateId: z.string().describe("模板 ID"),
        formData: z
          .record(z.string(), z.unknown())
          .describe("表单数据，key 对应模板占位符"),
      }),
      "根据模板和表单数据生成文档（需要确认）",
      async (args) => {
        return { message: "文档生成功能暂未完全实现", args };
      }
    ) : readOnlyTool("根据模板和表单数据生成文档"),

    // ── Record management tools ──
    getRecord: tool({
      description: "获取单条记录详情",
      inputSchema: z.object({
        recordId: z.string().describe("记录 ID"),
      }),
      execute: async (args) => {
        const result = await helpers.getRecord(args.recordId);
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      },
    }),

    createRecord: isAdmin ? wrapConfirm(
      "createRecord",
      z.object({
        tableId: z.string().describe("目标数据表 ID"),
        data: z
          .record(z.string(), z.unknown())
          .describe("记录数据"),
      }),
      "在数据表中创建新记录（需要确认）",
      async (args) => {
        return { message: "记录创建待确认", args };
      }
    ) : readOnlyTool("在数据表中创建新记录"),

    updateRecord: isAdmin ? wrapConfirm(
      "updateRecord",
      z.object({
        recordId: z.string().describe("要更新的记录 ID"),
        data: z
          .record(z.string(), z.unknown())
          .describe("要更新的字段数据"),
      }),
      "更新已有记录（需要确认）",
      async (args) => {
        return { message: "记录更新待确认", args };
      }
    ) : readOnlyTool("更新已有记录"),

    deleteRecord: isAdmin ? wrapConfirm(
      "deleteRecord",
      z.object({
        recordId: z.string().describe("要删除的记录 ID"),
      }),
      "删除记录（需要确认，不可恢复）",
      async (args) => {
        return { message: "记录删除待确认", args };
      }
    ) : readOnlyTool("删除记录"),

    // ── Batch operation tools ──
    batchCreateRecords: isAdmin ? wrapConfirm(
      "batchCreateRecords",
      z.object({
        tableId: z.string().describe("目标数据表 ID"),
        records: z
          .array(z.record(z.string(), z.unknown()))
          .max(100)
          .describe("要创建的记录数组（最多 100 条，不支持关系子表字段）"),
      }),
      "批量创建记录（需要确认，最多 100 条）",
      async (args) => {
        return { message: "批量创建待确认", args };
      }
    ) : readOnlyTool("批量创建记录"),

    batchUpdateRecords: isAdmin ? wrapConfirm(
      "batchUpdateRecords",
      z.object({
        tableId: z.string().describe("目标数据表 ID"),
        updates: z
          .array(
            z.object({
              recordId: z.string().describe("要更新的记录 ID"),
              data: z
                .record(z.string(), z.unknown())
                .describe("要更新的字段数据"),
            })
          )
          .max(50)
          .describe("要更新的记录数组（最多 50 条）"),
      }),
      "批量更新记录（需要确认，最多 50 条）",
      async (args) => {
        return { message: "批量更新待确认", args };
      }
    ) : readOnlyTool("批量更新记录"),

    batchDeleteRecords: isAdmin ? wrapConfirm(
      "batchDeleteRecords",
      z.object({
        tableId: z.string().describe("目标数据表 ID"),
        recordIds: z
          .array(z.string())
          .max(50)
          .describe("要删除的记录 ID 数组（最多 50 条）"),
      }),
      "批量删除记录（需要确认，不可恢复，最多 50 条）",
      async (args) => {
        return { message: "批量删除待确认", args };
      }
    ) : readOnlyTool("批量删除记录"),

    // ── Auxiliary tools ──
    getCurrentTime: tool({
      description: "获取当前服务器时间和时区信息",
      inputSchema: z.object({}),
      execute: async () => {
        const now = new Date();
        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        return {
          currentTime: now.toISOString(),
          timezone,
          timestamp: now.getTime(),
          localeString: now.toLocaleString("zh-CN", { timeZone: timezone }),
        };
      },
    }),

    executeCode: isAdmin ? wrapConfirm(
      "executeCode",
      z.object({
        language: z
          .enum(["python", "javascript"])
          .describe("代码语言"),
        code: z.string().describe("要执行的代码"),
      }),
      "在沙箱中执行代码（需要确认）",
      async () => {
        return { message: "代码执行功能暂未开放" };
      }
    ) : readOnlyTool("在沙箱中执行代码"),

    generateChart: tool({
      description:
        "根据数据生成图表配置（ECharts），支持 bar/line/pie/scatter/table 类型",
      inputSchema: z.object({
        type: z
          .enum(["bar", "line", "pie", "scatter", "table"])
          .describe("图表类型"),
        title: z.string().describe("图表标题"),
        data: z
          .object({
            labels: z.array(z.string()).describe("标签/类别数组"),
            values: z.array(z.number()).describe("数值数组"),
          })
          .describe("图表数据"),
        options: z
          .object({
            xLabel: z.string().optional().describe("X 轴标签"),
            yLabel: z.string().optional().describe("Y 轴标签"),
            color: z.string().optional().describe("主题色"),
          })
          .optional()
          .describe("图表选项"),
      }),
      execute: async (args) => {
        return generateEChartsOption(args);
      },
    }),

    // ── Paper import tools ──
    parsePaperText: tool({
      description:
        "将用户输入的论文文本解析为结构化的论文元数据。当用户粘贴论文信息（标题、作者、年份等）时使用此工具。返回解析后的字段供用户确认。",
      inputSchema: z.object({
        rawText: z.string().describe("用户粘贴的论文信息原始文本"),
      }),
      execute: async (args) => {
        return {
          message: "请根据以下原始文本提取结构化论文信息，确保字段准确。提取后展示给用户确认。",
          rawText: args.rawText,
          fields: [
            "title_en", "title_cn", "paper_type", "group_name",
            "publish_year", "publish_date", "venue_name", "venue_name_cn",
            "doi", "index_type", "volume", "issue", "pages",
            "ccf_category", "cas_partition", "corr_authors",
          ],
          authorFields: ["name", "author_order", "is_first_author", "is_corresponding_author"],
        };
      },
    }),

    fetchPaperByDOI: tool({
      description:
        "通过 DOI 从 Crossref 学术数据库获取论文元数据。当用户提供 DOI 编号时使用此工具自动获取论文信息。",
      inputSchema: z.object({
        doi: z.string().describe("论文 DOI 编号，如 10.1038/nature14539"),
      }),
      execute: async (args) => {
        const result = await fetchPaperByDOI(args.doi);
        if (!result.success) {
          return { error: result.error };
        }
        return {
          paper: result.data,
          message: "请将以上信息展示给用户确认，并根据需要补充 group_name、index_type 等本地字段。",
        };
      },
    }),

    importPaper: isAdmin ? wrapConfirm(
      "importPaper",
      z.object({
        paperData: z.object({
          title_en: z.string().describe("英文标题"),
          title_cn: z.string().optional().describe("中文标题"),
          paper_type: z.enum(["journal", "conference"]).optional().describe("论文类型"),
          group_name: z.string().optional().describe("组别"),
          publish_year: z.number().optional().describe("发表年份"),
          publish_date: z.string().optional().describe("发表日期"),
          conf_start_date: z.string().optional().describe("会议开始日期"),
          conf_end_date: z.string().optional().describe("会议结束日期"),
          venue_name: z.string().optional().describe("期刊/会议名"),
          venue_name_cn: z.string().optional().describe("期刊/会议中文名"),
          conf_location: z.string().optional().describe("会议地点"),
          doi: z.string().optional().describe("DOI"),
          index_type: z.string().optional().describe("收录类型"),
          pub_status: z.string().optional().describe("刊出状态"),
          archive_status: z.string().optional().describe("归档状态"),
          corr_authors: z.string().optional().describe("通讯作者"),
          inst_rank: z.number().optional().describe("机构排名"),
          fund_no: z.string().optional().describe("基金编号"),
          paper_url: z.string().optional().describe("论文链接"),
          volume: z.string().optional().describe("卷"),
          issue: z.string().optional().describe("期"),
          pages: z.string().optional().describe("页码"),
          impact_factor: z.number().optional().describe("影响因子"),
          issn_isbn: z.string().optional().describe("ISSN/ISBN"),
          ccf_category: z.string().optional().describe("CCF分类"),
          cas_partition: z.string().optional().describe("中科院分区"),
          jcr_partition: z.string().optional().describe("JCR分区"),
          sci_partition: z.string().optional().describe("SCI分区"),
        }).describe("论文元数据"),
        authors: z.array(
          z.object({
            name: z.string().describe("作者姓名"),
            author_order: z.number().describe("作者顺序"),
            is_first_author: z.enum(["Y", "N"]).describe("是否第一作者"),
            is_corresponding_author: z.enum(["Y", "N"]).describe("是否通讯作者"),
          })
        ).describe("作者列表"),
      }),
      "导入论文到论文表（需要确认）",
      async (args) => {
        // auto-confirm 模式下直接执行导入
        if (!userId) throw new Error("用户未登录");
        const result = await executeImportPaper(args.paperData, args.authors, userId);
        if (!result.success) throw new Error(result.error);
        return result.data;
      }
    ) : readOnlyTool("导入论文到论文表"),
  };
}
