import { describe, it, expect } from 'vitest';
import { createRecordPreview, updateRecordPreview, deleteRecordPreview } from '@/lib/ai-agent/tools';

describe('edit tools', () => {
  // 注意：这些函数需要数据库连接，在集成测试中验证

  it('should export createRecordPreview function', () => {
    expect(createRecordPreview).toBeDefined();
    expect(typeof createRecordPreview).toBe('function');
  });

  it('should export updateRecordPreview function', () => {
    expect(updateRecordPreview).toBeDefined();
    expect(typeof updateRecordPreview).toBe('function');
  });

  it('should export deleteRecordPreview function', () => {
    expect(deleteRecordPreview).toBeDefined();
    expect(typeof deleteRecordPreview).toBe('function');
  });
});