# 模板管理重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将模板管理从分散的多页面流程重构为分步向导，引入版本管理（发布快照），实现暂存/发布/再发布的工作流。

**Architecture:** Template 保留编辑态数据，新增 TemplateVersion 存储发布快照。发布通过 Prisma 交互式事务 + SELECT FOR UPDATE 保证并发安全。前端用 3 步向导（上传 → 配置占位符 → 确认发布）合并现有上传页和配置页。

**Tech Stack:** Next.js 16 + Prisma 7 + PostgreSQL + shadcn/ui v4 (Base UI)

**Spec:** `docs/superpowers/specs/2026-03-27-template-management-redesign.md`

**CLAUDE.md 项目约定：**
- 服务层返回 `ServiceResult<T>`（`{ success, data } | { success, error }`）
- Prisma v7：`import { db } from "@/lib/db"`，枚举 `import from "@/generated/prisma/enums"`
- 动态路由参数是 Promise：`const { id } = await params`
- shadcn/ui v4 Button 用 `render` prop 代替 `asChild`
- 文件上传目录由 `UPLOAD_DIR` 环境变量控制，默认 `public/uploads`

---

### Task 1: Prisma Schema 变更 + 数据迁移

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/constants.ts`
- Create: `scripts/migrate-template-versions.ts`

- [ ] **Step 1: 修改 Prisma Schema**

在 `prisma/schema.prisma` 中：

1. 将 `TemplateStatus` 枚举的 `READY` 改为 `PUBLISHED`
2. 在 `Template` 模型中：
   - 移除 `fileName` 字段
   - 新增 `currentVersionId String?`
   - 新增 `currentVersion TemplateVersion? @relation("CurrentVersion", fields: [currentVersionId], references: [id])`
   - 新增 `versions TemplateVersion[]`
   - 新增索引 `@@index([status, createdAt(sort: Desc)])`
3. 新增 `TemplateVersion` 模型：

```prisma
model TemplateVersion {
  id                  String          @id @default(cuid())
  version             Int
  fileName            String
  filePath            String
  originalFileName    String
  fileSize            Int
  publishedAt         DateTime        @default(now())
  placeholderSnapshot Json
  dataTableId         String?
  dataTable           DataTable?      @relation(fields: [dataTableId], references: [id])
  fieldMapping        Json?
  publishedById       String
  publishedBy         User            @relation(fields: [publishedById], references: [id])
  templateId          String
  template            Template        @relation(fields: [templateId], references: [id], onDelete: Cascade)
  records             Record[]
  batchGenerations    BatchGeneration[]

  @@unique([templateId, version])
  @@index([templateId, version(sort: Desc)])
}
```

4. 在 `Record` 模型中新增：
```prisma
  templateVersionId   String?
  templateVersion     TemplateVersion?  @relation(fields: [templateVersionId], references: [id])
```

5. 在 `BatchGeneration` 模型中新增：
```prisma
  templateVersionId   String?
  templateVersion     TemplateVersion?  @relation(fields: [templateVersionId], references: [id])
```

- [ ] **Step 2: 更新 constants.ts**

修改 `src/lib/constants.ts`，将 `READY` 改为 `PUBLISHED`：

```typescript
export const TEMPLATE_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;
```

- [ ] **Step 3: 执行数据库迁移**

由于项目使用 `prisma db push`（无迁移文件），需要手动处理枚举变更：

```bash
# 1. 先添加新枚举值（保留旧的 READY）
psql -U $POSTGRES_USER -d $POSTGRES_DB -c "ALTER TYPE \"TemplateStatus\" ADD VALUE IF NOT EXISTS 'PUBLISHED';"

# 2. 推送 schema（创建 TemplateVersion 表、新字段）
npx prisma db push

