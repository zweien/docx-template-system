import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { getTemplate } from "@/lib/services/template.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { id } = await params;
  const result = await getTemplate(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", result.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", result.error.message, 500);
  }

  const template = result.data;
  return Response.json({
    data: {
      id: template.id,
      name: template.name,
      description: template.description,
      placeholders: template.placeholders.map((p) => ({
        key: p.key,
        label: p.label,
        type: p.inputType,
        required: p.required,
        defaultValue: p.defaultValue,
      })),
      createdAt: template.createdAt,
    },
  });
}
