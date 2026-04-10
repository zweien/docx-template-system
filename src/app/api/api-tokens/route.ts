import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTokens, createToken } from "@/lib/services/api-token.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const result = await listTokens(session.user.id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ tokens: result.data });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = (body.name as string)?.trim();
    if (!name || name.length > 100) {
      return NextResponse.json(
        { error: "名称不能为空且不能超过100个字符" },
        { status: 400 }
      );
    }

    const expiresInDays = body.expiresInDays as number | null | undefined;

    const result = await createToken(session.user.id, name, expiresInDays ?? null);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建 Token 失败" }, { status: 500 });
  }
}
