// src/lib/agent2/tools.ts
import { tool } from "ai";
import { z } from "zod";
import * as helpers from "./tool-helpers";
import {
  createConfirmToken,
  getRiskMessage,
} from "./confirm-store";

type AutoConfirmMap = Record<string, boolean>;

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

export function createTools(
  conversationId: string,
  messageId: string,
  autoConfirm: AutoConfirmMap
) {
  // Helper to wrap tools that need confirmation
  function wrapConfirm<T>(
    toolName: string,
    category: string,
    schema: z.ZodType<T>,
    description: string,
    executeFn: (args: T) => Promise<unknown>
  ) {
    return tool({
      description,
      inputSchema: schema,
      execute: async (args: T) => {
        // Check auto-confirm for this category
        const isAutoConfirmed = autoConfirm[category] === true;
        if (isAutoConfirmed) {
          return executeFn(args);
        }

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

    generateDocument: wrapConfirm(
      "generateDocument",
      "write",
      z.object({
        templateId: z.string().describe("模板 ID"),
        formData: z
          .record(z.string(), z.unknown())
          .describe("表单数据，key 对应模板占位符"),
      }),
      "根据模板和表单数据生成文档（需要确认）",
      async (args) => {
        // Placeholder: actual generation will be implemented later
        return { message: "文档生成功能暂未完全实现", args };
      }
    ),

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

    createRecord: wrapConfirm(
      "createRecord",
      "write",
      z.object({
        tableId: z.string().describe("目标数据表 ID"),
        data: z
          .record(z.string(), z.unknown())
          .describe("记录数据"),
      }),
      "在数据表中创建新记录（需要确认）",
      async (args) => {
        // When auto-confirmed, we still need userId — this will be handled
        // by the caller (tool-executor) when processing confirmed tokens
        return { message: "记录创建待确认", args };
      }
    ),

    updateRecord: wrapConfirm(
      "updateRecord",
      "write",
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
    ),

    deleteRecord: wrapConfirm(
      "deleteRecord",
      "delete",
      z.object({
        recordId: z.string().describe("要删除的记录 ID"),
      }),
      "删除记录（需要确认，不可恢复）",
      async (args) => {
        return { message: "记录删除待确认", args };
      }
    ),

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

    executeCode: wrapConfirm(
      "executeCode",
      "execute",
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
    ),

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
  };
}
