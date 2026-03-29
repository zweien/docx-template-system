import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildTableContext, buildChatContext } from './context-builder';
import type { TableSchema, ChatMessage } from './types';

describe('buildSystemPrompt', () => {
  it('should include tool descriptions', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('searchRecords');
    expect(prompt).toContain('aggregateRecords');
    expect(prompt).toContain('getTableSchema');
  });
});

describe('buildTableContext', () => {
  it('should format table schema', () => {
    const schema: TableSchema = {
      id: '1',
      name: '客户表',
      fields: [
        { key: 'name', label: '姓名', type: 'TEXT', required: true },
        { key: 'age', label: '年龄', type: 'NUMBER', required: false },
      ],
    };
    const context = buildTableContext(schema);
    expect(context).toContain('客户表');
    expect(context).toContain('name');
    expect(context).toContain('age');
  });
});

describe('buildChatContext', () => {
  it('should format chat history', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: '查询客户表' },
      { role: 'assistant', content: '好的，请问有什么筛选条件？' },
    ];
    const context = buildChatContext(messages);
    expect(context).toContain('用户');
    expect(context).toContain('助手');
  });
});