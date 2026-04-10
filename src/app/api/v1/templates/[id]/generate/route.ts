import { NextRequest } from "next/server";
import { authenticateApiToken, apiErrorResponse } from "@/lib/api-token-auth";
import { getTemplate } from "@/lib/services/template.service";
import { createRecord, generateDocument } from "@/lib/services/record.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await authenticateApiToken(request);
  if (!authResult.success) {
    return apiErrorResponse(authResult.error.code, authResult.error.message, 401);
  }

  const { id } = await params;

  // Validate template exists and is published
  const templateResult = await getTemplate(id);
  if (!templateResult.success) {
    if (templateResult.error.code === "NOT_FOUND") {
      return apiErrorResponse("NOT_FOUND", templateResult.error.message, 404);
    }
    return apiErrorResponse("INTERNAL_ERROR", templateResult.error.message, 500);
  }

  const template = templateResult.data;
  if (template.status !== "PUBLISHED") {
    return apiErrorResponse("FORBIDDEN", "模板未发布，无法生成文档", 403);
  }

  // Parse form data
  let formData: Record<string, string>;
  try {
    const body = await request.json();
    formData = body.formData as Record<string, string>;
    if (!formData || typeof formData !== "object") {
      return apiErrorResponse("VALIDATION_ERROR", "formData 字段不能为空", 400);
    }
  } catch {
    return apiErrorResponse("VALIDATION_ERROR", "请求体格式错误", 400);
  }

  // Create a record
  const recordResult = await createRecord(authResult.data.userId, id, formData);
  if (!recordResult.success) {
    return apiErrorResponse("INTERNAL_ERROR", recordResult.error.message, 500);
  }

  // Generate document
  const generateResult = await generateDocument(recordResult.data.id);
  if (!generateResult.success) {
    return apiErrorResponse("INTERNAL_ERROR", generateResult.error.message, 500);
  }

  // Read the generated file and return as stream
  const filePath = generateResult.data.filePath;
  if (!filePath) {
    return apiErrorResponse("INTERNAL_ERROR", "文档生成失败：文件路径为空", 500);
  }

  try {
    const { readFile } = await import("fs/promises");
    const fileBuffer = await readFile(filePath);
    const fileName = generateResult.data.fileName || `${template.name}.docx`;

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch {
    return apiErrorResponse("INTERNAL_ERROR", "读取生成的文档失败", 500);
  }
}
