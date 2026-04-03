import { Buffer } from "buffer";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { submitDocumentCollectionVersion } from "@/lib/services/document-collection-submission.service";
import { submitDocumentCollectionNoteSchema } from "@/validators/document-collection";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value === "object" &&
    "name" in value &&
    "arrayBuffer" in value &&
    typeof value.name === "string" &&
    typeof value.arrayBuffer === "function"
  );
}

function mapServiceError(error: { code?: string; message: string }) {
  if (error.code === "NOT_FOUND") {
    return errorResponse(error.message, 404, error.code);
  }

  if (error.code === "TASK_CLOSED") {
    return errorResponse(error.message, 409, error.code);
  }

  if (error.code?.endsWith("_FAILED")) {
    return errorResponse(error.message, 500, error.code);
  }

  return errorResponse(error.message, 400, error.code);
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isFileLike(file)) {
      return errorResponse("请上传文件", 400, "VALIDATION_ERROR");
    }

    const noteResult = submitDocumentCollectionNoteSchema.parse({
      note: formData.get("note") ?? undefined,
    });

    const result = await submitDocumentCollectionVersion({
      taskId: id,
      userId: session.user.id,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
      note: noteResult.note,
      versionId: randomUUID(),
    });

    if (!result.success) {
      return mapServiceError(result.error);
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return errorResponse("参数校验失败", 400, "VALIDATION_ERROR");
    }

    return errorResponse("提交文件失败", 500, "INTERNAL_ERROR");
  }
}
