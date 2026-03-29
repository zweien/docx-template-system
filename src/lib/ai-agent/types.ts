// 筛选条件
export interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: string | number | boolean | string[];
}

// 排序配置
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

// 搜索结果
export interface SearchResult {
  records: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

// 聚合结果
export interface AggregateResult {
  value: number;
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max';
}

// 表结构
export interface TableSchema {
  id: string;
  name: string;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
  }>;
}

// 聊天消息
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 服务结果（复用项目现有模式）
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };