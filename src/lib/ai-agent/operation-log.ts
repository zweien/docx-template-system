import { db } from '@/lib/db';
import type { EditPreview } from './types';

export interface LogOperationParams {
  userId: string;
  userName?: string;
  action: 'create' | 'update' | 'delete';
  tableId: string;
  tableName: string;
  recordId?: string;
  preview: EditPreview;
  status: 'success' | 'failed';
  errorMsg?: string;
}

/**
 * 记录操作日志
 */
export async function logOperation(params: LogOperationParams): Promise<void> {
  await db.aIOperationLog.create({
    data: {
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      tableId: params.tableId,
      tableName: params.tableName,
      recordId: params.recordId,
      changes: params.preview.changes ?? [],
      status: params.status,
      errorMsg: params.errorMsg,
    },
  });
}

/**
 * 获取用户的操作日志
 */
export async function getUserOperationLogs(
  userId: string,
  limit = 50
): Promise<Array<{
  id: string;
  action: string;
  tableName: string;
  recordId?: string;
  status: string;
  createdAt: Date;
}>> {
  const logs = await db.aIOperationLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      tableName: true,
      recordId: true,
      status: true,
      createdAt: true,
    },
  });

  return logs;
}