# 3. 生成 Prisma Client
npx prisma generate
```

- [ ] **Step 4: 编写数据迁移脚本**

创建 `scripts/migrate-template-versions.ts`，手动执行一次性迁移：

```typescript
// 此脚本需要手动执行：npx tsx scripts/migrate-template-versions.ts
import { PrismaClient } from "./src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. 获取所有现有模板
  const templates = await prisma.template.findMany({
    include: { placeholders: { orderBy: { sortOrder: "asc" } } },
  });

  for (const template of templates) {
    // 2. 创建模板目录（如果不存在）
    const fs = await import("fs/promises");
    const path = await import("path");
    const uploadDir = process.env.UPLOAD_DIR || "public/uploads";
    const templateDir = path.join(process.cwd(), uploadDir, "templates", template.id);
    await fs.mkdir(templateDir, { recursive: true });

    // 3. 迁移文件到新目录结构
    const draftPath = path.join(templateDir, "draft.docx");
    const existingFile = template.filePath;
    if (existingFile && !existingFile.includes(template.id + "/")) {
      // 旧路径格式: uploads/templates/{id}.docx
      await fs.copyFile(existingFile, draftPath).catch(() => {});
    }

    // 4. 如果是 READY 状态，创建 v1 版本快照
    if (template.status === "READY") {
      const versionPath = path.join(templateDir, "v1.docx");
      await fs.copyFile(existingFile || draftPath, versionPath).catch(() => {});

      const snapshot = template.placeholders.map(p => ({
        key: p.key,
        label: p.label,
        inputType: p.inputType,
        required: p.required,
        defaultValue: p.defaultValue,
        sortOrder: p.sortOrder,
        enablePicker: p.enablePicker,
        sourceTableId: p.sourceTableId,
        sourceField: p.sourceField,
        snapshotVersion: 1,
      }));

      const version = await prisma.templateVersion.create({
        data: {
          version: 1,
          fileName: "v1.docx",
          filePath: versionPath,
          originalFileName: template.originalFileName || template.fileName,
          fileSize: template.fileSize,
          placeholderSnapshot: snapshot,
          dataTableId: template.dataTableId,
          fieldMapping: template.fieldMapping,
          publishedById: template.createdById,
          templateId: template.id,
        },
      });

      await prisma.template.update({
        where: { id: template.id },
        data: {
          currentVersionId: version.id,
          status: "PUBLISHED",
          filePath: draftPath,
        },
      });

      console.log(`✅ ${template.name}: migrated to PUBLISHED v1`);
    } else {
      // DRAFT / ARCHIVED: 只迁移文件路径
      await prisma.template.update({
        where: { id: template.id },
        data: { filePath: draftPath },
      });
      console.log(`✅ ${template.name}: migrated file path (${template.status})`);
    }
  }

  // 5. 删除旧的 READY 枚举值
  await prisma.$executeRaw`ALTER TYPE "TemplateStatus" DROP VALUE 'READY'`;
  console.log("\n✅ Migration complete. 'READY' enum value dropped.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: 执行迁移脚本**

```bash
npx tsx scripts/migrate-template-versions.ts
```

- [ ] **Step 6: 更新 changeStatus 函数签名**

修改 `src/lib/services/template.service.ts` 的 `changeStatus`，将类型从 `"DRAFT" | "READY" | "ARCHIVED"` 改为 `"DRAFT" | "PUBLISHED" | "ARCHIVED"`。

- [ ] **Step 7: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma src/lib/constants.ts src/lib/services/template.service.ts scripts/migrate-template-versions.ts
git commit -m "feat: add TemplateVersion model and migrate READY to PUBLISHED"
```

---

### Task 2: Types + Validators 层

**Files:**
- Modify: `src/types/template.ts`
- Modify: `src/types/placeholder.ts`

- [ ] **Step 1: 新增 PlaceholderSnapshotItem 类型**

在 `src/types/placeholder.ts` 末尾新增：

```typescript
export interface PlaceholderSnapshotItem {
  key: string;
  label: string;
  inputType: "TEXT" | "TEXTAREA";
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  enablePicker: boolean;
  sourceTableId: string | null;
  sourceField: string | null;
  snapshotVersion: 1;
}
```

- [ ] **Step 2: 新增版本相关类型**

修改 `src/types/template.ts`，新增以下类型：

```typescript
// 版本列表项
export interface TemplateVersionListItem {
  version: number;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  publishedAt: string;
  publishedByName: string;
  placeholderCount: number;
}

// 版本详情
export interface TemplateVersionDetail extends TemplateVersionListItem {
  id: string;
  placeholderSnapshot: PlaceholderSnapshotItem[];
  dataTableId: string | null;
  dataTable?: { id: string; name: string };
  fieldMapping: TemplateFieldMapping | null;
}
```

同时在顶部 import 中添加 `PlaceholderSnapshotItem`。

- [ ] **Step 3: 调整 TemplateListItem**

`TemplateListItem` 中的 `fileName` 字段改为可选（因为设计决策是移除 Template.fileName，但实际上 `createTemplate` 仍会生成文件名，暂时保留以避免大面积改动）：

保持 `fileName: string` 不变。后续向导重构阶段再决定是否调整。

- [ ] **Step 4: 扩展 TemplateWithRelation**

在 `TemplateWithRelation` 中新增版本信息：

```typescript
export interface TemplateWithRelation extends TemplateDetail {
  dataTableId: string | null;
  dataTable?: { id: string; name: string };
  fieldMapping: TemplateFieldMapping | null;
  currentVersion?: {
    id: string;
    version: number;
    publishedAt: string;
    publishedByName: string;
  } | null;
}
```

- [ ] **Step 5: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/types/template.ts src/types/placeholder.ts
git commit -m "feat: add version types and PlaceholderSnapshotItem"
```

---

### Task 3: file.service.ts 新增版本文件方法

**Files:**
- Modify: `src/lib/file.service.ts`

- [ ] **Step 1: 新增 saveTemplateDraft 方法**

在 `src/lib/file.service.ts` 中新增：

```typescript
export async function saveTemplateDraft(
  templateId: string,
  buffer: Buffer,
  originalName: string
): Promise<FilePathMeta> {
  const dir = join(process.cwd(), UPLOAD_DIR, "templates", templateId);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const fileName = "draft.docx";
  const filePath = join(dir, fileName);
  await writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    urlPath: `/${UPLOAD_DIR}/templates/${templateId}/${fileName}`,
  };
}
```

- [ ] **Step 2: 新增 copyToVersion 方法**

```typescript
export async function copyToVersion(
  templateId: string,
  version: number
): Promise<FilePathMeta> {
  const dir = join(process.cwd(), UPLOAD_DIR, "templates", templateId);
  const draftPath = join(dir, "draft.docx");
  const fileName = `v${version}.docx`;
  const versionPath = join(dir, fileName);

  if (!existsSync(draftPath)) {
    throw new Error(`编辑态文件不存在: ${draftPath}`);
  }

  await copyFile(draftPath, versionPath);

  return {
    fileName,
    filePath: versionPath,
    urlPath: `/${UPLOAD_DIR}/templates/${templateId}/${fileName}`,
  };
}
```

- [ ] **Step 3: 新增 deleteTemplateDir 方法**

```typescript
import { rm } from "fs/promises";

export async function deleteTemplateDir(templateId: string): Promise<void> {
  const dir = join(process.cwd(), UPLOAD_DIR, "templates", templateId);
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
}
```

需要在顶部 import 中添加 `rm`。

- [ ] **Step 4: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/file.service.ts
git commit -m "feat: add saveTemplateDraft, copyToVersion, deleteTemplateDir to file service"
```

---

### Task 4: template-version.service.ts 新建

**Files:**
- Create: `src/lib/services/template-version.service.ts`

- [ ] **Step 1: 创建 template-version.service.ts**

```typescript
import { db } from "@/lib/db";
import { copyToVersion } from "@/lib/file.service";
import type { PlaceholderSnapshotItem } from "@/types/placeholder";
import type {
  TemplateVersionListItem,
  TemplateVersionDetail,
} from "@/types/template";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

function mapVersionListItem(row: {
  version: number;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  publishedAt: Date;
  publishedBy: { name: string };
  placeholderSnapshot: unknown;
}): TemplateVersionListItem {
  const snapshot = (row.placeholderSnapshot as PlaceholderSnapshotItem[] | null) ?? [];
  return {
    version: row.version,
    fileName: row.fileName,
    originalFileName: row.originalFileName,
    fileSize: row.fileSize,
    publishedAt: row.publishedAt.toISOString(),
    publishedByName: row.publishedBy.name,
    placeholderCount: snapshot.length,
  };
}

export async function publishTemplate(
  templateId: string,
  userId: string
): Promise<ServiceResult<{ version: number; publishedAt: string }>> {
  try {
    const result = await db.$transaction(async (tx) => {
      // 1. 锁定模板行
      const [template] = await tx.$queryRaw<
        Array<{
          id: string;
          name: string;
          filePath: string;
          originalFileName: string;
          fileSize: number;
          status: string;
          dataTableId: string | null;
          fieldMapping: unknown;
        }>
      >`SELECT id, name, "filePath", "originalFileName", "fileSize", status, "dataTableId", "fieldMapping" FROM "Template" WHERE id = ${templateId} FOR UPDATE`;

      if (!template) {
        throw new Error("NOT_FOUND");
      }

      // 2. 获取占位符配置
      const placeholders = await tx.placeholder.findMany({
        where: { templateId },
        orderBy: { sortOrder: "asc" },
      });

      if (placeholders.length === 0) {
        throw new Error("NO_PLACEHOLDERS");
      }

      // 3. 计算下一版本号
      const maxVersion = await tx.templateVersion.aggregate({
        where: { templateId },
        _max: { version: true },
      });
      const nextVersion = (maxVersion._max.version ?? 0) + 1;

      // 4. 复制文件到版本目录
      const fileMeta = await copyToVersion(templateId, nextVersion);

      // 5. 序列化占位符快照
      const snapshot: PlaceholderSnapshotItem[] = placeholders.map((p) => ({
        key: p.key,
        label: p.label,
        inputType: p.inputType as "TEXT" | "TEXTAREA",
        required: p.required,
        defaultValue: p.defaultValue,
        sortOrder: p.sortOrder,
        enablePicker: p.enablePicker,
        sourceTableId: p.sourceTableId,
        sourceField: p.sourceField,
        snapshotVersion: 1 as const,
      }));

      // 6. 创建版本记录
      const version = await tx.templateVersion.create({
        data: {
          version: nextVersion,
          fileName: fileMeta.fileName,
          filePath: fileMeta.filePath,
          originalFileName: template.originalFileName,
          fileSize: template.fileSize,
          placeholderSnapshot: snapshot,
          dataTableId: template.dataTableId,
          fieldMapping: template.fieldMapping,
          publishedById: userId,
          templateId,
        },
      });

      // 7. 更新模板状态
      await tx.template.update({
        where: { id: templateId },
        data: {
          currentVersionId: version.id,
          status: "PUBLISHED",
        },
      });

      return { version: nextVersion, publishedAt: version.publishedAt };
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return { success: false, error: { code: "NOT_FOUND", message: "模板不存在" } };
      }
      if (error.message === "NO_PLACEHOLDERS") {
        return { success: false, error: { code: "NO_PLACEHOLDERS", message: "模板至少需要一个占位符才能发布" } };
      }
    }
    const message = error instanceof Error ? error.message : "发布模板失败";
    return { success: false, error: { code: "PUBLISH_FAILED", message } };
  }
}

export async function getVersionHistory(
  templateId: string
): Promise<ServiceResult<TemplateVersionListItem[]>> {
  try {
    const versions = await db.templateVersion.findMany({
      where: { templateId },
      orderBy: { version: "desc" },
      include: { publishedBy: { select: { name: true } } },
    });

    return {
      success: true,
      data: versions.map(mapVersionListItem),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取版本历史失败";
    return { success: false, error: { code: "LIST_FAILED", message } };
  }
}

export async function getVersionDetail(
  templateId: string,
  version: number
): Promise<ServiceResult<TemplateVersionDetail>> {
  try {
    const v = await db.templateVersion.findUnique({
      where: { templateId_version: { templateId, version } },
      include: {
        publishedBy: { select: { name: true } },
        dataTable: { select: { id: true, name: true } },
      },
    });

    if (!v) {
      return { success: false, error: { code: "NOT_FOUND", message: "版本不存在" } };
    }

    const snapshot = (v.placeholderSnapshot as PlaceholderSnapshotItem[] | null) ?? [];

    return {
      success: true,
      data: {
        ...mapVersionListItem(v),
        id: v.id,
        placeholderSnapshot: snapshot,
        dataTableId: v.dataTableId,
        dataTable: v.dataTable ?? undefined,
        fieldMapping: v.fieldMapping as Record<string, string | null> | null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取版本详情失败";
    return { success: false, error: { code: "GET_FAILED", message } };
  }
}
```

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/template-version.service.ts
git commit -m "feat: add template-version service with publish, history, and detail"
```

---

### Task 5: 版本 API 路由

**Files:**
- Create: `src/app/api/templates/[id]/publish/route.ts`
- Create: `src/app/api/templates/[id]/versions/route.ts`
- Create: `src/app/api/templates/[id]/versions/[version]/route.ts`

- [ ] **Step 1: 创建发布 API 路由**

`src/app/api/templates/[id]/publish/route.ts`：

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as templateVersionService from "@/lib/services/template-version.service";

export async function POST(
  _request: Request,
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
  const result = await templateVersionService.publishTemplate(id, session.user.id);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data });
}
```

- [ ] **Step 2: 创建版本列表 API 路由**

`src/app/api/templates/[id]/versions/route.ts`：

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as templateVersionService from "@/lib/services/template-version.service";

export async function GET(
  _request: Request,
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
  const result = await templateVersionService.getVersionHistory(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
```

- [ ] **Step 3: 创建版本详情 API 路由**

`src/app/api/templates/[id]/versions/[version]/route.ts`：

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as templateVersionService from "@/lib/services/template-version.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const { id, version: versionStr } = await params;
  const version = parseInt(versionStr, 10);

  if (isNaN(version) || version < 1) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "版本号无效" } },
      { status: 400 }
    );
  }

  const result = await templateVersionService.getVersionDetail(id, version);

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data });
}
```

- [ ] **Step 4: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/templates/
git commit -m "feat: add publish, version list, and version detail API routes"
```

