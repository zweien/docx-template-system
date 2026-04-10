import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse, authErrorStatus } from "@/lib/api-token-auth";
import { listTables } from "@/lib/services/data-table.service";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, authErrorStatus(authResult.error.code));
  }

  const result = await listTables();

  if (!result.success) {
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: result.data });
}
