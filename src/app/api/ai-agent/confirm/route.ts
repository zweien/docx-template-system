import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getConfirmOperation, deleteConfirmToken } from '@/lib/ai-agent/confirm-store';
import { logOperation } from '@/lib/ai-agent/operation-log';
import { createRecord as dbCreateRecord, updateRecord as dbUpdateRecord, deleteRecord as dbDeleteRecord } from '@/lib/services/data-record.service';
import { confirmRequestSchema } from '@/validators/ai-agent';

export async function POST(request: NextRequest) {
  const session = await auth();

  // 检查登录
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

  // 检查 ADMIN 权限
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: '仅管理员可执行此操作' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const validated = confirmRequestSchema.parse(body);

    console.log('[CONFIRM] Received confirmToken:', validated.confirmToken);

    // 获取并验证 token
    const operation = getConfirmOperation(validated.confirmToken);
    console.log('[CONFIRM] Operation from store:', operation);

    if (!operation) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: '确认令牌无效或已过期' } },
        { status: 400 }
      );
    }

    // 执行操作
    let result;
    try {
      switch (operation.action) {
        case 'create':
          console.log('[CONFIRM] Creating record with:', { userId: operation.userId, tableId: operation.tableId, data: operation.data });
          // 使用当前确认的管理员ID，而不是token中存储的userId
          result = await dbCreateRecord(
            session.user.id,
            operation.tableId,
            operation.data!
          );
          console.log('[CONFIRM] Create result:', JSON.stringify(result));
          break;
        case 'update':
          console.log('[CONFIRM] Updating record:', { recordId: operation.recordId, data: operation.data });
          result = await dbUpdateRecord(
            operation.recordId!,
            operation.data!
          );
          console.log('[CONFIRM] Update result:', JSON.stringify(result));
          break;
        case 'delete':
          console.log('[CONFIRM] Deleting record:', { recordId: operation.recordId });
          result = await dbDeleteRecord(operation.recordId!);
          console.log('[CONFIRM] Delete result:', JSON.stringify(result));
          break;
        default:
          throw new Error('未知操作类型');
      }
    } catch (dbError) {
      // 记录失败日志（此时 tableName 未知）
      await logOperation({
        userId: session.user.id,
        userName: session.user.name ?? undefined,
        action: operation.action,
        tableId: operation.tableId,
        tableName: '未知',
        recordId: operation.recordId,
        preview: { action: operation.action, tableId: operation.tableId, tableName: '未知' },
        status: 'failed',
        errorMsg: dbError instanceof Error ? dbError.message : '执行失败',
      });

      // 删除 token
      deleteConfirmToken(validated.confirmToken);

      return NextResponse.json(
        { error: { code: 'EXECUTE_FAILED', message: dbError instanceof Error ? dbError.message : '执行失败' } },
        { status: 500 }
      );
    }

    // 获取表名（用于日志）
    const table = await db.dataTable.findUnique({
      where: { id: operation.tableId },
      select: { name: true },
    });
    const tableName = table?.name ?? '未知';

    // 记录成功日志
    await logOperation({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      action: operation.action,
      tableId: operation.tableId,
      tableName,
      recordId: operation.recordId,
      preview: { action: operation.action, tableId: operation.tableId, tableName },
      status: 'success',
    });

    // 删除 token（一次性使用）
    deleteConfirmToken(validated.confirmToken);

    return NextResponse.json({
      success: true,
      result: result.success ? result.data : null,
    });
  } catch (error) {
    console.error('[CONFIRM] Unexpected error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '数据验证失败' } },
        { status: 400 }
      );
    }
    const errorMessage = error instanceof Error ? error.message : '确认执行失败';
    return NextResponse.json(
      { error: { code: 'CONFIRM_FAILED', message: errorMessage } },
      { status: 500 }
    );
  }
}