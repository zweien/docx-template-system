import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveReportImage } from "@/lib/file.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "请上传文件" } }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const meta = await saveReportImage(buffer, file.name, id);
    return NextResponse.json({ success: true, data: { url: meta.urlPath } });
  } catch (e: any) {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: e.message } }, { status: 500 });
  }
}
