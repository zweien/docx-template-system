import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as templateVersionService from "@/lib/services/template-version.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id, version: versionStr } = await params;
  const version = parseInt(versionStr, 10);

  if (isNaN(version) || version < 1) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "版本号无效" } },
      { status: 400 }
    );
  }

  const result = await templateVersionService.getVersionDetail(id, version);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data });
}
