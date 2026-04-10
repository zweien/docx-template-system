import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse, authErrorStatus, requireWriteAccess } from "@/lib/api-token-auth";
import {
  updateRecord,
  deleteRecord,
} from "@/lib/services/data-record.service";
import { updateRecordSchema } from "@/validators/data-table";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string; recordId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, authErrorStatus(authResult.error.code));
  }

  const writeError = requireWriteAccess(authResult.data);
  if (writeError) return writeError;

  const { id, recordId } = await params;

  // Verify record belongs to the declared table
  const record = await db.dataRecord.findUnique({ where: { id: recordId }, select: { tableId: true } });
  if (!record || record.tableId !== id) {
    return apiErrorResponse("NOT_FOUND", "记录不存在或不属于该数据表", 404);
  }

  try {
    const body = await request.json();
    const validated = updateRecordSchema.parse(body);

    const result = await updateRecord(
      recordId,
      validated.data,
      authResult.data.userId
    );

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return apiErrorResponse("NOT_FOUND", result.error.message, 404);
      }
      return apiErrorResponse("VALIDATION_ERROR", result.error.message, 400);
    }

    return Response.json({ data: result.data });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return apiErrorResponse("VALIDATION_ERROR", "请求数据验证失败", 400);
    }
    return apiErrorResponse("INTERNAL_ERROR", "更新记录失败", 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, authErrorStatus(authResult.error.code));
  }

  const writeError = requireWriteAccess(authResult.data);
  if (writeError) return writeError;

  const { id, recordId } = await params;

  // Verify record belongs to the declared table
  const record = await db.dataRecord.findUnique({ where: { id: recordId }, select: { tableId: true } });
  if (!record || record.tableId !== id) {
    return apiErrorResponse("NOT_FOUND", "记录不存在或不属于该数据表", 404);
  }

  const result = await deleteRecord(recordId);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", result.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: { deleted: true } });
}
