import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { buildSystemPrompt, buildTableContext, buildChatContext } from './context-builder';
import { searchRecords, aggregateRecords, getTableSchema, listTables } from './tools';
import type { ChatMessage, FilterCondition, SortConfig } from './types';

// 创建可配置的 OpenAI 客户端
function getOpenAIClient(apiKey?: string, baseURL?: string) {
  const key = apiKey || process.env.AI_API_KEY;
  const baseUrl = baseURL || process.env.AI_BASE_URL;

  if (!key) {
    throw new Error('AI_API_KEY is required');
  }

  return createOpenAI({
    apiKey: key,
    baseURL: baseUrl,
  });
}

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
    execute: async (args) => {
      const { tableId, filters, pagination, sort } = args as {
        tableId: string;
        filters?: FilterCondition[];
        pagination?: { page: number; pageSize: number };
        sort?: SortConfig;
      };
      const result = await searchRecords(tableId, filters, pagination, sort);
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
    execute: async (args) => {
      const { tableId, field, operation, filters } = args as {
        tableId: string;
        field: string;
        operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
        filters?: FilterCondition[];
      };
      const result = await aggregateRecords(tableId, field, operation, filters);
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
    execute: async (args) => {
      const { tableId } = args as { tableId: string };
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
  baseURL?: string;
}

export async function* chat(options: ChatOptions): AsyncGenerator<{
  type: string;
  content: string;
  toolName?: string;
  toolArgs?: unknown;
  result?: unknown;
}> {
  const { message, tableId, history = [], model, apiKey, baseURL } = options;

  // 获取配置
  const apiKeyValue = apiKey || process.env.AI_API_KEY;
  if (!apiKeyValue) {
    throw new Error('AI_API_KEY is required');
  }

  // 默认模型
  const modelName = model || process.env.AI_MODEL || 'gpt-4o-mini';

  const openai = getOpenAIClient(apiKeyValue, baseURL);

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

  // 调用 LLM - 使用 chat 模型 (Chat Completions API)
  const { text, toolCalls, toolResults } = await generateText({
    model: openai.chat(modelName),
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