# 模板截图功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 为模板添加截图功能，支持在上传模板时添加截图，并在"我要填表"页面卡片中显示缩略图

**架构：** 在 Template 模型添加 screenshot 字段，文件存储在 `public/uploads/templates/` 目录，通过独立 API 处理上传/删除

**技术栈：** Next.js 16, Prisma, TypeScript, React

---

## 文件结构

```
修改文件:
- prisma/schema.prisma                          # 添加 screenshot 字段
- src/lib/services/template.service.ts          # 添加 updateScreenshot, deleteScreenshot 方法
- src/app/api/templates/[id]/screenshot/route.ts # 新建截图上传/删除 API
- src/components/templates/template-wizard.tsx  # 上传模板页面添加截图上传
- src/app/(dashboard)/generate/page.tsx         # 查询时包含 screenshot
- src/app/(dashboard)/generate/generate-page-client.tsx # 卡片显示缩略图+弹窗
- src/app/(dashboard)/templates/[id]/page.tsx   # 详情页显示截图
```

---

## Task 1: 数据库添加 screenshot 字段

**Files:**
- Modify: `prisma/schema.prisma:163-192`

- [ ] **Step 1: 添加字段到 Template 模型**

在 `model Template {` 中添加 `screenshot` 字段：

```prisma
model Template {
  id            String          @id @default(cuid())
  name          String
  description   String?
  screenshot    String?         // 截图文件路径，相对于 public/uploads
  fileName          String
  // ... 其他字段保持不变
}
```

- [ ] **Step 2: 推送数据库变更**

```bash
npx prisma db push
```

- [ ] **Step 3: 提交**

```bash
git add prisma/schema.prisma
git commit -m "feat(template): add screenshot field to Template model"
```

---

## Task 2: 添加截图 Service 方法

**Files:**
- Modify: `src/lib/services/template.service.ts:238-294`

- [ ] **Step 1: 在 template.service.ts 末尾添加方法**

在 `changeStatus` 函数后添加：

```typescript
export async function updateScreenshot(
  id: string,
  screenshotPath: string
): Promise<ServiceResult<TemplateListItem>> {
  try {
    const template = await db.template.update({
      where: { id },
      data: { screenshot: screenshotPath },
      include: {
        category: { select: { name: true } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    });
    return { success: true, data: mapTemplateToListItem(template) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新截图失败";
    return { success: false, error: { code: "UPDATE_SCREENSHOT_FAILED", message } };
  }
}

export async function deleteScreenshot(id: string): Promise<ServiceResult<TemplateListItem>> {
  try {
    const template = await db.template.findUnique({ where: { id } });
    if (template?.screenshot) {
      // 删除物理文件
      const filePath = join(process.cwd(), "public", template.screenshot);
      await deleteFile(filePath).catch(() => {});
    }

    const updated = await db.template.update({
      where: { id },
      data: { screenshot: null },
      include: {
        category: { select: { name: true } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    });
    return { success: true, data: mapTemplateToListItem(updated) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除截图失败";
    return { success: false, error: { code: "DELETE_SCREENSHOT_FAILED", message } };
  }
}
```

- [ ] **Step 2: 添加 import**

文件顶部添加：

```typescript
import { join } from "path";
import { deleteFile } from "@/lib/file.service";
```

- [ ] **Step 3: 提交**

```bash
git add src/lib/services/template.service.ts
git commit -m "feat(template): add updateScreenshot and deleteScreenshot methods"
```

---

## Task 3: 创建截图上传/删除 API

**Files:**
- Create: `src/app/api/templates/[id]/screenshot/route.ts`

- [ ] **Step 1: 创建 API 文件**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add src/app/api/templates/[id]/screenshot/route.ts
git commit -m "feat(api): add screenshot upload/delete API"
```

---

## Task 4: 更新 getTemplate 返回 screenshot

**Files:**
- Modify: `src/lib/services/template.service.ts:128-185`

- [ ] **Step 1: 修改 getTemplate 返回 screenshot**

在 `getTemplate` 函数中，在 return 语句中添加 `screenshot` 字段：

```typescript
return {
  success: true,
  data: {
    ...mapTemplateToListItem(template),
    categoryId: template.categoryId,
    description: template.description,
    screenshot: template.screenshot,  // 添加这行
    // ... 其他字段
  },
};
```

- [ ] **Step 2: 修改 mapTemplateToListItem 添加 screenshot 字段**

```typescript
function mapTemplateToListItem(row: {
  id: string;
  name: string;
  fileName: string;
  originalFileName: string;
  fileSize: number;
  status: string;
  createdAt: Date;
  screenshot?: string | null;  // 添加
  category?: { name: string } | null;
  tags?: { tag: { id: string; name: string } }[] | null;
}): TemplateListItem {
  return {
    id: row.id,
    name: row.name,
    fileName: row.fileName,
    originalFileName: row.originalFileName,
    fileSize: row.fileSize,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    screenshot: row.screenshot ?? null,  // 添加这行
    categoryName: row.category?.name ?? null,
    tags: (row.tags ?? []).map((t) => ({ id: t.tag.id, name: t.tag.name })),
  };
}
```

- [ ] **Step 3: 修改 TemplateListItem 类型**

`src/types/template/index.ts` 中添加 `screenshot` 字段。

- [ ] **Step 4: 提交**

```bash
git add src/lib/services/template.service.ts src/types/template/index.ts
git commit -m "feat(template): include screenshot in getTemplate response"
```

---

## Task 5: 更新"我要填表"页面查询

**Files:**
- Modify: `src/app/(dashboard)/generate/page.tsx`

- [ ] **Step 1: 查询时包含 screenshot**

```typescript
db.template.findMany({
  where: { status: "PUBLISHED" },
  select: {
    id: true,
    name: true,
    screenshot: true,  // 添加
    categoryId: true,
    createdAt: true,
    category: { select: { name: true } },
    tags: { select: { tag: { id: true, name: true } } },
    currentVersion: { select: { version: true } },
  },
  // ...
})
```

- [ ] **Step 2: 提交**

```bash
git add src/app/(dashboard)/generate/page.tsx
git commit -m "feat(generate): include screenshot in template query"
```

---

## Task 6: 上传模板页面添加截图上传组件

**Files:**
- Modify: `src/components/templates/template-wizard.tsx`

- [ ] **Step 1: 添加截图上传区域状态**

在组件中添加：

```typescript
const [screenshot, setScreenshot] = useState<string | null>(null);
const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
const screenshotInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 2: 处理截图上传**

