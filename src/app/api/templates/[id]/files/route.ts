import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  saveTemplateSourceFile,
  deleteTemplateSourceFile,
  listTemplateSourceFiles,
  packTemplateBundle,
} from "@/lib/file.service";
import { stat } from "fs/promises";

// ── GET /api/templates/[id]/files ──
// 列出 DOWNLOAD 型模板 sources/ 下的文件清单（登录用户均可，PUBLISHED 才对外可见由前端控制）

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id } = await params;
  const template = await db.template.findUnique({
    where: { id },
    select: { deliveryMode: true, status: true },
  });

  if (!template) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "模板不存在" } },
      { status: 404 }
    );
  }

  if (template.deliveryMode !== "DOWNLOAD") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "该模板不是文件下载型" } },
      { status: 400 }
    );
  }

  const files = await listTemplateSourceFiles(id);
  return NextResponse.json({ success: true, data: files });
}

// ── POST /api/templates/[id]/files ──
// 上传一个文件到 sources/ 并重新打包 bundle.zip（仅管理员）

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
  const template = await db.template.findUnique({
    where: { id },
    select: { deliveryMode: true },
  });

  if (!template) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "模板不存在" } },
      { status: 404 }
    );
  }

  if (template.deliveryMode !== "DOWNLOAD") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "该模板不是文件下载型" } },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请上传文件" } },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileMeta = await saveTemplateSourceFile(id, Buffer.from(arrayBuffer), file.name);

    // 重新打包 bundle.zip
    const bundle = await packTemplateBundle(id);
    let bundleSize = 0;
    if (bundle) {
      bundleSize = (await stat(bundle.filePath)).size;
      // 更新 Template 的 filePath 和 fileSize
      await db.template.update({
        where: { id },
        data: { filePath: bundle.filePath, fileSize: bundleSize },
      });
    }

    return NextResponse.json(
      { success: true, data: { fileName: fileMeta.fileName, bundleSize } },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传文件失败";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

// ── DELETE /api/templates/[id]/files ──
// 删除 sources/ 下指定文件并重新打包（仅管理员）

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
  const template = await db.template.findUnique({
    where: { id },
    select: { deliveryMode: true },
  });

  if (!template) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "模板不存在" } },
      { status: 404 }
    );
  }

  if (template.deliveryMode !== "DOWNLOAD") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "该模板不是文件下载型" } },
      { status: 400 }
    );
  }

  try {
    const { fileName } = await request.json();
    if (typeof fileName !== "string" || !fileName) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "缺少 fileName" } },
        { status: 400 }
      );
    }

    const deleted = await deleteTemplateSourceFile(id, fileName);
    if (!deleted) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "文件不存在" } },
        { status: 404 }
      );
    }

    // 重新打包
    const bundle = await packTemplateBundle(id);
    let bundleSize = 0;
    let filePath = null;
    if (bundle) {
      bundleSize = (await stat(bundle.filePath)).size;
      filePath = bundle.filePath;
    }
    await db.template.update({
      where: { id },
      data: { filePath: filePath ?? undefined, fileSize: bundleSize },
    });

    return NextResponse.json({ success: true, data: { bundleSize } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除文件失败";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
