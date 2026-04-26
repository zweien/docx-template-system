import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  addCollaborator,
  removeCollaborator,
} from "@/modules/reports/services/report-draft.service";

export async function POST(
  req: Request,
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
  return NextResponse.json({ collaboratorIds: result.data });
}

export async function DELETE(
  req: Request,
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
  return NextResponse.json({ collaboratorIds: result.data });
}
