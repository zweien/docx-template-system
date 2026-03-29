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

// ========== 编辑类型定义 ==========

// 编辑预览
export interface EditPreview {
  action: 'create' | 'update' | 'delete';
  tableId: string;
  tableName: string;
  // create: 展示新增字段及其值 from: null, to: value
  // update: 展示变更字段 from: 旧值, to: 新值
  // delete: 变更列表为空，通过 recordCount 或 recordId 标识
  changes?: Array<{ field: string; from: unknown; to: unknown }>;
  recordId?: string;
  recordCount?: number;
}

// 编辑操作数据（存储在 token 中）
export interface EditOperation {
  action: 'create' | 'update' | 'delete';
  tableId: string;
  recordId?: string;
  data?: Record<string, unknown>;
  userId: string;
  expiresAt: number;
}