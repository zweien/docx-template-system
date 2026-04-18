import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { globalSearch } from "@/lib/services/search.service";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ success: true, data: [] });
  }

  const limit = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("limit") ?? "5", 10) || 5, 1),
    20
  );

  const result = await globalSearch(q, limit);

  if (!result.success) {
    return NextResponse.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