```typescript
const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  if (!["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"].includes(file.type)) {
    toast.error("仅支持 png, jpg, jpeg, webp, gif 格式");
    return;
  }
  
  // 本地预览
  const reader = new FileReader();
  reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
  reader.readAsDataURL(file);
  setScreenshot(file);
};

const handleScreenshotPaste = useCallback((e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  
  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
        setScreenshot(file);
      }
      break;
    }
  }
}, []);
```

- [ ] **Step 3: 上传截图到服务器**

在 `handleStep1Submit` 中，创建模板后上传截图：

```typescript
// 创建模板后上传截图
if (screenshot && newId) {
  const formData = new FormData();
  formData.append("screenshot", screenshot);
  await fetch(`/api/templates/${newId}/screenshot`, {
    method: "POST",
    body: formData,
  });
}
```

编辑模式下也需要处理截图上传。

- [ ] **Step 4: 在 Step 1 渲染截图上传区域**

在文件上传区域后添加：

```typescript
{/* Screenshot Upload */}
<div className="space-y-2">
  <label className="text-sm font-medium">模板截图（可选）</label>
  <div
    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
      screenshotPreview
        ? "border-primary/50 bg-primary/5"
        : "border-border hover:border-primary/50 hover:bg-muted/50"
    }`}
    onClick={() => screenshotInputRef.current?.click()}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") screenshotInputRef.current?.click();
    }}
    tabIndex={0}
    role="button"
  >
    {screenshotPreview ? (
      <div className="relative w-full">
        <img src={screenshotPreview} alt="截图预览" className="mx-auto max-h-32 object-contain" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setScreenshot(null);
            setScreenshotPreview(null);
          }}
          className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white"
        >
          ×
        </button>
      </div>
    ) : (
      <>
        <Image className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">点击选择图片或 Ctrl+V 粘贴</p>
      </>
    )}
  </div>
  <input
    ref={screenshotInputRef}
    type="file"
    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
    className="hidden"
    onChange={handleScreenshotChange}
  />
</div>
```

需要导入 `Image` 图标和 `useCallback`。

- [ ] **Step 5: 加载编辑模板时显示已有截图**

在 `fetchTemplateInfo` 中获取 screenshot 并设置状态。

- [ ] **Step 6: 提交**

```bash
git add src/components/templates/template-wizard.tsx
git commit -m "feat(wizard): add screenshot upload to template wizard"
```

---

## Task 7: "我要填表"页面卡片显示缩略图

**Files:**
- Modify: `src/app/(dashboard)/generate/generate-page-client.tsx`

- [ ] **Step 1: 添加类型和状态**

```typescript
interface TemplateItem {
  // ... existing fields
  screenshot: string | null;
}

const [lightboxImage, setLightboxImage] = useState<string | null>(null);
```

- [ ] **Step 2: 卡片渲染添加截图缩略图**

在 `CardContent` 开始处添加：

```tsx
{t.screenshot && (
  <div 
    className="relative -mx-4 -mt-4 cursor-pointer overflow-hidden"
    onClick={(e) => {
      e.preventDefault();
      setLightboxImage(t.screenshot);
    }}
  >
    <img 
      src={t.screenshot} 
      alt={t.name} 
      className="h-28 w-full object-cover"
    />
  </div>
)}
```

- [ ] **Step 3: 添加 Lightbox Modal**

在组件末尾添加：

```tsx
{lightboxImage && (
  <div 
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
    onClick={() => setLightboxImage(null)}
  >
    <img src={lightboxImage} alt="预览" className="max-h-[90vh] max-w-[90vw] object-contain" />
    <button 
      className="absolute top-4 right-4 text-white text-2xl"
      onClick={() => setLightboxImage(null)}
    >
      ×
    </button>
  </div>
)}
```

- [ ] **Step 4: 提交**

```bash
git add src/app/(dashboard)/generate/generate-page-client.tsx
git commit -m "feat(generate): add screenshot thumbnail to template cards"
```

---

## Task 8: 模板详情页显示截图

**Files:**
- Modify: `src/app/(dashboard)/templates/[id]/page.tsx`

- [ ] **Step 1: 在页面中获取并显示 screenshot**

参考 generate-page-client 的实现，在模板信息区域显示截图。

- [ ] **Step 2: 提交**

```bash
git add src/app/(dashboard)/templates/[id]/page.tsx
git commit -m "feat(template): show screenshot on template detail page"
```

---

## Task 9: 整体测试

- [ ] **Step 1: 运行类型检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: 运行 lint**

```bash
npm run lint
```

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "feat: complete template screenshot feature"
```

---

## 执行方式

**Plan complete and saved to `docs/superpowers/plans/2026-04-08-template-screenshot.md`. Two execution options:**

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**