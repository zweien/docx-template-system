import { db } from "@/lib/db";
import { createRecord } from "./data-record.service";
import { logAudit } from "./audit-log.service";
import type { FormShareTokenItem, FormViewOptions, ServiceResult } from "@/types/data-table";

// Fields not shown on public forms
const EXCLUDED_PUBLIC_FIELD_TYPES = new Set([
  "RELATION",
  "RELATION_SUBTABLE",
  "SYSTEM_TIMESTAMP",
  "SYSTEM_USER",
  "AUTO_NUMBER",
  "FORMULA",
]);

function mapTokenItem(row: {
  id: string;
  token: string;
  viewId: string;
  label: string | null;
  isActive: boolean;
  createdAt: Date;
  expiresAt: Date | null;
  submissionCount: number;
}): FormShareTokenItem {
  return {
    id: row.id,
    token: row.token,
    viewId: row.viewId,
    label: row.label,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    submissionCount: row.submissionCount,
  };
}

// ── Share Token CRUD ──

export async function createShareToken(
  viewId: string,
  userId: string,
  userName?: string | null,
  options?: { label?: string; expiresAt?: string }
): Promise<ServiceResult<FormShareTokenItem>> {
  const token = await db.formShareToken.create({
    data: {
      viewId,
      createdById: userId,
      label: options?.label ?? null,
      expiresAt: options?.expiresAt ? new Date(options.expiresAt) : null,
    },
  });

  // Audit log
  await logAudit({
    userId,
    userName,
    action: "FORM_SHARE_CREATE",
    targetType: "FormShareToken",
    targetId: token.id,
    targetName: options?.label ?? null,
    detail: { viewId, token: token.token, expiresAt: options?.expiresAt ?? null },
  });

  return { success: true, data: mapTokenItem(token) };
}

export async function listShareTokens(
  viewId: string
): Promise<ServiceResult<FormShareTokenItem[]>> {
  const tokens = await db.formShareToken.findMany({
    where: { viewId },
    orderBy: { createdAt: "desc" },
  });
  return { success: true, data: tokens.map(mapTokenItem) };
}

export async function revokeShareToken(
  tokenId: string,
  userId: string
): Promise<ServiceResult<{ id: string }>> {
  const token = await db.formShareToken.findFirst({
    where: { id: tokenId, createdById: userId },
  });
  if (!token) {
    return { success: false, error: { code: "NOT_FOUND", message: "分享链接不存在" } };
  }
  await db.formShareToken.update({
    where: { id: tokenId },
    data: { isActive: false },
  });
  return { success: true, data: { id: tokenId } };
}

export async function deleteShareToken(
  tokenId: string,
  userId: string,
  userName?: string | null
): Promise<ServiceResult<{ id: string }>> {
  const token = await db.formShareToken.findFirst({
    where: { id: tokenId, createdById: userId },
  });
  if (!token) {
    return { success: false, error: { code: "NOT_FOUND", message: "分享链接不存在" } };
  }

  await db.formShareToken.delete({ where: { id: tokenId } });

  // Audit log
  await logAudit({
    userId,
    userName,
    action: "FORM_SHARE_DELETE",
    targetType: "FormShareToken",
    targetId: tokenId,
    targetName: token.label ?? null,
    detail: { viewId: token.viewId, token: token.token },
  });

  return { success: true, data: { id: tokenId } };
}

// ── Public Form: Resolve & Submit ──

export interface PublicFormConfig {
  formTitle: string;
  formDescription: string;
  submitButtonText: string;
  successMessage: string;
  allowMultipleSubmissions: boolean;
  tableId: string;
  tableName: string;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    options?: unknown;
    description?: string;
  }>;
  layout: FormViewOptions["layout"];
}

export async function resolvePublicForm(
  token: string
): Promise<ServiceResult<PublicFormConfig>> {
  const shareToken = await db.formShareToken.findUnique({
    where: { token },
    include: {
      view: {
        include: {
          table: {
            include: { fields: { orderBy: { sortOrder: "asc" } } },
          },
        },
      },
    },
  });

  if (!shareToken || !shareToken.isActive) {
    return { success: false, error: { code: "NOT_FOUND", message: "表单链接无效或已失效" } };
  }

  if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
    return { success: false, error: { code: "EXPIRED", message: "表单链接已过期" } };
  }

  const view = shareToken.view;
  const table = view.table;
  const opts = (view.viewOptions ?? {}) as Partial<FormViewOptions>;

  // Filter out fields not suitable for public forms
  const publicFields = table.fields.filter(
    (f) => !EXCLUDED_PUBLIC_FIELD_TYPES.has(f.type)
  );

  const defaultLayout: FormViewOptions["layout"] = {
    version: 1,
    groups: [
      {
        id: "default",
        title: "",
        fieldKeys: publicFields.map((f) => f.key),
      },
    ],
  };

  return {
    success: true,
    data: {
      formTitle: opts.formTitle ?? table.name,
      formDescription: opts.formDescription ?? "",
      submitButtonText: opts.submitButtonText ?? "提交",
      successMessage: opts.successMessage ?? "提交成功！",
      allowMultipleSubmissions: opts.allowMultipleSubmissions ?? false,
      tableId: table.id,
      tableName: table.name,
      fields: publicFields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.options,
      })),
      layout: opts.layout ?? defaultLayout,
    },
  };
}

// System user for public form submissions
let _systemUserId: string | null = null;

async function getSystemUserId(): Promise<string> {
  if (_systemUserId) return _systemUserId;
  const admin = await db.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin user found for public form submission");
  _systemUserId = admin.id;
  return _systemUserId;
}

export async function submitPublicForm(
  token: string,
  data: Record<string, unknown>
): Promise<ServiceResult<{ message: string }>> {
  // First validate the token and get shareToken record
  const shareToken = await db.formShareToken.findUnique({
    where: { token },
  });

  if (!shareToken || !shareToken.isActive) {
    return { success: false, error: { code: "NOT_FOUND", message: "表单链接无效或已失效" } };
  }

  if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
    return { success: false, error: { code: "EXPIRED", message: "表单链接已过期" } };
  }

  const configResult = await resolvePublicForm(token);
  if (!configResult.success) return configResult as ServiceResult<{ message: string }>;

  const config = configResult.data;
  const userId = await getSystemUserId();

  // Only allow keys that are declared in the public form fields
  const allowedKeys = new Set(config.fields.map((f) => f.key));
  const filteredData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowedKeys.has(key)) {
      filteredData[key] = value;
    }
  }

  const result = await createRecord(userId, config.tableId, filteredData, {
    skipRequiredValidation: false,
  });

  if (!result.success) {
    return {
      success: false,
      error: { code: "SUBMIT_FAILED", message: result.error.message },
    };
  }

  // Increment submission count
  await db.formShareToken.update({
    where: { id: shareToken.id },
    data: { submissionCount: { increment: 1 } },
  });

  // Audit log for form submission
  await logAudit({
    userId,
    action: "FORM_SUBMIT",
    targetType: "FormShareToken",
    targetId: shareToken.id,
    targetName: shareToken.label ?? null,
    detail: { token: shareToken.token, viewId: shareToken.viewId, tableId: config.tableId },
  });

  return {
    success: true,
    data: { message: config.successMessage },
  };
}
