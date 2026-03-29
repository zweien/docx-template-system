import { describe, it, expect, beforeEach } from 'vitest';
import { createConfirmToken, getConfirmOperation, deleteConfirmToken, clearAllTokens } from './confirm-store';

describe('confirm-store', () => {
  beforeEach(() => {
    clearAllTokens();
  });

  it('should create and retrieve token', () => {
    const operation = {
      action: 'create' as const,
      tableId: 'table-1',
      data: { name: 'test' },
      userId: 'user-1',
    };

    const token = createConfirmToken(operation);
    expect(token).toBeDefined();

    const retrieved = getConfirmOperation(token);
    expect(retrieved).toMatchObject(operation);
    expect(retrieved?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should return null for invalid token', () => {
    const result = getConfirmOperation('invalid-token');
    expect(result).toBeNull();
  });

  it('should delete token after use', () => {
    const token = createConfirmToken({
      action: 'delete',
      tableId: 'table-1',
      recordId: 'record-1',
      userId: 'user-1',
    });

    const deleted = deleteConfirmToken(token);
    expect(deleted).toBe(true);

    const result = getConfirmOperation(token);
    expect(result).toBeNull();
  });
});