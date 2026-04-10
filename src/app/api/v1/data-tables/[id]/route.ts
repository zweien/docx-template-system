import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { getTable } from "@/lib/services/data-table.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { id } = await params;
  const result = await getTable(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", result.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: result.data });
}
