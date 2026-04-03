import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { downloadDocumentCollectionAttachment } from "@/lib/services/document-collection-download.service";

interface RouteParams {
  params: Promise<{ id: string; attachmentId: string }>;
}

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("未授权", 401, "UNAUTHORIZED");
  }

  const { id, attachmentId } = await params;
  const result = await downloadDocumentCollectionAttachment({
    taskId: id,
    attachmentId,
    userId: session.user.id,
  });

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 500;
    return errorResponse(result.error.message, status, result.error.code);
  }

  return new NextResponse(new Uint8Array(result.data.buffer), {
    headers: {
      "Content-Type": result.data.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        result.data.fileName
      )}`,
    },
  });
}