---

### Task 6: 修改现有 Service 层适配版本

**Files:**
- Modify: `src/lib/services/placeholder.service.ts` (移除 changeStatus)
- Modify: `src/lib/services/template.service.ts` (deleteTemplate 清理目录，createTemplate 使用新文件路径，getTemplate 返回版本信息)
- Modify: `src/lib/services/record.service.ts` (generateDocument 引用 currentVersion)
- Modify: `src/lib/services/batch-generation.service.ts` (generateBatch 引用 currentVersion)

- [ ] **Step 1: placeholder.service.ts — 移除 changeStatus 调用**

在 `src/lib/services/placeholder.service.ts` 的 `updatePlaceholders` 函数中，删除 `await changeStatus(templateId, "READY");` 这一行（约第 189 行），以及顶部的 `import { changeStatus }` 导入。

- [ ] **Step 2: template.service.ts — 修改 createTemplate 使用新文件路径**

将 `createTemplate` 中的 `saveUploadedFile` 改为 `saveTemplateDraft`：

```typescript
import { saveTemplateDraft, deleteTemplateDir } from "@/lib/file.service";
```

```typescript
export async function createTemplate(
  data: { name: string; description?: string; createdById: string },
  fileBuffer: Buffer,
  originalName: string
): Promise<ServiceResult<TemplateListItem>> {
  try {
    const id = crypto.randomUUID();

    const fileMeta = await saveTemplateDraft(id, fileBuffer, originalName);

    const template = await db.template.create({
      data: {
        id,
        name: data.name,
        description: data.description ?? null,
        fileName: fileMeta.fileName,
        originalFileName: originalName,
        filePath: fileMeta.filePath,
        fileSize: fileBuffer.length,
        status: "DRAFT",
        createdById: data.createdById,
      },
    });

    return { success: true, data: mapTemplateToListItem(template) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建模板失败";
    return { success: false, error: { code: "CREATE_FAILED", message } };
  }
}
```

