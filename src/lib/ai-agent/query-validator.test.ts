import { describe, it, expect } from 'vitest';
import { validateSearchParams, validateAggregateParams } from './query-validator';
import type { TableSchema, FilterCondition } from './types';

describe('validateSearchParams', () => {
  const schema: TableSchema = {
    id: '1',
    name: '测试表',
    fields: [
      { key: 'name', label: '姓名', type: 'TEXT', required: true },
      { key: 'age', label: '年龄', type: 'NUMBER', required: false },
      { key: 'birthday', label: '生日', type: 'DATE', required: false },
    ],
  };

  it('should reject invalid field', () => {
    const filter: FilterCondition = { field: 'invalid', operator: 'eq', value: 'test' };
    const result = validateSearchParams(schema, filter);
    expect(result.valid).toBe(false);
  });

  it('should accept valid field', () => {
    const filter: FilterCondition = { field: 'name', operator: 'eq', value: 'test' };
    const result = validateSearchParams(schema, filter);
    expect(result.valid).toBe(true);
  });

  it('should reject numeric operator on TEXT field', () => {
    const filter: FilterCondition = { field: 'name', operator: 'gt', value: 100 };
    const result = validateSearchParams(schema, filter);
    expect(result.valid).toBe(false);
  });

  it('should accept numeric operator on NUMBER field', () => {
    const filter: FilterCondition = { field: 'age', operator: 'gt', value: 18 };
    const result = validateSearchParams(schema, filter);
    expect(result.valid).toBe(true);
  });
});

describe('validateAggregateParams', () => {
  const schema: TableSchema = {
    id: '1',
    name: '测试表',
    fields: [
      { key: 'name', label: '姓名', type: 'TEXT', required: true },
      { key: 'age', label: '年龄', type: 'NUMBER', required: false },
    ],
  };

  it('should accept count operation', () => {
    const result = validateAggregateParams(schema, 'any', 'count');
    expect(result.valid).toBe(true);
  });

  it('should reject aggregate on TEXT field', () => {
    const result = validateAggregateParams(schema, 'name', 'sum');
    expect(result.valid).toBe(false);
  });

  it('should accept aggregate on NUMBER field', () => {
    const result = validateAggregateParams(schema, 'age', 'sum');
    expect(result.valid).toBe(true);
  });
});