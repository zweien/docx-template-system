import { describe, it, expect, vi } from 'vitest';
import { listTables, getTableSchema, searchRecords, aggregateRecords } from './tools';

// Mock db - 使用 any 类型避免类型问题
vi.mock('@/lib/db', () => ({
  db: {
    dataTable: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    dataField: {
      findMany: vi.fn(),
    },
    dataRecord: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('listTables', () => {
  it('should return list of tables', async () => {
    const { db } = await import('@/lib/db');
    (db.dataTable.findMany as any).mockResolvedValue([
      {
        id: '1',
        name: '客户表',
        description: '客户信息',
        icon: 'users',
        _count: { fields: 5, records: 10 },
        createdAt: new Date(),
      }
    ]);

    const result = await listTables();
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('客户表');
    } else {
      throw new Error('Expected success');
    }
  });

  it('should return empty array when no tables', async () => {
    const { db } = await import('@/lib/db');
    (db.dataTable.findMany as any).mockResolvedValue([]);

    const result = await listTables();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  it('should return error on failure', async () => {
    const { db } = await import('@/lib/db');
    (db.dataTable.findMany as any).mockRejectedValue(new Error('DB error'));

    const result = await listTables();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('LIST_FAILED');
    }
  });
});

describe('getTableSchema', () => {
  it('should return table schema', async () => {
    const { db } = await import('@/lib/db');
    (db.dataTable.findUnique as any).mockResolvedValue({
      id: '1',
      name: '客户表',
      description: '客户信息',
      icon: 'users',
      createdAt: new Date(),
      fields: [
        {
          id: 'f1',
          key: 'name',
          label: '姓名',
          type: 'TEXT' as const,
          required: true,
          options: null,
          relationTo: null,
          displayField: null,
          defaultValue: null,
          sortOrder: 0,
        },
      ],
      _count: { records: 10 },
    });

    const result = await getTableSchema('1');
    if (result.success) {
      expect(result.data.name).toBe('客户表');
      expect(result.data.fields).toHaveLength(1);
      expect(result.data.fields[0].key).toBe('name');
    } else {
      throw new Error('Expected success');
    }
  });

  it('should return error if table not found', async () => {
    const { db } = await import('@/lib/db');
    (db.dataTable.findUnique as any).mockResolvedValue(null);

    const result = await getTableSchema('invalid-id');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});

describe('searchRecords', () => {
  it('should return records with pagination', async () => {
    const { db } = await import('@/lib/db');
    // First call: get table
    (db.dataTable.findUnique as any).mockResolvedValue({
      id: '1',
      name: '客户表',
      description: null,
      icon: null,
      createdAt: new Date(),
      fields: [
        {
          id: 'f1',
          key: 'name',
          label: '姓名',
          type: 'TEXT' as const,
          required: true,
          options: null,
          relationTo: null,
          displayField: null,
          defaultValue: null,
          sortOrder: 0,
        },
      ],
      _count: { records: 10 },
    });

    // Second call: findMany for records
    (db.dataRecord.findMany as any).mockResolvedValue([
      {
        id: 'r1',
        tableId: '1',
        data: { name: '张三' },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'u1',
      },
    ]);

    // Third call: count
    vi.mocked(db.dataRecord.count).mockResolvedValue(1);

    const result = await searchRecords('1', [], { page: 1, pageSize: 10 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.records).toHaveLength(1);
      expect(result.data.total).toBe(1);
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(10);
    }
  });

  it('should return error if table not found', async () => {
    const { db } = await import('@/lib/db');
    (db.dataTable.findUnique as any).mockResolvedValue(null);

    const result = await searchRecords('invalid-id', [], { page: 1, pageSize: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});

describe('aggregateRecords', () => {
  it('should return count result', async () => {
    const { db } = await import('@/lib/db');
    // First call: get table
    (db.dataTable.findUnique as any).mockResolvedValue({
      id: '1',
      name: '客户表',
      description: null,
      icon: null,
      createdAt: new Date(),
      fields: [
        {
          id: 'f1',
          key: 'age',
          label: '年龄',
          type: 'NUMBER' as const,
          required: false,
          options: null,
          relationTo: null,
          displayField: null,
          defaultValue: null,
          sortOrder: 0,
        },
      ],
      _count: { records: 10 },
    });

    // Count call
    vi.mocked(db.dataRecord.count).mockResolvedValue(10);

    const result = await aggregateRecords('1', 'age', 'count');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.value).toBe(10);
      expect(result.data.operation).toBe('count');
      expect(result.data.field).toBe('age');
    }
  });

  it('should return error if table not found', async () => {
    const { db } = await import('@/lib/db');
    (db.dataTable.findUnique as any).mockResolvedValue(null);

    const result = await aggregateRecords('invalid-id', 'age', 'count');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});