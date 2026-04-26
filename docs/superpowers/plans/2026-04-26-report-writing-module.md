# 报告撰写模块集成 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 /home/z/codebase/report-template 项目集成为本项目的"撰写报告"子模块，包含 BlockNote 编辑器、AI 辅助、报告模板管理和草稿管理。

**Architecture:** 采用 Route Group 隔离，报告模块使用独立的 `(reports)` 路由组 + `src/modules/reports/` 业务代码目录。Python 渲染引擎作为独立 FastAPI 服务（端口 8066）。数据存 PostgreSQL/Prisma，前端 BlockNote 编辑器直接集成。

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL, BlockNote 0.49, Vercel AI SDK, Zustand, FastAPI (Python), docxtpl/python-docx

**Spec:** `docs/superpowers/specs/2026-04-26-report-writing-module-design.md`

**Source project:** `/home/z/codebase/report-template`

---

## Phase 1: Foundation

### Task 1: Prisma Schema + 数据库迁移

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 在 User 模型中添加报告关联**

在 `prisma/schema.prisma` 的 `User` 模型中添加两行：

```prisma
  reportTemplates        ReportTemplate[]
  reportDrafts           ReportDraft[]
```

放在 `updatedAutomations` 行之后。

- [ ] **Step 2: 在 schema 末尾添加 ReportTemplate 和 ReportDraft 模型**

```prisma
model ReportTemplate {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  name             String
  originalFilename String
  filePath         String
  parsedStructure  Json
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  drafts           ReportDraft[]
}

model ReportDraft {
  id             String        @id @default(cuid())
  userId         String
  user           User          @relation(fields: [userId], references: [id])
  templateId     String
  template       ReportTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  title          String        @default("未命名报告")
  context        Json          @default("{}")
  sections       Json          @default("{}")
  attachments    Json          @default("{}")
  sectionEnabled Json          @default("{}")
  status         String        @default("draft")
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}
```

- [ ] **Step 3: 推送 schema 到数据库**

Run: `npx prisma db push`
Expected: Schema synchronized successfully

- [ ] **Step 4: 重新生成 Prisma Client**

Run: `npx prisma generate`
Expected: Prisma client generated

- [ ] **Step 5: 提交**

```bash
git add prisma/schema.prisma src/generated/prisma/
git commit -m "feat(reports): add ReportTemplate and ReportDraft models"
```

---

### Task 2: Python report-engine 服务

**Files:**
- Create: `report-engine/main.py`
- Create: `report-engine/requirements.txt`

- [ ] **Step 1: 创建 report-engine 目录**

```bash
mkdir -p report-engine/src/report_engine
```

- [ ] **Step 2: 复制 report_engine 核心文件**

从 `/home/z/codebase/report-template/src/report_engine/` 复制以下文件到 `report-engine/src/report_engine/`：
- `blocks.py`
- `renderer.py`
- `validator.py`
- `schema.py`
- `style_checker.py`
- `template_checker.py`
- `subdoc.py`
- `compat.py`

```bash
cp /home/z/codebase/report-template/src/report_engine/*.py report-engine/src/report_engine/
```

- [ ] **Step 3: 复制 template_parser.py 和 converter.py**

```bash
cp /home/z/codebase/report-template/server/services/template_parser.py report-engine/src/report_engine/
cp /home/z/codebase/report-template/server/services/converter.py report-engine/src/report_engine/
```

- [ ] **Step 4: 创建 requirements.txt**

```txt
fastapi>=0.100.0
uvicorn[standard]>=0.20.0
docxtpl[subdoc]>=0.16.0
python-docx>=0.8.11
pydantic>=2.0
pyyaml
latex2mathml
```

- [ ] **Step 5: 创建 main.py**

```python
import os
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.report_engine.renderer import render_report
from src.report_engine.template_parser import parse_template

app = FastAPI(title="Report Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParseRequest(BaseModel):
    template_path: str


class RenderRequest(BaseModel):
    template_path: str
    payload: dict[str, Any]
    output_filename: str = "report.docx"


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/parse-template")
async def parse_template_endpoint(req: ParseRequest):
    if not Path(req.template_path).exists():
        raise HTTPException(status_code=404, detail="Template file not found")
    structure, warnings = parse_template(req.template_path)
    return {"structure": structure, "warnings": warnings}


@app.post("/render")
async def render_endpoint(req: RenderRequest):
    from fastapi.responses import FileResponse

    if not Path(req.template_path).exists():
        raise HTTPException(status_code=404, detail="Template file not found")

    output_path = tempfile.mktemp(suffix=".docx")
    try:
        render_report(req.template_path, req.payload, output_path, check_template=False)
        filename = req.output_filename or "report.docx"
        return FileResponse(output_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    except Exception as e:
        if Path(output_path).exists():
            Path(output_path).unlink()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8066"))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

- [ ] **Step 6: 创建 Python 虚拟环境并安装依赖**

```bash
cd report-engine && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

- [ ] **Step 7: 验证服务启动**

```bash
cd report-engine && .venv/bin/python main.py &
curl http://localhost:8066/health
# Expected: {"status":"ok"}
# 然后停止服务
```

- [ ] **Step 8: 提交**

```bash
git add report-engine/
git commit -m "feat(reports): add report-engine Python service"
```

---

### Task 3: 安装 BlockNote npm 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 BlockNote 和 AI SDK 依赖**

```bash
npm install @blocknote/core@^0.49.0 @blocknote/react@^0.49.0 @blocknote/shadcn@^0.49.0 @blocknote/xl-ai@^0.49.0 @ai-sdk/openai@^3.0.53 ai@^6.0.168 zustand@^5.0.12 mermaid
```

- [ ] **Step 2: 验证安装**

