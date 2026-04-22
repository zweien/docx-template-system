import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listAutomationRuns } from "@/lib/services/automation-run.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未授权" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const result = await listAutomationRuns(id, session.user.id);
  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data });
}
