import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse, requireWriteAccess } from "@/lib/api-token-auth";
import {
  listRecords,
  createRecord,
} from "@/lib/services/data-record.service";
import { createRecordSchema } from "@/validators/data-table";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(
    parseInt(searchParams.get("pageSize") || "20", 10),
    100
  );
  const search = searchParams.get("search") || undefined;

  const result = await listRecords(id, { page, pageSize, search });

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", result.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: result.data });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const writeError = requireWriteAccess(authResult.data);
  if (writeError) return writeError;

  const { id } = await params;

  try {
    const body = await request.json();
    const validated = createRecordSchema.parse(body);

    const result = await createRecord(authResult.data.userId, id, validated.data);

    if (!result.success) {
      if (result.error.code === "NOT_FOUND") {
        return apiErrorResponse("NOT_FOUND", result.error.message, 404);
      }
      return apiErrorResponse("VALIDATION_ERROR", result.error.message, 400);
    }

    return Response.json({ data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return apiErrorResponse("VALIDATION_ERROR", "请求数据验证失败", 400);
    }
    return apiErrorResponse("INTERNAL_ERROR", "创建记录失败", 500);
  }
}