Run: `npx tsc --noEmit`
Expected: 无新增类型错误（可能需要后续文件创建后才能完全通过）

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "feat(reports): add BlockNote and AI SDK dependencies"
```

---

## Phase 2: Backend Types, Validators, Services

### Task 4: 报告模块类型定义

**Files:**
- Create: `src/modules/reports/types/index.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
export interface ReportTemplateListItem {
  id: string;
  name: string;
  originalFilename: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportTemplateDetail extends ReportTemplateListItem {
  filePath: string;
  parsedStructure: ReportTemplateStructure;
}

export interface ReportTemplateStructure {
  context_vars: string[];
  sections: ReportSectionMeta[];
  attachments_bundle: {
    placeholder: string;
    flag_name: string;
  } | null;
  required_styles: string[];
}

export interface ReportSectionMeta {
  id: string;
  placeholder: string;
  flag_name: string;
  title: string;
  template_headings?: { text: string; level: number }[];
  required_styles?: string[];
}

export interface ReportDraftListItem {
  id: string;
  title: string;
  templateId: string;
  templateName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportDraftDetail {
  id: string;
  title: string;
  templateId: string;
  template: {
    id: string;
    name: string;
    filePath: string;
    parsedStructure: ReportTemplateStructure;
  };
  context: Record<string, string>;
  sections: Record<string, any[]>;
  attachments: Record<string, any[]>;
  sectionEnabled: Record<string, boolean>;
  status: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: 提交**

```bash
git add src/modules/reports/types/
git commit -m "feat(reports): add report module type definitions"
```

---

### Task 5: 报告模块 Zod 验证器

**Files:**
- Create: `src/modules/reports/validators/index.ts`

- [ ] **Step 1: 创建验证器**

```typescript
import { z } from "zod";

export const createReportDraftSchema = z.object({
  templateId: z.string().min(1, "请选择报告模板"),
  title: z.string().min(1).max(200).optional(),
});

export const updateReportDraftSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  context: z.record(z.string(), z.string()).optional(),
  sections: z.record(z.string(), z.array(z.any())).optional(),
  attachments: z.record(z.string(), z.array(z.any())).optional(),
  sectionEnabled: z.record(z.string(), z.boolean()).optional(),
});
```

- [ ] **Step 2: 提交**

```bash
git add src/modules/reports/validators/
git commit -m "feat(reports): add report validators"
```

---

### Task 6: 扩展文件存储服务

**Files:**
- Modify: `src/lib/file.service.ts`

- [ ] **Step 1: 添加报告文件存储函数**

在 `file.service.ts` 末尾添加：

```typescript
export async function saveReportTemplateFile(
  buffer: Buffer,
  originalName: string,
  id: string
): Promise<FilePathMeta> {
  const targetDir = join(process.cwd(), UPLOAD_DIR, "report-templates");
  return saveFileToDirectory(buffer, targetDir, "report-templates", id, {
    extension: "docx",
  });
}

export async function saveReportImage(
  buffer: Buffer,
  originalName: string,
  id: string
): Promise<FilePathMeta> {
  const targetDir = join(process.cwd(), UPLOAD_DIR, "reports", "images");
  const ext = originalName.split(".").pop() || "png";
  return saveFileToDirectory(buffer, targetDir, "reports/images", id, {
    extension: ext,
  });
}

export async function deleteReportTemplateFile(filePath: string): Promise<void> {
  await deleteFile(filePath);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/file.service.ts
git commit -m "feat(reports): add report file storage functions"
```

---

### Task 7: 报告模板 Service

**Files:**
- Create: `src/modules/reports/services/report-template.service.ts`

- [ ] **Step 1: 创建模板 service**

```typescript
import { db } from "@/lib/db";
import { saveReportTemplateFile, deleteReportTemplateFile, deleteFile } from "@/lib/file.service";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const REPORT_ENGINE_URL = process.env.REPORT_ENGINE_URL || "http://localhost:8066";

export async function listReportTemplates(userId: string): Promise<ServiceResult<any[]>> {
  try {
    const templates = await db.reportTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, originalFilename: true,
        createdAt: true, updatedAt: true,
      },
    });
    return { success: true, data: templates };
  } catch {
    return { success: false, error: { code: "LIST_FAILED", message: "获取报告模板列表失败" } };
  }
}

export async function createReportTemplate(
  userId: string,
  file: File
): Promise<ServiceResult<any>> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.replace(/\.docx$/i, "");

    // 调用 report-engine 解析模板结构
    const parseRes = await fetch(`${REPORT_ENGINE_URL}/parse-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_path: "" }), // 先保存文件再解析
    });
    // 注意：需要先保存文件才能解析，所以这里分两步

    const template = await db.reportTemplate.create({
      data: { userId, name, originalFilename: file.name, filePath: "", parsedStructure: {} },
    });

    const meta = await saveReportTemplateFile(buffer, file.name, template.id);

    // 保存文件后调用 report-engine 解析
    const parseResult = await fetch(`${REPORT_ENGINE_URL}/parse-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_path: meta.filePath }),
    });

    let parsedStructure = {};
    if (parseResult.ok) {
      const parseData = await parseResult.json();
      parsedStructure = parseData.structure || {};
    }

    await db.reportTemplate.update({
      where: { id: template.id },
      data: { filePath: meta.filePath, parsedStructure },
    });

    return {
      success: true,
      data: {
        id: template.id,
        name,
        originalFilename: file.name,
        parsedStructure,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    };
  } catch (e: any) {
    return { success: false, error: { code: "CREATE_FAILED", message: e.message || "创建报告模板失败" } };
  }
}

export async function deleteReportTemplate(
  id: string,
  userId: string
): Promise<ServiceResult<void>> {
  try {
    const template = await db.reportTemplate.findUnique({ where: { id } });
    if (!template || template.userId !== userId) {
      return { success: false, error: { code: "NOT_FOUND", message: "报告模板不存在" } };
    }
    await db.reportTemplate.delete({ where: { id } });
    await deleteReportTemplateFile(template.filePath);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: { code: "DELETE_FAILED", message: "删除报告模板失败" } };
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/modules/reports/services/report-template.service.ts
git commit -m "feat(reports): add report template service"
```

---

### Task 8: 报告草稿 Service

**Files:**
- Create: `src/modules/reports/services/report-draft.service.ts`

- [ ] **Step 1: 创建草稿 service**

```typescript
import { db } from "@/lib/db";
import { ReportTemplateStructure } from "../types";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const REPORT_ENGINE_URL = process.env.REPORT_ENGINE_URL || "http://localhost:8066";

function initDraftSections(structure: ReportTemplateStructure): Record<string, any[]> {
  const sections: Record<string, any[]> = {};
  for (const s of structure.sections) {
    sections[s.id] = [];
  }
  return sections;
}

function initSectionEnabled(structure: ReportTemplateStructure): Record<string, boolean> {
  const enabled: Record<string, boolean> = {};
  for (const s of structure.sections) {
    enabled[s.id] = true;
  }
  return enabled;
}

function initContext(structure: ReportTemplateStructure): Record<string, string> {
  const ctx: Record<string, string> = {};
  for (const v of structure.context_vars) {
    ctx[v] = "";
  }
  return ctx;
}

export async function listReportDrafts(userId: string): Promise<ServiceResult<any[]>> {
  try {
    const drafts = await db.reportDraft.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, status: true,
        createdAt: true, updatedAt: true,
        template: { select: { id: true, name: true } },
      },
    });
    return {
      success: true,
      data: drafts.map((d) => ({
        ...d,
        templateId: d.template.id,
        templateName: d.template.name,
      })),
    };
  } catch {
    return { success: false, error: { code: "LIST_FAILED", message: "获取报告草稿列表失败" } };
  }
}

export async function getReportDraft(id: string, userId: string): Promise<ServiceResult<any>> {
  try {
    const draft = await db.reportDraft.findUnique({
      where: { id },
      include: {
        template: {
          select: { id: true, name: true, filePath: true, parsedStructure: true },
        },
      },
    });
    if (!draft || draft.userId !== userId) {
      return { success: false, error: { code: "NOT_FOUND", message: "报告草稿不存在" } };
    }
    return {
      success: true,
      data: {
        id: draft.id,
        title: draft.title,
        templateId: draft.templateId,
        template: draft.template,
        context: draft.context as Record<string, string>,
        sections: draft.sections as Record<string, any[]>,
        attachments: draft.attachments as Record<string, any[]>,
        sectionEnabled: draft.sectionEnabled as Record<string, boolean>,
        status: draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      },
    };
  } catch {
    return { success: false, error: { code: "GET_FAILED", message: "获取报告草稿失败" } };
  }
}

export async function createReportDraft(
  userId: string,
  templateId: string,
  title?: string
): Promise<ServiceResult<any>> {
  try {
    const template = await db.reportTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.userId !== userId) {
      return { success: false, error: { code: "NOT_FOUND", message: "报告模板不存在" } };
    }
    const structure = template.parsedStructure as unknown as ReportTemplateStructure;
    const draft = await db.reportDraft.create({
      data: {
        userId,
        templateId,
        title: title || `未命名报告`,
        context: initContext(structure),
        sections: initDraftSections(structure),
        sectionEnabled: initSectionEnabled(structure),
      },
    });
    return { success: true, data: { id: draft.id, title: draft.title } };
  } catch (e: any) {
    return { success: false, error: { code: "CREATE_FAILED", message: e.message || "创建报告草稿失败" } };
  }
}

export async function updateReportDraft(
  id: string,
  userId: string,
  data: {
    title?: string;
    context?: Record<string, string>;
    sections?: Record<string, any[]>;
    attachments?: Record<string, any[]>;
    sectionEnabled?: Record<string, boolean>;
  }
): Promise<ServiceResult<void>> {
  try {
    const draft = await db.reportDraft.findUnique({ where: { id } });
    if (!draft || draft.userId !== userId) {
      return { success: false, error: { code: "NOT_FOUND", message: "报告草稿不存在" } };
    }
    await db.reportDraft.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.context !== undefined && { context: data.context }),
        ...(data.sections !== undefined && { sections: data.sections }),
        ...(data.attachments !== undefined && { attachments: data.attachments }),
        ...(data.sectionEnabled !== undefined && { sectionEnabled: data.sectionEnabled }),
      },
    });
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: { code: "UPDATE_FAILED", message: "更新报告草稿失败" } };
  }
}

export async function deleteReportDraft(
  id: string,
  userId: string
): Promise<ServiceResult<void>> {
  try {
    const draft = await db.reportDraft.findUnique({ where: { id } });
    if (!draft || draft.userId !== userId) {
      return { success: false, error: { code: "NOT_FOUND", message: "报告草稿不存在" } };
    }
    await db.reportDraft.delete({ where: { id } });
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: { code: "DELETE_FAILED", message: "删除报告草稿失败" } };
  }
}

export async function exportReportDraft(
  id: string,
  userId: string
): Promise<ServiceResult<Response>> {
  try {
    const draft = await db.reportDraft.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!draft || draft.userId !== userId) {
      return { success: false, error: { code: "NOT_FOUND", message: "报告草稿不存在" } };
    }

    const structure = draft.template.parsedStructure as unknown as ReportTemplateStructure;
    const payload = buildPayload(
      {
        context: draft.context as Record<string, string>,
        sections: draft.sections as Record<string, any[]>,
        attachments: draft.attachments as Record<string, any[]>,
        sectionEnabled: draft.sectionEnabled as Record<string, boolean>,
      },
      structure
    );

    const response = await fetch(`${REPORT_ENGINE_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_path: draft.template.filePath,
        payload,
        output_filename: `${draft.title}.docx`,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: { code: "EXPORT_FAILED", message: err } };
    }

    return { success: true, data: response as any };
  } catch (e: any) {
    return { success: false, error: { code: "EXPORT_FAILED", message: e.message || "导出报告失败" } };
  }
}

