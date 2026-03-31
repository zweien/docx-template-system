import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  processAttachmentExtraction,
  saveAttachment,
} from "@/lib/services/ai-attachment.service";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (
      !file ||
      typeof file !== "object" ||
      !("arrayBuffer" in file) ||
      !("name" in file)
    ) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "缺少文件" } },
        { status: 400 }
      );
    }

    const uploadFile = file as File;
    const buffer = Buffer.from(await uploadFile.arrayBuffer());
    const result = await saveAttachment({
      id: randomUUID(),
      userId: session.user.id,
      fileName: uploadFile.name,
      mimeType: uploadFile.type || "application/octet-stream",
      size: uploadFile.size,
      buffer,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    void processAttachmentExtraction(result.data.id);

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "上传附件失败",
        },
      },
      { status: 500 }
    );
  }
}
