import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRecordChangeHistory } from "@/lib/services/data-record-change-history.service";

interface RouteParams {
  params: Promise<{ id: string; recordId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { recordId } = await params;
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  const result = await getRecordChangeHistory(recordId, {
    page,
    pageSize,
    startDate,
    endDate,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