function buildPayload(
  draftData: {
    context: Record<string, string>;
    sections: Record<string, any[]>;
    attachments: Record<string, any[]>;
    sectionEnabled: Record<string, boolean>;
  },
  structure: ReportTemplateStructure
): any {
  const sections = structure.sections.map((secMeta) => {
    const blocks = draftData.sections[secMeta.id] || [];
    return {
      id: secMeta.id,
      placeholder: secMeta.placeholder,
      flag_name: secMeta.flag_name,
      enabled: draftData.sectionEnabled[secMeta.id] ?? true,
      blocks,
    };
  });

  return {
    context: draftData.context,
    sections,
    attachments: [],
    attachments_bundle: structure.attachments_bundle
      ? { enabled: true, ...structure.attachments_bundle }
      : null,
    style_map: {},
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add src/modules/reports/services/report-draft.service.ts
git commit -m "feat(reports): add report draft service"
```

---

## Phase 3: Backend API Routes

### Task 9: 报告模板 API 路由

**Files:**
- Create: `src/app/api/reports/templates/route.ts`

- [ ] **Step 1: 创建模板 API 路由**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as reportTemplateService from "@/modules/reports/services/report-template.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const result = await reportTemplateService.listReportTemplates(session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest) {
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
    const result = await reportTemplateService.createReportTemplate(session.user.id, file);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: e.message } }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建模板删除路由**

Create `src/app/api/reports/templates/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as reportTemplateService from "@/modules/reports/services/report-template.service";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  const result = await reportTemplateService.deleteReportTemplate(id, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/api/reports/
git commit -m "feat(reports): add report template API routes"
```

---

### Task 10: 报告草稿 API 路由

**Files:**
- Create: `src/app/api/reports/drafts/route.ts`
- Create: `src/app/api/reports/drafts/[id]/route.ts`

- [ ] **Step 1: 创建草稿列表/创建路由**

`src/app/api/reports/drafts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createReportDraftSchema } from "@/modules/reports/validators";
import * as draftService from "@/modules/reports/services/report-draft.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const result = await draftService.listReportDrafts(session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  try {
    const body = createReportDraftSchema.parse(await request.json());
    const result = await draftService.createReportDraft(session.user.id, body.templateId, body.title);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e: any) {
    if ("issues" in e) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "参数校验失败" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: e.message } }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建草稿 CRUD 路由**

