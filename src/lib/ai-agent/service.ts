import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { buildSystemPrompt, buildTableContext, buildChatContext } from './context-builder';
import { searchRecords, aggregateRecords, getTableSchema, listTables } from './tools';
import type { ChatMessage, FilterCondition, SortConfig } from './types';

// 工具定义（用于 AI SDK）
export const tools = {
  searchRecords: tool({
    description: '搜索数据记录',
    inputSchema: z.object({
      tableId: z.string(),
      filters: z.array(z.object({
        field: z.string(),
        operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
        value: z.unknown(),
      })).optional(),
      pagination: z.object({
        page: z.number(),
        pageSize: z.number(),
      }).optional(),
      sort: z.object({
        field: z.string(),
        direction: z.enum(['asc', 'desc']),
      }).optional(),
    }),
    execute: async ({ tableId, filters, pagination, sort }) => {
      const result = await searchRecords(
        tableId,
        filters as FilterCondition[],
        pagination,
        sort as SortConfig | undefined
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  }),

  aggregateRecords: tool({
    description: '聚合统计',
    inputSchema: z.object({
      tableId: z.string(),
      field: z.string(),
      operation: z.enum(['count', 'sum', 'avg', 'min', 'max']),
      filters: z.array(z.object({
        field: z.string(),
        operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
        value: z.unknown(),
      })).optional(),
    }),
    execute: async ({ tableId, field, operation, filters }) => {
      const result = await aggregateRecords(
        tableId,
        field,
        operation,
        filters as FilterCondition[] | undefined
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  }),

  getTableSchema: tool({
    description: '获取表结构',
    inputSchema: z.object({
      tableId: z.string(),
    }),
    execute: async ({ tableId }) => {
      const result = await getTableSchema(tableId);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  }),

  listTables: tool({
    description: '列出所有可访问的表',
    inputSchema: z.object({}),
    execute: async () => {
      const result = await listTables();
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  }),
};

export interface ChatOptions {
  message: string;
  tableId?: string;
  history?: ChatMessage[];
  model?: string;
  apiKey?: string;
}

export async function* chat(options: ChatOptions): AsyncGenerator<{
  type: string;
  content: string;
  toolName?: string;
  toolArgs?: unknown;
  result?: unknown;
}> {
  const { message, tableId, history = [], model = 'gpt-4o-mini', apiKey } = options;

  if (!apiKey) {
    throw new Error('AI_API_KEY is required');
  }

  // 构建上下文
  const systemPrompt = buildSystemPrompt();
  let contextPrompt = '';

  // 如果指定了表，添加表结构
  if (tableId) {
    const schemaResult = await getTableSchema(tableId);
    if (schemaResult.success) {
      contextPrompt = buildTableContext(schemaResult.data);
    }
  }

  // 添加历史对话
  if (history.length > 0) {
    contextPrompt += '\n## 对话历史\n' + buildChatContext(history);
  }

  // 调用 LLM
  const { text, toolCalls, toolResults } = await generateText({
    model: openai(model),
    system: systemPrompt + (contextPrompt ? '\n\n' + contextPrompt : ''),
    messages: [{ role: 'user', content: message }],
    tools: tools as any,
    stopWhen: stepCountIs(10),
  });

  // 返回工具调用
  for (const call of toolCalls) {
    yield { type: 'tool_call', content: '', toolName: call.toolName, toolArgs: (call as any).input };
  }

  // 返回工具执行结果
  for (const result of toolResults) {
    yield { type: 'result', content: '', result: (result as any).output };
  }

  // 返回最终文本
  if (text) {
    yield { type: 'text', content: text };
  }
}