- [ ] **Step 3: template.service.ts — 修改 deleteTemplate 清理版本目录**

```typescript
export async function deleteTemplate(id: string): Promise<ServiceResult<null>> {
  try {
    const template = await db.template.findUnique({ where: { id } });

    if (!template) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "模板不存在" },
      };
    }

    await db.template.delete({ where: { id } });
    await deleteTemplateDir(id);

    return { success: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除模板失败";
    return { success: false, error: { code: "DELETE_FAILED", message } };
  }
}
```

注意：先删除 DB 记录（级联删除版本记录），再清理文件目录。

- [ ] **Step 4: template.service.ts — 修改 getTemplate 返回版本信息**

在 `getTemplate` 的 `include` 中新增 `currentVersion`：

```typescript
const template = await db.template.findUnique({
  where: { id },
  include: {
    placeholders: { orderBy: { sortOrder: "asc" } },
    createdBy: { select: { name: true } },
    dataTable: { select: { id: true, name: true } },
    currentVersion: {
      select: {
        id: true,
        version: true,
        publishedAt: true,
        publishedBy: { select: { name: true } },
      },
    },
  },
});
```

在返回数据中新增 `currentVersion`：

```typescript
return {
  success: true,
  data: {
    ...mapTemplateToListItem(template),
    description: template.description,
    createdById: template.createdById,
    placeholders: template.placeholders.map(mapPlaceholderItem),
    dataTableId: template.dataTableId,
    dataTable: template.dataTable ?? undefined,
    fieldMapping: template.fieldMapping as Record<string, string | null> | null,
    currentVersion: template.currentVersion
      ? {
          id: template.currentVersion.id,
          version: template.currentVersion.version,
          publishedAt: template.currentVersion.publishedAt.toISOString(),
          publishedByName: template.currentVersion.publishedBy.name,
        }
      : null,
  },
};
```

