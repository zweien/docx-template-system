import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readBackup } from "@/lib/services/backup.service";

interface RouteContext {
  params: Promise<{ filename: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } }, { status: 403 });
  }

  const { filename } = await params;
  const decodedFilename = decodeURIComponent(filename);
  const result = await readBackup(decodedFilename);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.data.data), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${decodedFilename}"`,
      "Content-Length": String(result.data.size),
    },
  });
}
