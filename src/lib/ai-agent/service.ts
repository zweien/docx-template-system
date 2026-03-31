import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { createOpenAI } from '@ai-sdk/openai';
import { buildSystemPrompt, buildTableContext } from './context-builder';
import { searchRecords, aggregateRecords, getTableSchema, listTables, getCurrentTime, createRecordPreview, updateRecordPreview, deleteRecordPreview } from './tools';
import type { ChatMessage, FilterCondition, SortConfig } from './types';

type StreamTextOptions = Parameters<typeof streamText>[0];

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

  getCurrentTime: tool({
    description: '获取当前服务器时间和时区信息',
    inputSchema: z.object({}),
    execute: async () => {
      const result = await getCurrentTime();
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  }),

  // 编辑工具（需要管理员确认）
  createRecord: tool({
    description: '创建数据记录（需要管理员确认）',
    inputSchema: z.object({
      tableId: z.string().min(1, '表ID不能为空'),
      data: z.record(z.string(), z.unknown()),
    }),
    execute: async (args) => {
      const { tableId, data } = args as {
        tableId: string;
        data: Record<string, unknown>;
      };
      // 使用占位符 userId，确认执行时会使用当前登录用户的信息
      const { preview, confirmToken } = await createRecordPreview(tableId, data, 'ai-agent');
      return {
        preview,
        confirmToken,
        message: `准备创建记录，确认码: ${confirmToken.substring(0, 8)}...`,
      };
    },
  }),

  updateRecord: tool({
    description: '更新数据记录（需要管理员确认）',
    inputSchema: z.object({
      tableId: z.string().min(1, '表ID不能为空'),
      recordId: z.string().min(1, '记录ID不能为空'),
      data: z.record(z.string(), z.unknown()),
    }),
    execute: async (args) => {
      const { tableId, recordId, data } = args as {
        tableId: string;
        recordId: string;
        data: Record<string, unknown>;
      };
      const { preview, confirmToken } = await updateRecordPreview(tableId, recordId, data, 'ai-agent');
      return {
        preview,
        confirmToken,
        message: `准备更新记录，确认码: ${confirmToken.substring(0, 8)}...`,
      };
    },
  }),

  deleteRecord: tool({
    description: '删除数据记录（需要管理员确认）',
    inputSchema: z.object({
      tableId: z.string().min(1, '表ID不能为空'),
      recordId: z.string().min(1, '记录ID不能为空'),
    }),
    execute: async (args) => {
      const { tableId, recordId } = args as {
        tableId: string;
        recordId: string;
      };
      const { preview, confirmToken } = await deleteRecordPreview(tableId, recordId, 'ai-agent');
      return {
        preview,
        confirmToken,
        message: `准备删除记录，确认码: ${confirmToken.substring(0, 8)}...`,
      };
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

export function sanitizeModelText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function getPartialTagLength(text: string, tag: string) {
  const normalizedText = text.toLowerCase();
  const normalizedTag = tag.toLowerCase();
  const maxLength = Math.min(normalizedText.length, normalizedTag.length - 1);

  for (let length = maxLength; length > 0; length -= 1) {
    if (normalizedText.endsWith(normalizedTag.slice(0, length))) {
      return length;
    }
  }

  return 0;
}

export function createThinkTagStreamSanitizer() {
  let pending = '';
  let inThink = false;

  return {
    push(chunk: string) {
      pending += chunk;
      let output = '';

      while (pending) {
        const lower = pending.toLowerCase();

        if (inThink) {
          const endIndex = lower.indexOf('</think>');
          if (endIndex === -1) {
            const keepLength = getPartialTagLength(pending, '</think>');
            pending = keepLength > 0 ? pending.slice(-keepLength) : '';
            break;
          }

          pending = pending.slice(endIndex + '</think>'.length);
          inThink = false;
          continue;
        }

        const startIndex = lower.indexOf('<think>');
        if (startIndex !== -1) {
          output += pending.slice(0, startIndex);
          pending = pending.slice(startIndex + '<think>'.length);
          inThink = true;
          continue;
        }

        const keepLength = getPartialTagLength(pending, '<think>');
        output += pending.slice(0, pending.length - keepLength);
        pending = pending.slice(pending.length - keepLength);
        break;
      }

      return output;
    },
    flush() {
      if (inThink) {
        pending = '';
        return '';
      }

      const output = pending;
      pending = '';
      return output;
    },
  };
}

export async function* chat(options: ChatOptions): AsyncGenerator<{
  type: string;
  content: string;
  toolName?: string;
  toolArgs?: unknown;
  result?: unknown;
  confirmToken?: string;
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

  // 历史消息只通过 messages 数组传递，避免重复
  // 构建消息数组（包含历史消息 + 当前消息）
  const messagesForLLM = [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  // 调用 LLM - 使用 chat 模型 (Chat Completions API)
  const result = streamText({
    model: openai.chat(modelName),
    system: systemPrompt + (contextPrompt ? '\n\n' + contextPrompt : ''),
    messages: messagesForLLM,
    tools: tools as StreamTextOptions['tools'],
    stopWhen: stepCountIs(10),
  });
  const sanitizer = createThinkTagStreamSanitizer();

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      const sanitizedDelta = sanitizer.push(part.text);
      if (sanitizedDelta) {
        yield { type: 'text', content: sanitizedDelta };
      }
      continue;
    }

    if (part.type === 'tool-call') {
      yield {
        type: 'tool_call',
        content: '',
        toolName: part.toolName,
        toolArgs: part.input,
      };
      continue;
    }

    if (part.type === 'tool-result') {
      const output = part.output;
      if (output?.confirmToken) {
        yield {
          type: 'confirm',
          content: output.preview ?? output.message ?? '请确认执行此操作',
          result: output,
          confirmToken: output.confirmToken,
        };
        continue;
      }

      yield { type: 'result', content: '', result: output };
      continue;
    }

    if (part.type === 'error') {
      throw (part.error instanceof Error ? part.error : new Error('流式输出失败'));
    }
  }

  const remainingText = sanitizer.flush();
  if (remainingText) {
    yield { type: 'text', content: remainingText };
  }
}
