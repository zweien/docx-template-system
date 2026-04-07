import { Buffer } from "buffer";
import { randomUUID } from "crypto";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UPLOAD_DIR } from "@/lib/constants/upload";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "未找到文件" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = file.name;
    const extension = originalName.split(".").pop() || "";
    
    // Generate a unique filename to avoid collisions
    const fileName = `${randomUUID()}${extension ? `.${extension}` : ""}`;
    const relativeDir = "files";
    const absoluteDir = join(process.cwd(), UPLOAD_DIR, relativeDir);
    
    if (!existsSync(absoluteDir)) {
      await mkdir(absoluteDir, { recursive: true });
    }

    const absolutePath = join(absoluteDir, fileName);
    await writeFile(absolutePath, buffer);

    // Web accessible URL
    const urlBase = UPLOAD_DIR.startsWith("public/") 
      ? UPLOAD_DIR.slice("public".length) 
      : `/${UPLOAD_DIR}`;
    
    const urlPath = `${urlBase}/${relativeDir}/${fileName}`.replace(/\/+/g, "/");

    return NextResponse.json({
      url: urlPath,
      name: originalName,
      size: file.size,
      type: file.type
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "文件上传失败" }, { status: 500 });
  }
}
