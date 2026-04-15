import { NextRequest, NextResponse } from "next/server";
import { submitPublicForm } from "@/lib/services/form-share.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const body = await request.json();
    const data = body.data ?? body;

    if (typeof data !== "object" || data === null) {
      return NextResponse.json(
        { error: { code: "INVALID_DATA", message: "提交数据格式无效" } },
        { status: 400 }
      );
    }

    const result = await submitPublicForm(token, data);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("[FormSubmit] Error:", error);
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "请求处理失败" } },
      { status: 400 }
    );
  }
}
