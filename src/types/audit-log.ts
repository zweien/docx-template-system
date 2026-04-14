import type { AuditAction } from "@/generated/prisma/enums";

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  detail: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogListParams {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: AuditAction;
  targetType?: string;
  startDate?: string;
  endDate?: string;
}