`src/app/api/reports/drafts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateReportDraftSchema } from "@/modules/reports/validators";
import * as draftService from "@/modules/reports/services/report-draft.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  const result = await draftService.getReportDraft(id, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = updateReportDraftSchema.parse(await request.json());
    const result = await draftService.updateReportDraft(id, session.user.id, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if ("issues" in e) {
      return NextResponse.json({ error: { code: "VALIDATION", message: "参数校验失败" } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: e.message } }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  const result = await draftService.deleteReportDraft(id, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 创建导出路由**

`src/app/api/reports/drafts/[id]/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as draftService from "@/modules/reports/services/report-draft.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }
  const { id } = await params;
  const result = await draftService.exportReportDraft(id, session.user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  // 将 report-engine 的响应转发给客户端
  const response = result.data as any as Response;
  const headers = new Headers();
  headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const disposition = response.headers.get("content-disposition");
  if (disposition) headers.set("Content-Disposition", disposition);

  return new Response(response.body, { status: 200, headers });
}
```

- [ ] **Step 4: 提交**

```bash
git add src/app/api/reports/drafts/
git commit -m "feat(reports): add report draft API routes"
```

---

### Task 11: AI 聊天路由

**Files:**
- Create: `src/app/api/reports/chat/route.ts`

- [ ] **Step 1: 创建 AI 聊天代理路由**

从 report-template 的 `web/app/api/chat/route.ts` 移植，调整导入路径：

```typescript
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";

const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60;

function stripDeleteFromToolDefs(toolDefs: Record<string, any>) {
  const patched = JSON.parse(JSON.stringify(toolDefs));
  for (const tool of Object.values(patched)) {
    const items = (tool as any)?.inputSchema?.properties?.operations?.items;
    if (items?.anyOf) {
      items.anyOf = items.anyOf.filter(
        (opt: any) => !(opt.properties?.type?.enum?.includes("delete"))
      );
    }
  }
  return patched;
}

const extraSystemPrompt = `
CRITICAL: When modifying an existing block (translating, rewriting, etc.), ALWAYS use "update" operation type. NEVER use "delete" to remove a block and then "add" to replace it. Using "delete" will destroy the block and cause errors.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, toolDefinitions } = body;

    const model = openai.chat(process.env.OPENAI_MODEL || "gpt-4o", {
      structuredOutputs: false,
    });

    const patchedToolDefs = stripDeleteFromToolDefs(toolDefinitions);
    const injected = injectDocumentStateMessages(messages);
    const modelMessages = await convertToModelMessages(injected);

    const result = streamText({
      model,
      system: aiDocumentFormats.html.systemPrompt + extraSystemPrompt,
      messages: modelMessages,
      tools: toolDefinitionsToToolSet(patchedToolDefs),
      toolChoice: "required",
      providerOptions: {
        openai: { enable_thinking: false },
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (e: any) {
    console.error("[Report AI Chat Error]", e?.message || e);
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/reports/chat/
git commit -m "feat(reports): add BlockNote AI chat proxy route"
```

