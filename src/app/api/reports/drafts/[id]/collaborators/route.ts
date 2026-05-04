import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit-log.service";
import { getClientIp, getUserAgent } from "@/lib/request-utils";
import {
  addCollaborator,
  removeCollaborator,
} from "@/modules/reports/services/report-draft.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const result = await addCollaborator(id, session.user.id, body.userId);
  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  await logAudit({
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "REPORT_COLLABORATOR_ADD",
    targetType: "ReportDraft",
    targetId: id,
    detail: { collaboratorEmail: body.email },
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });
  return NextResponse.json({ collaborators: result.data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const result = await removeCollaborator(id, session.user.id, body.userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 404 });
  }
  await logAudit({
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    action: "REPORT_COLLABORATOR_REMOVE",
    targetType: "ReportDraft",
    targetId: id,
    detail: { collaboratorEmail: body.email },
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });
  return NextResponse.json({ collaborators: result.data });
}
