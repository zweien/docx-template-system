import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { downloadDocumentCollectionTaskArchive } from "@/lib/services/document-collection-download.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  const { id } = await params;
  const result = await downloadDocumentCollectionTaskArchive({
    taskId: id,
    userId: session.user.id,
  });

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return errorResponse(result.error.message, 404, result.error.code);
    }

    if (result.error.code === "EMPTY_TASK") {
      return errorResponse(result.error.message, 400, result.error.code);
    }

    if (result.error.code?.endsWith("_FAILED")) {
      return errorResponse(result.error.message, 500, result.error.code);
    }

    return errorResponse(result.error.message, 400, result.error.code);
  }

  return new NextResponse(new Uint8Array(result.data.buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        result.data.fileName
      )}`,
    },
  });
}