---

### Task 12: 报告图片上传路由

**Files:**
- Create: `src/app/api/reports/upload/image/route.ts`

- [ ] **Step 1: 创建图片上传路由**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/reports/upload/
git commit -m "feat(reports): add report image upload route"
```

---

## Phase 4: Frontend Infrastructure

### Task 13: BlockNote Schema 和自定义块

**Files:**
- Create: `src/modules/reports/schema/blocknote-schema.ts`
- Create: `src/modules/reports/components/editor/MermaidBlock.tsx`
- Create: `src/modules/reports/components/editor/MermaidPreview.tsx`
- Create: `src/modules/reports/components/editor/TableCaptionBlock.tsx`

- [ ] **Step 1: 从 report-template 复制自定义块组件**

```bash
cp /home/z/codebase/report-template/web/components/editor/MermaidBlock.tsx src/modules/reports/components/editor/
cp /home/z/codebase/report-template/web/components/editor/MermaidPreview.tsx src/modules/reports/components/editor/
cp /home/z/codebase/report-template/web/components/editor/TableCaptionBlock.tsx src/modules/reports/components/editor/
```

在 MermaidBlock 和 TableCaptionBlock 中修改导入路径，将 `./MermaidPreview` 保持不变（同目录下）。

- [ ] **Step 2: 创建 BlockNote schema**

`src/modules/reports/schema/blocknote-schema.ts`:

```typescript
import { BlockNoteSchema } from "@blocknote/core";
import { MermaidBlockSpec } from "@/modules/reports/components/editor/MermaidBlock";
import { TableCaptionBlockSpec } from "@/modules/reports/components/editor/TableCaptionBlock";

export const reportSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    mermaidBlock: MermaidBlockSpec(),
    tableCaption: TableCaptionBlockSpec(),
  },
});
```

- [ ] **Step 3: 提交**

```bash
git add src/modules/reports/schema/ src/modules/reports/components/editor/
git commit -m "feat(reports): add BlockNote custom schema and blocks"
```

---

### Task 14: BlockNote ↔ report-engine 转换器

**Files:**
- Create: `src/modules/reports/converter/engine-to-blocknote.ts`
- Create: `src/modules/reports/converter/blocknote-to-engine.ts`

- [ ] **Step 1: 复制 engine-to-blocknote 转换器**

```bash
cp /home/z/codebase/report-template/web/lib/converter/engine-to-blocknote.ts src/modules/reports/converter/
```

无需修改，直接可用。

- [ ] **Step 2: 复制 Python converter 的 Node.js 等价逻辑**

`src/modules/reports/converter/blocknote-to-engine.ts` — 将 `server/services/converter.py` 中的 `convert_blocknote_blocks` 逻辑移植为 TypeScript：

```typescript
export interface EngineBlock {
  type: string;
  [key: string]: any;
}

function extractText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((s: any) => typeof s === "object" && s.text)
      .map((s: any) => s.text)
      .join("");
  }
  return "";
}

function hasInlineStyles(content: any[]): boolean {
  return content.some((seg: any) => typeof seg === "object" && seg.styles && Object.keys(seg.styles).length > 0);
}

