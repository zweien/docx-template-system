import { db } from "@/lib/db";
import type { AuditAction } from "@/generated/prisma/enums";
import type { ServiceResult } from "@/types/data-table";

export interface LogAuditParams {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetName?: string | null;
  detail?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 写入审计日志，失败不影响业务操作
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName ?? null,
        userEmail: params.userEmail ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        targetName: params.targetName ?? null,
        detail: (params.detail ?? undefined) as never,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[AuditLog] Failed to write audit log:", error);
  }
}

export interface ListAuditLogsQuery {
  page: number;
  pageSize: number;
  userId?: string;
  action?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
}

export async function listAuditLogs(
  query: ListAuditLogsQuery
): Promise<
  ServiceResult<{
    items: AuditLogRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>
> {
  try {
    const where: Record<string, unknown> = {};

    if (query.userId) where.userId = { contains: query.userId, mode: "insensitive" };
    if (query.action) where.action = query.action;
    if (query.targetType) where.targetType = query.targetType;

    if (query.startDate || query.endDate) {
      const createdAt: Record<string, Date> = {};
      if (query.startDate) createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        items,
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "LIST_FAILED",
        message: error instanceof Error ? error.message : "获取审计日志失败",
      },
    };
  }
}

interface AuditLogRow {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  detail: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
