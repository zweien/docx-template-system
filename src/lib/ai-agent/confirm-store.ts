import crypto from 'crypto';
import type { EditOperation } from './types';

// 内存存储：token -> EditOperation
const confirmStore = new Map<string, EditOperation>();

// Token 有效期：30 分钟
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;

/**
 * 生成确认 Token 并存储操作
 */
export function createConfirmToken(operation: Omit<EditOperation, 'expiresAt'>): string {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

  confirmStore.set(token, {
    ...operation,
    expiresAt,
  });

  return token;
}

/**
 * 验证并获取 Token 对应的操作
 * 返回 null 表示 token 无效或已过期
 */
export function getConfirmOperation(token: string): EditOperation | null {
  const operation = confirmStore.get(token);

  if (!operation) {
    return null;
  }

  if (Date.now() > operation.expiresAt) {
    confirmStore.delete(token);
    return null;
  }

  return operation;
}

/**
 * 删除 Token（一次性使用）
 */
export function deleteConfirmToken(token: string): boolean {
  return confirmStore.delete(token);
}

/**
 * 清理过期 Token（定时任务调用）
 */
export function cleanExpiredTokens(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [token, operation] of confirmStore.entries()) {
    if (now > operation.expiresAt) {
      confirmStore.delete(token);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * 清空所有 token（仅用于测试）
 */
export function clearAllTokens(): void {
  confirmStore.clear();
}