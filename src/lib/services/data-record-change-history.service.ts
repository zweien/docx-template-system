import { db } from "@/lib/db";
import type { ServiceResult } from "@/types/data-table";

export interface ChangeHistoryEntry {
  id: string;
  recordId: string;
  fieldKey: string;
  fieldLabel: string;
  oldValue: unknown;
  newValue: unknown;
  changedByName: string;
  changedAt: Date;
}

export interface PaginatedChangeHistory {
  entries: ChangeHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getRecordChangeHistory(
  recordId: string,
  options?: {
    page?: number;
    pageSize?: number;
    startDate?: string;
    endDate?: string;
  }
): Promise<ServiceResult<PaginatedChangeHistory>> {
  try {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { recordId };

    if (options?.startDate || options?.endDate) {
      const changedAt: Record<string, Date> = {};
      if (options.startDate) changedAt.gte = new Date(options.startDate);
      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        changedAt.lte = end;
      }
      where.changedAt = changedAt;
    }

    const [rows, total] = await Promise.all([
      db.dataRecordChangeHistory.findMany({
        where,
        orderBy: { changedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          changedBy: { select: { name: true } },
        },
      }),
      db.dataRecordChangeHistory.count({ where }),
    ]);

    const entries: ChangeHistoryEntry[] = rows.map((row) => ({
      id: row.id,
      recordId: row.recordId,
      fieldKey: row.fieldKey,
      fieldLabel: row.fieldLabel,
      oldValue: row.oldValue,
      newValue: row.newValue,
      changedByName: row.changedBy?.name ?? "未知",
      changedAt: row.changedAt,
    }));

    return {
      success: true,
      data: {
        entries,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取变更历史失败";
    return { success: false, error: { code: "HISTORY_FAILED", message } };
  }
}