- [ ] **Step 5: record.service.ts — generateDocument 引用 currentVersion**

修改 `generateDocument` 中的模板查询：

```typescript
const record = await db.record.findUnique({
  where: { id: recordId },
  include: {
    template: {
      select: {
        name: true,
        currentVersion: { select: { filePath: true } },
      },
    },
  },
});
```

修改文件路径获取：

```typescript
const templatePath = record.template.currentVersion?.filePath;
if (!templatePath) {
  return {
    success: false,
    error: { code: "NO_VERSION", message: "模板尚未发布，无法生成文档" },
  };
}
```

并在调用 Python 服务时使用 `templatePath` 替代 `record.template.filePath`（第 187 行）。

- [ ] **Step 6: batch-generation.service.ts — generateBatch 引用 currentVersion**

在 `generateBatch` 中修改模板查询，新增 `currentVersion`：

```typescript
const template = await db.template.findUnique({
  where: { id: input.templateId },
  include: {
    placeholders: { orderBy: { sortOrder: "asc" } },
    currentVersion: { select: { id: true, filePath: true } },
  },
});
```

修改文件路径引用（第 376 行）：

```typescript
const templatePath = template.currentVersion?.filePath;
if (!templatePath) {
  return {
    success: false,
    error: { code: "NO_VERSION", message: "模板尚未发布，无法批量生成" },
  };
}
// 使用 templatePath 替代 template.filePath
```

