// src/app/api/batch/[id]/download/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBatch } from "@/lib/services/batch-generation.service";
import { existsSync } from "fs";
import { readFile } from "fs/promises";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { id } = await params;

  const result = await getBatch(id);

  if (!result.success) {
    if (result.error.code === "NOT_FOUND") {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: result.error.message },
      { status: 400 }
    );
  }

  const batch = result.data;

  if (batch.outputMethod !== "DOWNLOAD") {
    return NextResponse.json(
      { error: "此批次不支持下载" },
      { status: 400 }
    );
  }

  const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";
  const { join } = await import("path");
  const zipPath = join(process.cwd(), UPLOAD_DIR, "batches", `batch-${id}.zip`);

  if (!existsSync(zipPath)) {
    return NextResponse.json({ error: "ZIP 文件不存在" }, { status: 404 });
  }

  const fileBuffer = await readFile(zipPath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="batch-${id}.zip"`,
    },
  });
}
