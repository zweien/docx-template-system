import { Buffer } from "buffer";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createDocumentCollectionTask,
  listDocumentCollectionTasks,
} from "@/lib/services/document-collection-task.service";
import {
  createDocumentCollectionTaskSchema,
  documentCollectionListQuerySchema,
} from "@/validators/document-collection";

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function isUploadFile(value: FormDataEntryValue): value is File {
  return (
    typeof value !== "string" &&
    "name" in value &&
    typeof (value as unknown as Record<string, unknown>).name === "string" &&
    typeof (value as unknown as Record<string, unknown>).size === "number" &&
    typeof (value as unknown as Record<string, unknown>).arrayBuffer === "function"
  );
}

function filterUploadFiles(entries: FormDataEntryValue[]): File[] {
  return entries.filter((v): v is File => isUploadFile(v) && v.size > 0);
}

function mapServiceError(error: { code?: string; message: string }) {
  if (error.code === "NOT_FOUND") {
    return errorResponse(error.message, 404, error.code);
  }

  if (error.code?.endsWith("_FAILED")) {
    return errorResponse(error.message, 500, error.code);
  }

  return errorResponse(error.message, 400, error.code);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const url = new URL(request.url);
    const query = documentCollectionListQuerySchema.parse({
      scope: url.searchParams.get("scope") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });

    const result = await listDocumentCollectionTasks({
      userId: session.user.id,
      scope: query.scope,
      status: query.status,
      search: query.search,
    });

    if (!result.success) {
      return mapServiceError(result.error);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return errorResponse("参数校验失败", 400, "VALIDATION_ERROR");
    }

    return errorResponse("获取任务列表失败", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  try {
    const formData = await request.formData();
    const renameVariablesRaw = formData.get("renameVariables");
    const assigneeIds = formData
      .getAll("assigneeIds")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const attachmentFiles = filterUploadFiles(formData.getAll("attachments"));
    let renameVariables = {};

    if (typeof renameVariablesRaw === "string" && renameVariablesRaw.trim().length > 0) {
      try {
        renameVariables = JSON.parse(renameVariablesRaw) as Record<string, string>;
      } catch {
        return errorResponse("renameVariables 必须是合法 JSON", 400, "VALIDATION_ERROR");
      }
    }

    const parsed = createDocumentCollectionTaskSchema.parse({
      title: formData.get("title"),
      instruction: formData.get("instruction"),
      dueAt: formData.get("dueAt"),
      assigneeIds,
      renameRule: formData.get("renameRule"),
      renameVariables,
    });

    const result = await createDocumentCollectionTask({
      creatorId: session.user.id,
      title: parsed.title,
      instruction: parsed.instruction,
      dueAt: parsed.dueAt,
      assigneeIds: parsed.assigneeIds,
      renameRule: parsed.renameRule,
      renameVariables: parsed.renameVariables,
      attachments: await Promise.all(
        attachmentFiles.map(async (file) => ({
          id: randomUUID(),
          originalFileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          buffer: Buffer.from(await file.arrayBuffer()),
        }))
      ),
    });

    if (!result.success) {
      return mapServiceError(result.error);
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return errorResponse("参数校验失败", 400, "VALIDATION_ERROR");
    }

    return errorResponse("创建任务失败", 500, "INTERNAL_ERROR");
  }
}
