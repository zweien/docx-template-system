import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { listTemplates } from "@/lib/services/template.service";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);
  const search = searchParams.get("search") || undefined;

  const result = await listTemplates({
    page,
    pageSize,
    status: "PUBLISHED",
    search: search || undefined,
  });

  if (!result.success) {
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  return Response.json({ data: result.data.items });
}
