import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listShareTokens,
  createShareToken,
} from "@/lib/services/form-share.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { viewId } = await params;
  const result = await listShareTokens(viewId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Build full URLs for each token
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  const tokensWithUrl = result.data.map((t) => ({
    ...t,
    url: baseUrl ? `${baseUrl}/f/${t.token}` : `/f/${t.token}`,
  }));

  return NextResponse.json({ success: true, data: tokensWithUrl });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; viewId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { viewId } = await params;
  const body = await request.json().catch(() => ({}));

  const result = await createShareToken(
    viewId,
    session.user.id,
    session.user.name,
    {
      label: body.label,
      expiresAt: body.expiresAt,
    }
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Build full URL for convenience
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  const shareUrl = baseUrl ? `${baseUrl}/f/${result.data.token}` : `/f/${result.data.token}`;

  return NextResponse.json(
    { success: true, data: { ...result.data, url: shareUrl } },
    { status: 201 }
  );
}