export function convertBlocknoteToEngine(blocks: any[]): EngineBlock[] {
  const result: EngineBlock[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    if (!block || typeof block !== "object" || !block.type) { i++; continue; }

    switch (block.type) {
      case "heading":
        result.push({
          type: "heading",
          text: extractText(block.content),
          level: block.props?.level || 2,
        });
        break;

      case "paragraph": {
        const content = block.content || [];
        if (hasInlineStyles(content)) {
          result.push({
            type: "rich_paragraph",
            segments: content.map((seg: any) => ({
              text: seg.text || "",
              ...(seg.styles?.bold && { bold: true }),
              ...(seg.styles?.italic && { italic: true }),
            })),
          });
        } else {
          result.push({ type: "paragraph", text: extractText(content) });
        }
        break;
      }

      case "bulletListItem": {
        const items: string[] = [];
        while (i < blocks.length && blocks[i]?.type === "bulletListItem") {
          items.push(extractText(blocks[i].content));
          i++;
        }
        result.push({ type: "bullet_list", items });
        continue;
      }

      case "numberedListItem": {
        const items: string[] = [];
        while (i < blocks.length && blocks[i]?.type === "numberedListItem") {
          items.push(extractText(blocks[i].content));
          i++;
        }
        result.push({ type: "numbered_list", items });
        continue;
      }

      case "table": {
        const tableContent = block.content;
        const rows: string[][] = [];
        if (tableContent?.rows) {
          for (const row of tableContent.rows) {
            rows.push((row.cells || []).map((cell: any) => extractText(cell.content)));
          }
        }
        if (rows.length > 0) {
          result.push({
            type: "table",
            title: "",
            headers: rows[0],
            rows: rows.slice(1),
          });
        }
        break;
      }

      case "tableCaption": {
        const captionText = block.props?.text || "";
        if (captionText && result.length > 0 && result[result.length - 1].type === "table") {
          result[result.length - 1].title = captionText;
        }
        break;
      }

      case "quote":
        result.push({ type: "quote", text: extractText(block.content) });
        break;

      case "codeBlock": {
        const code = extractText(block.content);
        const lang = block.props?.language || "";
        if (lang === "mermaid") {
          result.push({ type: "mermaid", code });
        } else {
          result.push({ type: "code_block", code });
        }
        break;
      }

      case "image": {
        const url = block.props?.url || block.props?.src || "";
        if (url) {
          result.push({ type: "image", path: url, caption: block.props?.caption || "" });
        }
        break;
      }

      case "mermaidBlock":
        result.push({ type: "mermaid", code: block.props?.code || "" });
        break;

      case "divider":
        result.push({ type: "horizontal_rule" });
        break;

      case "checkListItem": {
        const items: string[] = [];
        const checked: boolean[] = [];
        while (i < blocks.length && blocks[i]?.type === "checkListItem") {
          items.push(extractText(blocks[i].content));
          checked.push(!!blocks[i].props?.checked);
          i++;
        }
        result.push({ type: "checklist", items, checked });
        continue;
      }
    }
    i++;
  }

  return result;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/modules/reports/converter/
git commit -m "feat(reports): add BlockNote converter (engine ↔ blocknote)"
```

---

### Task 15: 报告草稿 Zustand Store

**Files:**
- Create: `src/modules/reports/stores/report-draft-store.ts`

- [ ] **Step 1: 创建 store**

基于 report-template 的 `draft-store.ts` 改写，将 axios API 调用替换为 fetch（使用 Next.js 的相对路径）：

```typescript
import { create } from "zustand";
import { payloadToDraftSections } from "@/modules/reports/converter/engine-to-blocknote";

interface DraftData {
  id: string;
  title: string;
  templateId: string;
  template: {
    id: string;
    name: string;
    filePath: string;
    parsedStructure: any;
  };
  context: Record<string, string>;
  sections: Record<string, any[]>;
  attachments: Record<string, any[]>;
  sectionEnabled: Record<string, boolean>;
  status: string;
}

interface Payload {
  context?: Record<string, string>;
  sections?: { id: string; blocks: any[]; enabled?: boolean }[];
}

interface ReportDraftStore {
  draft: DraftData | null;
  activeSection: string;
  isDirty: boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";

  loadDraft: (id: string) => Promise<void>;
  setActiveSection: (id: string) => void;
  updateSection: (id: string, blocks: any[]) => void;
  updateContext: (key: string, value: string) => void;
  updateTitle: (title: string) => void;
  toggleSection: (id: string) => void;
  save: () => Promise<void>;
  exportDocx: () => Promise<void>;
  importPayload: (payload: Payload) => void;
}

export const useReportDraftStore = create<ReportDraftStore>((set, get) => ({
  draft: null,
  activeSection: "",
  isDirty: false,
  saveStatus: "idle",

  loadDraft: async (id) => {
    const res = await fetch(`/api/reports/drafts/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || "加载失败");
    const sectionIds = Object.keys(json.data.sections);
    set({
      draft: json.data,
      activeSection: sectionIds[0] || "",
      isDirty: false,
      saveStatus: "idle",
    });
  },

  setActiveSection: (id) => set({ activeSection: id }),

  updateSection: (id, blocks) => {
    const { draft } = get();
    if (!draft) return;
    set({
      draft: { ...draft, sections: { ...draft.sections, [id]: blocks } },
      isDirty: true,
      saveStatus: "idle",
    });
  },

  updateContext: (key, value) => {
    const { draft } = get();
    if (!draft) return;
    set({
      draft: { ...draft, context: { ...draft.context, [key]: value } },
      isDirty: true,
      saveStatus: "idle",
    });
  },

  updateTitle: (title) => {
    const { draft } = get();
    if (!draft) return;
    set({ draft: { ...draft, title }, isDirty: true, saveStatus: "idle" });
  },

  toggleSection: (id) => {
    const { draft } = get();
    if (!draft) return;
    const sectionEnabled = { ...draft.sectionEnabled, [id]: !draft.sectionEnabled[id] };
    set({ draft: { ...draft, sectionEnabled }, isDirty: true, saveStatus: "idle" });
  },

  save: async () => {
    const { draft } = get();
    if (!draft) return;
    set({ saveStatus: "saving" });
    try {
      const res = await fetch(`/api/reports/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          context: draft.context,
          sections: draft.sections,
          attachments: draft.attachments,
          sectionEnabled: draft.sectionEnabled,
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      set({ isDirty: false, saveStatus: "saved" });
    } catch {
      set({ saveStatus: "error" });
    }
  },

  exportDocx: async () => {
    const { draft, save } = get();
    if (!draft) return;
    await save();
    const res = await fetch(`/api/reports/drafts/${draft.id}/export`, { method: "POST" });
    if (!res.ok) throw new Error("导出失败");
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.title}.docx`;
    a.click();
    window.URL.revokeObjectURL(url);
  },

  importPayload: (payload: Payload) => {
    const { draft } = get();
    if (!draft) return;

    const newSections = payloadToDraftSections(payload, draft.sections, draft.sectionEnabled);

    const newContext: Record<string, string> = { ...draft.context };
    if (payload.context) {
      for (const [key, value] of Object.entries(payload.context)) {
        if (key in newContext) newContext[key] = value;
      }
    }

    const newSectionEnabled = { ...draft.sectionEnabled };
    if (payload.sections) {
      for (const sec of payload.sections) {
        if (sec.id in newSectionEnabled && sec.enabled !== undefined) {
          newSectionEnabled[sec.id] = sec.enabled;
        }
      }
    }

    set({
      draft: { ...draft, sections: newSections, context: newContext, sectionEnabled: newSectionEnabled },
      isDirty: true,
      saveStatus: "idle",
    });
  },
}));
```

- [ ] **Step 2: 提交**

```bash
git add src/modules/reports/stores/
git commit -m "feat(reports): add report draft Zustand store"
```

---

## Phase 5: Frontend Components & Pages

### Task 16: 编辑器核心组件

**Files:**
- Create: `src/modules/reports/components/editor/SectionEditor.tsx`
- Create: `src/modules/reports/components/editor/OutlinePanel.tsx`

- [ ] **Step 1: 复制并适配 SectionEditor**

从 `/home/z/codebase/report-template/web/components/editor/SectionEditor.tsx` 复制到 `src/modules/reports/components/editor/SectionEditor.tsx`。

关键修改点：
1. 导入路径：`@/lib/schema` → `@/modules/reports/schema/blocknote-schema`
2. 上传 URL：`/api/upload/image` → `/api/reports/upload/image`
3. AI transport API：`/api/chat` → `/api/reports/chat`

```bash
cp /home/z/codebase/report-template/web/components/editor/SectionEditor.tsx src/modules/reports/components/editor/SectionEditor.tsx
```

然后修改文件中的导入路径和 URL：

```typescript
// 修改 schema 导入
import { reportSchema } from "@/modules/reports/schema/blocknote-schema";
// 使用 reportSchema 替代 schema

// 修改 AI transport
const aiTransport = new DefaultChatTransport({ api: "/api/reports/chat" });

// 修改图片上传 URL
const res = await fetch("/api/reports/upload/image", { ... });
```

- [ ] **Step 2: 复制 OutlinePanel**

```bash
cp /home/z/codebase/report-template/web/components/editor/OutlinePanel.tsx src/modules/reports/components/editor/OutlinePanel.tsx
```

此文件无需修改导入路径。

- [ ] **Step 3: 提交**

```bash
git add src/modules/reports/components/editor/SectionEditor.tsx src/modules/reports/components/editor/OutlinePanel.tsx
git commit -m "feat(reports): add SectionEditor and OutlinePanel components"
```

---

### Task 17: 报告模块 Layout

**Files:**
- Create: `src/app/(reports)/layout.tsx`
- Create: `src/app/(reports)/page.tsx`

- [ ] **Step 1: 创建报告路由组 layout**

`src/app/(reports)/layout.tsx` — 复用 dashboard 的同一布局结构：

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SessionProvider } from "@/components/providers/session-provider";

export const dynamic = "force-dynamic";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <SessionProvider session={session}>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 flex flex-col overflow-y-auto bg-transparent p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
```

- [ ] **Step 2: 创建根页面（重定向）**

`src/app/(reports)/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function ReportsPage() {
  redirect("/reports/drafts");
}
```

- [ ] **Step 3: 提交**

```bash
git add src/app/\(reports\)/
git commit -m "feat(reports): add reports route group layout"
```

---

### Task 18: 更新侧边栏导航

**Files:**
- Modify: `src/components/layout/navigation/schema.ts`

- [ ] **Step 1: 添加报告模块导航项**

在 `NAV_ITEMS` 数组中，在 `drafts`（order 3）之后添加报告模块分组。添加新的 `NavSection` 类型和导航项：

首先更新 `NavSection` 类型：

```typescript
export type NavSection = "main" | "reports" | "admin";
```

然后在 `NAV_ITEMS` 中添加（在 `drafts` 条目之后）：

```typescript
  // 报告撰写模块
  { id: "report-drafts", icon: FileText, href: "/reports/drafts", label: "撰写报告", section: "reports", order: 3.5 },
  { id: "report-templates", icon: LayoutGrid, href: "/reports/templates", label: "报告模板", section: "reports", order: 3.6 },
```

注意：需要在文件顶部添加 `FileText` 和 `LayoutGrid` 的导入（如果尚未导入）。`FileText` 已有导入，`LayoutGrid` 也已有导入，无需额外添加。

- [ ] **Step 2: 验证导航项显示**

Run: `npm run dev` 并检查侧边栏是否正确显示报告模块分组。

- [ ] **Step 3: 提交**

```bash
git add src/components/layout/navigation/schema.ts
git commit -m "feat(reports): add report module navigation items"
```

---

### Task 19: 报告模板管理页面

**Files:**
- Create: `src/app/(reports)/templates/page.tsx`

- [ ] **Step 1: 创建模板列表页面**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReportTemplate {
  id: string;
  name: string;
  originalFilename: string;
  createdAt: string;
}

export default function ReportTemplatesPage() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/templates")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setTemplates(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/reports/templates", { method: "POST", body: formData });
    const json = await res.json();
    if (json.success) setTemplates((prev) => [json.data, ...prev]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此模板？")) return;
    await fetch(`/api/reports/templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreateDraft = async (templateId: string) => {
    const res = await fetch("/api/reports/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const json = await res.json();
    if (json.success) {
      window.location.href = `/reports/drafts/${json.data.id}`;
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">报告模板</h1>
        <label className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          上传模板
          <input type="file" accept=".docx" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {templates.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          暂无报告模板，请上传 .docx 模板文件
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-medium">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.originalFilename}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleCreateDraft(t.id)}
                  className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  创建报告
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="rounded border border-border px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/\(reports\)/templates/
git commit -m "feat(reports): add report templates management page"
```

---

### Task 20: 报告草稿列表页面

**Files:**
- Create: `src/app/(reports)/drafts/page.tsx`

- [ ] **Step 1: 创建草稿列表页面**

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReportDraft {
  id: string;
  title: string;
  templateName: string;
  status: string;
  updatedAt: string;
}

export default function ReportDraftsPage() {
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/drafts")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setDrafts(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此草稿？")) return;
    await fetch(`/api/reports/drafts/${id}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">报告草稿</h1>
        <Link
          href="/reports/templates"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          从模板创建
        </Link>
      </div>

      {drafts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          暂无报告草稿，请从模板创建
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
              <div>
                <Link href={`/reports/drafts/${d.id}`} className="font-medium hover:underline">
                  {d.title}
                </Link>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  模板：{d.templateName} · 更新于 {new Date(d.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="rounded border border-border px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/\(reports\)/drafts/page.tsx
git commit -m "feat(reports): add report drafts list page"
```

---

### Task 21: 报告编辑器页面

**Files:**
- Create: `src/app/(reports)/drafts/[id]/page.tsx`

- [ ] **Step 1: 创建编辑器页面**

基于 report-template 的 `web/app/drafts/[id]/page.tsx` 改写，使用本项目的 store 和组件路径：

```typescript
"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useReportDraftStore } from "@/modules/reports/stores/report-draft-store";
import { SectionEditor } from "@/modules/reports/components/editor/SectionEditor";
import { OutlinePanel } from "@/modules/reports/components/editor/OutlinePanel";
import { ReportTemplateStructure, ReportSectionMeta } from "@/modules/reports/types";

export default function ReportEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    draft, activeSection, isDirty, saveStatus,
    loadDraft, setActiveSection, updateSection,
    updateContext, updateTitle, toggleSection, save, exportDocx,
  } = useReportDraftStore();

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDraft(params.id).finally(() => setLoading(false));
  }, [params.id, loadDraft]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const { isDirty, save: doSave } = useReportDraftStore.getState();
      if (isDirty) doSave();
    }, 3000);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  if (!draft) return <div className="p-8 text-center text-destructive">草稿不存在</div>;

  const structure = draft.template.parsedStructure as unknown as ReportTemplateStructure;
  const sections = structure.sections || [];
  const currentBlocks = draft.sections[activeSection] || [];

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-4 sm:-m-6">
      {/* 左侧：章节面板 */}
      <div className="w-60 shrink-0 border-r border-border bg-card overflow-y-auto">
        <div className="p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            章节
          </h3>
          <div className="space-y-1">
            {sections.map((sec) => (
              <div key={sec.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!draft.sectionEnabled[sec.id]}
                  onChange={() => { toggleSection(sec.id); scheduleAutoSave(); }}
                  className="rounded border-border"
                />
                <button
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex-1 text-left text-sm px-2 py-1 rounded ${
                    activeSection === sec.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  {sec.title || sec.id}
                </button>
              </div>
            ))}
          </div>

          {structure.context_vars?.length > 0 && (
            <>
              <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                上下文变量
              </h3>
              <div className="space-y-2">
                {structure.context_vars.map((key) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground">{key}</label>
                    <input
                      type="text"
                      value={draft.context[key] || ""}
                      onChange={(e) => { updateContext(key, e.target.value); scheduleAutoSave(); }}
                      className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 中间：编辑器 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center gap-4">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => { updateTitle(e.target.value); scheduleAutoSave(); }}
            className="text-xl font-semibold bg-transparent border-none outline-none"
            placeholder="报告标题"
          />
          <span className="text-xs text-muted-foreground">
            {saveStatus === "saving" ? "保存中..." : saveStatus === "saved" ? "已保存" : saveStatus === "error" ? "保存失败" : ""}
          </span>
        </div>
        <SectionEditor
          blocks={currentBlocks}
          onChange={(blocks) => { updateSection(activeSection, blocks); scheduleAutoSave(); }}
        />
      </div>

      {/* 右侧：大纲面板 */}
      <div className="w-48 shrink-0 border-l border-border bg-card overflow-y-auto">
        <OutlinePanel sections={draft.sections} sectionEnabled={draft.sectionEnabled} />
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 right-0 flex items-center gap-2 border-t border-border bg-card px-6 py-3"
           style={{ left: "var(--sidebar-width, 16rem)" }}>
        <button
          onClick={() => router.push("/reports/drafts")}
          className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted"
        >
          返回
        </button>
        <button
          onClick={save}
          className="rounded border border-border px-4 py-1.5 text-sm hover:bg-muted"
        >
          保存
        </button>
        <button
          onClick={exportDocx}
          className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          导出 .docx
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/app/\(reports\)/drafts/\[id\]/
git commit -m "feat(reports): add report editor page with BlockNote"
```

---

## Phase 6: Integration & Verification

### Task 22: 添加 REPORT_ENGINE_URL 环境变量

**Files:**
- Modify: `.env.local` (或 `.env.example`)

- [ ] **Step 1: 添加环境变量**

在 `.env.local` 中添加：

```
REPORT_ENGINE_URL=http://localhost:8066
```

- [ ] **Step 2: 提交**

```bash
git add .env.local 2>/dev/null || true
git commit -m "feat(reports): add REPORT_ENGINE_URL env variable" --allow-empty
```

---

### Task 23: 类型检查和编译验证

- [ ] **Step 1: 运行 TypeScript 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新增类型错误。如果有错误，修复导入路径或类型定义。

- [ ] **Step 2: 运行 lint**

Run: `npm run lint`
Expected: 无 lint 错误。

- [ ] **Step 3: 运行开发构建**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 4: 提交所有修复**

```bash
git add -A
git commit -m "fix(reports): resolve type and lint errors"
```

---

### Task 24: 端到端测试

**前置条件：** report-engine 服务正在运行（`cd report-engine && .venv/bin/python main.py`）

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 2: 测试模板上传**

1. 访问 `/reports/templates`
2. 上传一个 .docx 模板文件（可从 `/home/z/codebase/report-template/templates/` 获取测试模板）
3. 验证模板出现在列表中
4. 检查数据库中 `parsedStructure` 字段是否有正确的 sections/context_vars

- [ ] **Step 3: 测试草稿创建和编辑**

1. 点击"创建报告"
2. 验证跳转到编辑器页面
3. 验证章节面板显示正确
4. 在编辑器中输入内容
5. 验证 3 秒后自动保存
6. 刷新页面验证内容持久化

- [ ] **Step 4: 测试 AI 辅助**

1. 在编辑器中选中文字
2. 触发 AI 操作（改写/翻译）
3. 验证 AI 流式响应正常

- [ ] **Step 5: 测试导出**

1. 点击"导出 .docx"
2. 验证文件下载成功
3. 打开 .docx 验证内容正确

- [ ] **Step 6: 提交最终状态**

```bash
git add -A
git commit -m "feat(reports): complete report writing module integration"
```
