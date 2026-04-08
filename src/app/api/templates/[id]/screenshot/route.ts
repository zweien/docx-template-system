import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as templateService from "@/lib/services/template.service";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { UPLOAD_DIR } from "@/lib/constants/upload";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

// ── POST /api/templates/[id]/screenshot ──

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可执行此操作" } },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("screenshot") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请选择图片文件" } },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "仅支持 png, jpg, jpeg, webp, gif 格式" } },
        { status: 400 }
      );
    }

    // 检查模板是否存在
    const existing = await templateService.getTemplate(id);
    if (!existing.success) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "模板不存在" } },
        { status: 404 }
      );
    }

    // 删除旧截图
    if (existing.data.screenshot) {
      await templateService.deleteScreenshot(id);
    }

    // 保存新截图
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${id}_screenshot_${Date.now()}.${ext}`;
    const dir = join(process.cwd(), "public", UPLOAD_DIR, "templates");

    if (!existsSync(dir)) await mkdir(dir, { recursive: true });

    const filePath = join(dir, fileName);
    await writeFile(filePath, buffer);

    const relativePath = `/uploads/templates/${fileName}`;

    // 更新数据库
    const result = await templateService.updateScreenshot(id, relativePath);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { path: relativePath } });
  } catch (error) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "上传截图失败" } },
      { status: 500 }
    );
  }
}

// ── DELETE /api/templates/[id]/screenshot ──

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "仅管理员可执行此操作" } },
      { status: 403 }
    );
  }

  const { id } = await params;
  const result = await templateService.deleteScreenshot(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: null });
}