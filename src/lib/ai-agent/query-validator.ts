import type { TableSchema, FilterCondition } from './types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSearchParams(
  schema: TableSchema,
  filter: FilterCondition
): ValidationResult {
  const field = schema.fields.find((f) => f.key === filter.field);
  if (!field) {
    return { valid: false, error: `字段 ${filter.field} 不存在` };
  }

  // 类型检查：数值比较操作符只能用于 NUMBER/DATE 类型
  if (['gt', 'gte', 'lt', 'lte'].includes(filter.operator)) {
    if (field.type !== 'NUMBER' && field.type !== 'DATE') {
      return { valid: false, error: `字段 ${filter.field} 不支持数值比较` };
    }
  }

  return { valid: true };
}

export function validateAggregateParams(
  schema: TableSchema,
  field: string,
  operation: string
): ValidationResult {
  // count 操作不检查字段
  if (operation === 'count') {
    return { valid: true };
  }

  const fieldDef = schema.fields.find((f) => f.key === field);
  if (!fieldDef) {
    return { valid: false, error: `字段 ${field} 不存在` };
  }

  // 聚合操作只能用于 NUMBER/DATE 类型
  if (!['NUMBER', 'DATE'].includes(fieldDef.type)) {
    return { valid: false, error: `字段 ${field} 不支持 ${operation} 操作` };
  }

  return { valid: true };
}