- [ ] **Step 7: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/
git commit -m "feat: adapt services for version-aware document generation"
```

---

### Task 7: 修改前端页面 — 状态映射和权限过滤

**Files:**
- Modify: `src/app/(dashboard)/templates/page.tsx` (READY → PUBLISHED)
- Modify: `src/app/(dashboard)/templates/[id]/page.tsx` (READY → PUBLISHED, 展示版本信息)
- Modify: `src/app/(dashboard)/templates/[id]/fill/page.tsx` (READY → PUBLISHED)
- Modify: `src/app/(dashboard)/templates/[id]/configure/page.tsx` (暂保留，后续删除)

- [ ] **Step 1: 修改模板列表页 — 状态映射**

在 `src/app/(dashboard)/templates/page.tsx` 中，将所有 `READY` 字符串替换为 `PUBLISHED`。包括：
- `STATUS_LABELS` / `STATUS_VARIANTS` 对象中的 key
- 筛选标签的 URL 参数

普通用户权限过滤：在 Server Component 中根据 session.user.role 过滤，非 ADMIN 用户只显示 `status: "PUBLISHED"` 的模板。

- [ ] **Step 2: 修改模板详情页 — 状态映射 + 版本信息**

在 `src/app/(dashboard)/templates/[id]/page.tsx` 中：
- 将所有 `READY` 替换为 `PUBLISHED`
- 在状态 badge 旁显示当前版本号（如果 currentVersion 存在）
- 添加「版本历史」按钮（后续 Task 实现 Dialog）
- 将「配置」按钮改为「编辑」按钮，链接改为 `/templates/[id]/edit`

- [ ] **Step 3: 修改填写表单页 — 状态检查**

在 `src/app/(dashboard)/templates/[id]/fill/page.tsx` 中，将第 27 行：

```typescript
if (!template || template.status !== "READY") {
```

改为：

```typescript
if (!template || template.status !== "PUBLISHED") {
```

- [ ] **Step 4: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/templates/
git commit -m "feat: update frontend pages for PUBLISHED status and version display"
```

---

### Task 8: 版本历史组件

**Files:**
- Create: `src/components/templates/version-history-dialog.tsx`

- [ ] **Step 1: 创建版本历史 Dialog 组件**

创建 `src/components/templates/version-history-dialog.tsx`，功能：
- Props: `templateId`, `open`, `onOpenChange`
- 加载版本历史列表（GET `/api/templates/${templateId}/versions`）
- 点击版本展开详情面板（GET `/api/templates/${templateId}/versions/${version}`）
- 展示：版本号、发布时间、发布者、占位符配置快照表格、关联数据表
- 只读，无编辑按钮

参考现有 `placeholder-config-table.tsx` 的 Dialog 模式，使用 shadcn/ui v4 的 Dialog 组件。

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/templates/version-history-dialog.tsx
git commit -m "feat: add version history dialog component"
```

---

### Task 9: 分步向导组件

**Files:**
- Create: `src/components/templates/template-wizard.tsx`
- Modify: `src/components/templates/placeholder-config-table.tsx` (适配向导 Step 2)

这是最复杂的 Task，建议拆分为子步骤。

- [ ] **Step 1: 创建 TemplateWizard 骨架**

创建 `src/components/templates/template-wizard.tsx`，实现：
- Props: `templateId?: string`（有 id 为编辑模式，无 id 为新建模式）
- 3 步状态管理：`currentStep` (1/2/3)
- StepIndicator 步骤条组件
- 底部操作栏：取消 / 上一步 / 下一步 / 发布

```typescript
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlaceholderConfigTable } from "./placeholder-config-table";

export function TemplateWizard({ templateId }: { templateId?: string }) {
  const [step, setStep] = useState(1);
  const router = useRouter();

  // Step 1 状态
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [createdId, setCreatedId] = useState(templateId ?? "");

  // Step 2 状态
  const [placeholderKey, setPlaceholderKey] = useState(0);

  // Step 3 状态
  const [publishing, setPublishing] = useState(false);

  const isEdit = !!templateId;

  // ... 各步骤的 UI 和处理函数 ...
}
```

- [ ] **Step 2: 实现 Step 1 — 上传文件和基本信息**

- 新建模式：上传 .docx 文件 + 填写名称（必填）和描述
- 编辑模式：从 API 加载现有信息，可替换文件
- 上传调用 POST `/api/templates`（新建）或 PUT `/api/templates/${id}` + 文件上传接口
- 上传成功后自动跳转到 Step 2

- [ ] **Step 3: 实现 Step 2 — 配置占位符**

复用 `PlaceholderConfigTable` 组件。关键适配：
- 移除 PlaceholderConfigTable 中的"保存配置"按钮和"取消"按钮（向导有自己的底部栏）
- 移除保存后跳转到详情页的逻辑
- 将保存操作改为"仅保存，不跳转"：调用 PUT 保存占位符后只显示成功 toast，停留在当前步骤
- 需要在 PlaceholderConfigTable 中添加 prop `hideActions?: boolean` 来控制是否显示底部按钮

修改 `src/components/templates/placeholder-config-table.tsx`：
- 新增 prop `hideActions?: boolean`
- 当 `hideActions` 为 true 时，隐藏底部"取消"和"保存配置"按钮
- `handleSave` 成功后不调用 `router.push`，只显示 toast

- [ ] **Step 4: 实现 Step 3 — 确认发布**

展示摘要信息：
- 模板名称
- 文件名
- 占位符数量（从 API 获取）
- 关联数据表（如果有）
- 下一个版本号提示

两个按钮：
- 「返回编辑」→ `setStep(2)`
- 「发布版本 vX」→ 调用 POST `/api/templates/${id}/publish`，成功后跳转到详情页

- [ ] **Step 5: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/templates/template-wizard.tsx src/components/templates/placeholder-config-table.tsx
git commit -m "feat: add template wizard with 3-step flow"
```

---

### Task 10: 路由替换 + 清理

**Files:**
- Modify: `src/app/(dashboard)/templates/new/page.tsx` (使用向导)
- Create: `src/app/(dashboard)/templates/[id]/edit/page.tsx` (使用向导)
- Delete: `src/app/(dashboard)/templates/[id]/configure/page.tsx`

- [ ] **Step 1: 修改新建模板页面**

修改 `src/app/(dashboard)/templates/new/page.tsx`，替换现有内容为：

```typescript
import { TemplateWizard } from "@/components/templates/template-wizard";

export default function NewTemplatePage() {
  return <TemplateWizard />;
}
```

- [ ] **Step 2: 创建编辑模板页面**

创建 `src/app/(dashboard)/templates/[id]/edit/page.tsx`：

```typescript
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { TemplateWizard } from "@/components/templates/template-wizard";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    notFound();
  }

  const { id } = await params;
  const template = await db.template.findUnique({ where: { id } });
  if (!template) notFound();

  return <TemplateWizard templateId={id} />;
}
```

- [ ] **Step 3: 删除 configure 路由**

删除 `src/app/(dashboard)/templates/[id]/configure/page.tsx` 文件。

- [ ] **Step 4: 更新模板详情页中的链接**

确保模板详情页中的「编辑」按钮链接指向 `/templates/[id]/edit` 而非 `/templates/[id]/configure`。

- [ ] **Step 5: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add -A src/app/(dashboard)/templates/
git commit -m "feat: replace configure route with edit wizard route"
```

---

### Task 11: 浏览器自动化测试

**Files:** 无新文件

- [ ] **Step 1: 启动开发服务器并登录**

```bash
npm run dev
# 使用 playwright-cli 打开 http://localhost:8060
# 登录 admin@example.com / admin123
```

- [ ] **Step 2: 测试模板列表页**

验证：
- 已发布模板显示版本号
- 状态显示"已发布"而非"可用"

- [ ] **Step 3: 测试新建模板向导**

1. 导航到 `/templates/new`
2. Step 1: 上传 .docx 文件，填写名称，点击下一步
3. Step 2: 点击「解析占位符」，配置标签，点击下一步
4. Step 3: 确认摘要，点击「发布版本 v1」
5. 验证跳转到详情页，显示版本号 v1

- [ ] **Step 4: 测试编辑模板并重新发布**

1. 在详情页点击「编辑」
2. 向导加载现有配置
3. 修改标签，点击下一步到 Step 3
4. 点击「发布版本 v2」
5. 验证版本号更新为 v2

- [ ] **Step 5: 测试版本历史**

1. 在详情页点击「版本历史」
2. 验证显示 v1 和 v2
3. 点击 v1 查看快照详情

- [ ] **Step 6: 测试填写表单使用发布版本**

1. 导航到已发布模板的填写表单页
2. 填写表单并生成文档
3. 验证生成成功（使用发布版本的文件）

- [ ] **Step 7: 测试普通用户权限**

1. 登录 user@example.com / user123
2. 验证模板列表只显示 PUBLISHED 模板
3. 验证不显示 DRAFT 模板

- [ ] **Step 8: Commit 测试结果截图（如有）**

```bash
git commit --allow-empty -m "test: browser verification of template management redesign"
```

---

### Task 12: 仪表盘快捷入口和侧边栏适配

**Files:**
- Modify: `src/app/(dashboard)/page.tsx` (确认快捷入口正常)
- Modify: `src/components/layout/sidebar.tsx` (如需调整)

- [ ] **Step 1: 确认仪表盘快捷入口**

检查仪表盘页面的模板相关快捷入口是否正常（链接到 `/templates/new` 或详情页）。

- [ ] **Step 2: 验证编译通过**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit（如有变更）**

```bash
git add src/app/(dashboard)/page.tsx src/components/layout/sidebar.tsx
git commit -m "fix: update dashboard quick links for new template flow"
```
