# Document Collection Task Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone document collection task module that lets initiators assign upload tasks, lets assignees submit multiple historical versions in one slot, and lets initiators package the latest submissions with configurable file renaming.

**Architecture:** Add four new Prisma models for task, reference attachment, assignee slot, and submission version. Implement the module in the existing Next.js structure with thin route handlers, service-layer business logic, Zod validators, shared types, and dashboard pages/components for task creation, detail views, submission uploads, and ZIP download.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Prisma 7, Zod, Vitest, Testing Library, local file storage under `public/uploads`, `archiver` for ZIP generation.

**Repo Constraint:** This repository's AGENTS instructions forbid planning or performing git commit/branch operations unless the user explicitly asks. This plan therefore uses verification checkpoints instead of commit steps.

---

## File Map

### Database and generated types

- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Modify: `src/generated/prisma/client.ts`
- Modify: `src/generated/prisma/enums.ts`
- Modify: `src/generated/prisma/models/*.ts`

### Shared module code

- Create: `src/types/document-collection.ts`
- Create: `src/validators/document-collection.ts`
- Create: `src/lib/utils/document-collection-file-name.ts`
- Create: `src/lib/utils/document-collection-file-name.test.ts`
- Create: `src/lib/services/document-collection-permission.service.ts`
- Create: `src/lib/services/document-collection-task.service.ts`
- Create: `src/lib/services/document-collection-submission.service.ts`
- Create: `src/lib/services/document-collection-download.service.ts`
- Create: `src/lib/services/document-collection-task.service.test.ts`
- Create: `src/lib/services/document-collection-submission.service.test.ts`
- Create: `src/lib/services/document-collection-download.service.test.ts`
- Modify: `src/lib/file.service.ts`

### API routes

- Create: `src/app/api/collections/route.ts`
- Create: `src/app/api/collections/[id]/route.ts`
- Create: `src/app/api/collections/[id]/submissions/route.ts`
- Create: `src/app/api/collections/[id]/submissions/[versionId]/download/route.ts`
- Create: `src/app/api/collections/[id]/download/route.ts`
- Create: `src/app/api/collections/route.test.ts`
- Create: `src/app/api/collections/[id]/route.test.ts`
- Create: `src/app/api/collections/[id]/submissions/route.test.ts`
- Create: `src/app/api/collections/[id]/download/route.test.ts`

### Dashboard pages and components

- Create: `src/app/(dashboard)/collections/page.tsx`
- Create: `src/app/(dashboard)/collections/new/page.tsx`
- Create: `src/app/(dashboard)/collections/[id]/page.tsx`
- Create: `src/components/collections/collection-task-form.tsx`
- Create: `src/components/collections/collection-assignee-picker.tsx`
- Create: `src/components/collections/collection-attachments-upload.tsx`
- Create: `src/components/collections/collection-rename-rule-editor.tsx`
- Create: `src/components/collections/collection-status-badge.tsx`
- Create: `src/components/collections/collection-assignee-table.tsx`
- Create: `src/components/collections/collection-submission-upload.tsx`
- Create: `src/components/collections/collection-version-history.tsx`
- Create: `src/components/collections/collection-task-form.test.tsx`
- Create: `src/components/collections/collection-status-badge.test.tsx`
- Create: `src/components/collections/collection-version-history.test.tsx`
- Modify: `src/components/layout/sidebar.tsx`

### Documentation

- Modify: `README.md`

## Task 1: Extend Prisma schema for document collection tasks

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Write the failing schema assertions as a text checklist in the seed file comment block**

```ts
// Document collection schema checklist:
// 1. User has createdCollectionTasks, assignedCollectionTasks, collectionAttachments, collectionSubmissionVersions relations
// 2. DocumentCollectionTask has attachments and assignees relations
// 3. DocumentCollectionAssignee has latestVersionId unique pointer and versions relation
// 4. DocumentCollectionSubmissionVersion has unique (assigneeId, version)
```

- [ ] **Step 2: Update `prisma/schema.prisma` with the new enum and models**

```prisma
enum DocumentCollectionTaskStatus {
  ACTIVE
  CLOSED
}

model DocumentCollectionTask {
  id              String                       @id @default(cuid())
  title           String
  instruction     String
  dueAt           DateTime
  status          DocumentCollectionTaskStatus @default(ACTIVE)
  renameRule      String
  renameVariables Json?
  createdById     String
  createdBy       User                         @relation("CreatedCollectionTasks", fields: [createdById], references: [id])
  attachments     DocumentCollectionAttachment[]
  assignees       DocumentCollectionAssignee[]
  createdAt       DateTime                     @default(now())
  updatedAt       DateTime                     @updatedAt

  @@index([createdById, createdAt(sort: Desc)])
  @@index([dueAt])
}

model DocumentCollectionAttachment {
  id               String                 @id @default(cuid())
  taskId           String
  task             DocumentCollectionTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  fileName         String
  originalFileName String
  storagePath      String
  fileSize         Int
  mimeType         String
  uploadedById     String
  uploadedBy       User                   @relation("CollectionAttachments", fields: [uploadedById], references: [id])
  createdAt        DateTime               @default(now())

  @@index([taskId])
}

model DocumentCollectionAssignee {
  id              String                              @id @default(cuid())
  taskId          String
  task            DocumentCollectionTask              @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId          String
  user            User                                @relation("AssignedCollectionTasks", fields: [userId], references: [id])
  latestVersionId String?                             @unique
  latestVersion   DocumentCollectionSubmissionVersion? @relation("LatestCollectionSubmissionVersion", fields: [latestVersionId], references: [id])
  submittedAt     DateTime?
  versions        DocumentCollectionSubmissionVersion[]
  createdAt       DateTime                            @default(now())
  updatedAt       DateTime                            @updatedAt

  @@unique([taskId, userId])
  @@index([taskId])
  @@index([userId])
}

model DocumentCollectionSubmissionVersion {
  id                 String                     @id @default(cuid())
  assigneeId         String
  assignee           DocumentCollectionAssignee @relation(fields: [assigneeId], references: [id], onDelete: Cascade)
  version            Int
  fileName           String
  originalFileName   String
  storagePath        String
  fileSize           Int
  mimeType           String
  submittedById      String
  submittedBy        User                       @relation("CollectionSubmissionVersions", fields: [submittedById], references: [id])
  submittedAt        DateTime                   @default(now())
  note               String?
  isLate             Boolean                    @default(false)
  currentForAssignee DocumentCollectionAssignee? @relation("LatestCollectionSubmissionVersion")

  @@unique([assigneeId, version])
  @@index([assigneeId, submittedAt(sort: Desc)])
}
```

- [ ] **Step 3: Extend `User` relations in `prisma/schema.prisma`**

```prisma
model User {
  id                           String    @id @default(cuid())
  name                         String
  email                        String    @unique
  password                     String?
  oidcSubject                  String?   @unique
  role                         Role      @default(USER)
  createdAt                    DateTime  @default(now())
  updatedAt                    DateTime  @updatedAt
  createdCollectionTasks       DocumentCollectionTask[]              @relation("CreatedCollectionTasks")
  assignedCollectionTasks      DocumentCollectionAssignee[]          @relation("AssignedCollectionTasks")
  collectionAttachments        DocumentCollectionAttachment[]        @relation("CollectionAttachments")
  collectionSubmissionVersions DocumentCollectionSubmissionVersion[] @relation("CollectionSubmissionVersions")
  drafts                       Draft[]
  records                      Record[]
}
```

- [ ] **Step 4: Add seed cleanup comments for the new models in `prisma/seed.ts`**

```ts
// No initial document collection seed data.
// The module is user-driven and should start empty in development databases.
```

- [ ] **Step 5: Run Prisma format and schema validation**

Run: `npx prisma format && npx prisma validate`
Expected: schema formats cleanly and validation prints `The schema at prisma/schema.prisma is valid`.

## Task 2: Regenerate Prisma client and verify new model API

**Files:**
- Modify: `src/generated/prisma/client.ts`
- Modify: `src/generated/prisma/enums.ts`
- Modify: `src/generated/prisma/models/*.ts`

- [ ] **Step 1: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: Prisma writes updated generated client files under `src/generated/prisma`.

- [ ] **Step 2: Verify the generated client exposes new model delegates**

Run: `rg -n "documentCollectionTask|documentCollectionAssignee|documentCollectionSubmissionVersion|documentCollectionAttachment" "src/generated/prisma"`
Expected: matches exist in generated client and model files.

- [ ] **Step 3: Verification checkpoint**

Run: `git diff -- prisma/schema.prisma prisma/seed.ts src/generated/prisma | sed -n '1,220p'`
Expected: diff only contains the document collection schema and generated client updates.

## Task 3: Define shared types and validators

**Files:**
- Create: `src/types/document-collection.ts`
- Create: `src/validators/document-collection.ts`
- Test: `src/lib/services/document-collection-task.service.test.ts`

- [ ] **Step 1: Write the failing validator test sketch in `src/lib/services/document-collection-task.service.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  createDocumentCollectionTaskSchema,
  documentCollectionListQuerySchema,
} from "@/validators/document-collection";

describe("document-collection validators", () => {
  it("parses create payload with rename variables and assignees", () => {
    const result = createDocumentCollectionTaskSchema.parse({
      title: "合同扫描件收集",
      instruction: "请上传签字盖章后的扫描件",
      dueAt: "2026-04-10T18:00:00.000Z",
      assigneeIds: ["u1", "u2"],
      renameRule: "{前缀}_{姓名}_{序号}",
      renameVariables: { 前缀: "法务部" },
    });

    expect(result.assigneeIds).toHaveLength(2);
    expect(result.renameVariables).toEqual({ 前缀: "法务部" });
  });
});
```

- [ ] **Step 2: Create `src/types/document-collection.ts`**

```ts
export type DocumentCollectionCurrentStatus =
  | "PENDING"
  | "SUBMITTED"
  | "LATE";

export interface DocumentCollectionRenameVariables {
  [key: string]: string;
}

export interface DocumentCollectionTaskListItem {
  id: string;
  title: string;
  dueAt: string;
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  stats?: {
    totalAssignees: number;
    submittedCount: number;
    pendingCount: number;
    lateCount: number;
  };
  mySubmissionStatus?: DocumentCollectionCurrentStatus;
}

export interface DocumentCollectionVersionItem {
  id: string;
  version: number;
  fileName: string;
  originalFileName: string;
  submittedAt: string;
  note: string | null;
  isLate: boolean;
  submittedBy: {
    id: string;
    name: string;
  };
}
```

- [ ] **Step 3: Create `src/validators/document-collection.ts`**

```ts
import { z } from "zod";

const renameVariablesSchema = z.record(
  z.string().min(1, "变量名不能为空"),
  z.string().min(1, "变量值不能为空")
);

export const createDocumentCollectionTaskSchema = z.object({
  title: z.string().min(1, "任务标题不能为空").max(100, "任务标题不能超过100字"),
  instruction: z.string().min(1, "任务说明不能为空").max(2000, "任务说明不能超过2000字"),
  dueAt: z.string().datetime("截止时间格式不正确"),
  assigneeIds: z.array(z.string().min(1)).min(1, "至少选择一个提交人"),
  renameRule: z.string().min(1, "命名规则不能为空").max(200, "命名规则不能超过200字符"),
  renameVariables: renameVariablesSchema.default({}),
});

export const documentCollectionListQuerySchema = z.object({
  scope: z.enum(["created", "assigned", "all"]).default("all"),
  status: z.enum(["active", "closed"]).optional(),
  search: z.string().trim().optional(),
});

export const createDocumentCollectionSubmissionSchema = z.object({
  note: z.string().max(500, "备注不能超过500字").optional(),
});
```

- [ ] **Step 4: Run the validator-focused test**

Run: `npm run test:run -- src/lib/services/document-collection-task.service.test.ts`
Expected: FAIL first on missing validator/type files, then PASS after implementation.

- [ ] **Step 5: Verification checkpoint**

Run: `git diff -- src/types/document-collection.ts src/validators/document-collection.ts src/lib/services/document-collection-task.service.test.ts`
Expected: diff only adds shared document collection types, validators, and validator tests.

## Task 4: Add file utilities for collection uploads and ZIP naming

**Files:**
- Modify: `src/lib/file.service.ts`
- Create: `src/lib/utils/document-collection-file-name.ts`
- Create: `src/lib/utils/document-collection-file-name.test.ts`

- [ ] **Step 1: Write the failing file-name utility test**

```ts
import { describe, expect, it } from "vitest";
import { buildDocumentCollectionFileName } from "./document-collection-file-name";

describe("buildDocumentCollectionFileName", () => {
  it("replaces task, assignee, system, and custom variables", () => {
    const value = buildDocumentCollectionFileName({
      pattern: "{前缀}_{姓名}_{任务标题}_{序号}",
      index: 1,
      taskTitle: "合同扫描件收集",
      assigneeName: "张三",
      assigneeEmail: "zhangsan@example.com",
      submittedAt: new Date("2026-04-10T12:30:00.000Z"),
      originalFileName: "scan.docx",
      version: 2,
      renameVariables: { 前缀: "法务部" },
    });

    expect(value).toBe("法务部_张三_合同扫描件收集_1.docx");
  });
});
```

- [ ] **Step 2: Create `src/lib/utils/document-collection-file-name.ts`**

```ts
function formatSubmittedAt(date: Date): string {
  const yyyy = date.getFullYear().toString().padStart(4, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function buildDocumentCollectionFileName(input: {
  pattern: string;
  index: number;
  taskTitle: string;
  assigneeName: string;
  assigneeEmail: string;
  submittedAt: Date;
  originalFileName: string;
  version: number;
  renameVariables: Record<string, string>;
}): string {
  const baseName = input.originalFileName.replace(/\.[^.]+$/, "");
  let fileName = input.pattern;

  fileName = fileName.replace(/\{序号\}/g, String(input.index));
  fileName = fileName.replace(/\{提交时间\}/g, formatSubmittedAt(input.submittedAt));
  fileName = fileName.replace(/\{任务标题\}/g, input.taskTitle);
  fileName = fileName.replace(/\{姓名\}/g, input.assigneeName);
  fileName = fileName.replace(/\{邮箱\}/g, input.assigneeEmail);
  fileName = fileName.replace(/\{原始文件名\}/g, baseName);
  fileName = fileName.replace(/\{版本号\}/g, String(input.version));

  for (const [key, value] of Object.entries(input.renameVariables)) {
    fileName = fileName.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  fileName = fileName.replace(/[<>:"/\\|?*]/g, "_").trim();
  return fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
}
```

- [ ] **Step 3: Extend `src/lib/file.service.ts` with collection-specific save helpers**

```ts
export async function saveCollectionTaskAttachment(
  taskId: string,
  attachmentId: string,
  buffer: Buffer,
  originalName: string
): Promise<FilePathMeta> {
  const targetDir = join(process.cwd(), UPLOAD_DIR, "collections", "tasks", taskId);
  if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });

  const ext = originalName.split(".").pop() || "bin";
  const fileName = `${attachmentId}.${ext}`;
  const filePath = join(targetDir, fileName);
  await writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    urlPath: `/${UPLOAD_DIR}/collections/tasks/${taskId}/${fileName}`,
  };
}

export async function saveCollectionSubmissionFile(
  assigneeId: string,
  versionId: string,
  buffer: Buffer,
  originalName: string
): Promise<FilePathMeta> {
  const targetDir = join(process.cwd(), UPLOAD_DIR, "collections", "submissions", assigneeId);
  if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });

  const ext = originalName.split(".").pop() || "bin";
  const fileName = `${versionId}.${ext}`;
  const filePath = join(targetDir, fileName);
  await writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    urlPath: `/${UPLOAD_DIR}/collections/submissions/${assigneeId}/${fileName}`,
  };
}
```

- [ ] **Step 4: Run utility tests**

Run: `npm run test:run -- src/lib/utils/document-collection-file-name.test.ts`
Expected: PASS with the naming test and at least one illegal-character normalization test.

- [ ] **Step 5: Verification checkpoint**

Run: `git diff -- src/lib/file.service.ts src/lib/utils/document-collection-file-name.ts src/lib/utils/document-collection-file-name.test.ts`
Expected: diff only adds collection-specific file save helpers and rename utility coverage.

## Task 5: Implement permission service and task status derivation

**Files:**
- Create: `src/lib/services/document-collection-permission.service.ts`
- Modify: `src/lib/services/document-collection-task.service.test.ts`

- [ ] **Step 1: Add failing permission tests**

```ts
import { describe, expect, it } from "vitest";
import {
  canManageDocumentCollectionTask,
  canViewDocumentCollectionTask,
} from "./document-collection-permission.service";

describe("document-collection permissions", () => {
  it("allows the creator to manage the task", () => {
    expect(
      canManageDocumentCollectionTask({
        taskCreatedById: "user-1",
        currentUserId: "user-1",
      })
    ).toBe(true);
  });

  it("allows assigned users to view but not manage", () => {
    expect(
      canViewDocumentCollectionTask({
        taskCreatedById: "creator-1",
        currentUserId: "user-2",
        assigneeUserIds: ["user-2"],
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Create `src/lib/services/document-collection-permission.service.ts`**

```ts
export function canManageDocumentCollectionTask(input: {
  taskCreatedById: string;
  currentUserId: string;
}): boolean {
  return input.taskCreatedById === input.currentUserId;
}

export function canViewDocumentCollectionTask(input: {
  taskCreatedById: string;
  currentUserId: string;
  assigneeUserIds: string[];
}): boolean {
  return (
    input.taskCreatedById === input.currentUserId ||
    input.assigneeUserIds.includes(input.currentUserId)
  );
}

export function getDocumentCollectionCurrentStatus(input: {
  latestVersionId: string | null;
  latestVersionIsLate: boolean | null;
}): "PENDING" | "SUBMITTED" | "LATE" {
  if (!input.latestVersionId) return "PENDING";
  return input.latestVersionIsLate ? "LATE" : "SUBMITTED";
}
```

- [ ] **Step 3: Run the permission tests**

Run: `npm run test:run -- src/lib/services/document-collection-task.service.test.ts`
Expected: PASS for permission/status derivation cases.

- [ ] **Step 4: Verification checkpoint**

Run: `git diff -- src/lib/services/document-collection-permission.service.ts src/lib/services/document-collection-task.service.test.ts`
Expected: diff only adds creator/assignee permission helpers and status derivation tests.

## Task 6: Implement task creation and list/detail service

**Files:**
- Create: `src/lib/services/document-collection-task.service.ts`
- Modify: `src/lib/services/document-collection-task.service.test.ts`

- [ ] **Step 1: Write the failing service tests for task creation and list aggregation**

```ts
it("creates a task with assignees and rename variables", async () => {
  vi.mocked(db.documentCollectionTask.create).mockResolvedValue({
    id: "task-1",
    title: "合同扫描件收集",
    instruction: "请上传签字盖章后的扫描件",
    dueAt: new Date("2026-04-10T18:00:00.000Z"),
    status: "ACTIVE",
    renameRule: "{前缀}_{姓名}_{序号}",
    renameVariables: { 前缀: "法务部" },
    createdById: "creator-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never);

  const result = await createDocumentCollectionTask({
    title: "合同扫描件收集",
    instruction: "请上传签字盖章后的扫描件",
    dueAt: "2026-04-10T18:00:00.000Z",
    assigneeIds: ["u1", "u2"],
    renameRule: "{前缀}_{姓名}_{序号}",
    renameVariables: { 前缀: "法务部" },
    createdById: "creator-1",
    attachments: [],
  });

  expect(result.success).toBe(true);
});
```

- [ ] **Step 2: Create `src/lib/services/document-collection-task.service.ts` with create/list/detail methods**

```ts
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import {
  canManageDocumentCollectionTask,
  canViewDocumentCollectionTask,
  getDocumentCollectionCurrentStatus,
} from "./document-collection-permission.service";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function createDocumentCollectionTask(input: {
  title: string;
  instruction: string;
  dueAt: string;
  assigneeIds: string[];
  renameRule: string;
  renameVariables: Record<string, string>;
  createdById: string;
  attachments: Array<{
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
  }>;
}): Promise<ServiceResult<{ id: string }>> {
  const dedupedAssigneeIds = [...new Set(input.assigneeIds)];

  const task = await db.documentCollectionTask.create({
    data: {
      title: input.title,
      instruction: input.instruction,
      dueAt: new Date(input.dueAt),
      renameRule: input.renameRule,
      renameVariables: input.renameVariables as Prisma.InputJsonValue,
      createdById: input.createdById,
      assignees: {
        create: dedupedAssigneeIds.map((userId) => ({ userId })),
      },
    },
  });

  return { success: true, data: { id: task.id } };
}
```

- [ ] **Step 3: Add list/detail query methods with role-specific shaping**

```ts
export async function listDocumentCollectionTasks(input: {
  currentUserId: string;
  scope: "created" | "assigned" | "all";
  status?: "active" | "closed";
  search?: string;
}) {
  const where: Prisma.DocumentCollectionTaskWhereInput = {
    ...(input.status
      ? { status: input.status === "active" ? "ACTIVE" : "CLOSED" }
      : {}),
    ...(input.search
      ? { title: { contains: input.search, mode: "insensitive" } }
      : {}),
    ...(input.scope === "created"
      ? { createdById: input.currentUserId }
      : input.scope === "assigned"
        ? { assignees: { some: { userId: input.currentUserId } } }
        : {
            OR: [
              { createdById: input.currentUserId },
              { assignees: { some: { userId: input.currentUserId } } },
            ],
          }),
  };

  const tasks = await db.documentCollectionTask.findMany({
    where,
    include: {
      createdBy: true,
      assignees: {
        include: {
          latestVersion: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true as const,
    data: tasks.map((task) => {
      const myAssignee = task.assignees.find((item) => item.userId === input.currentUserId);
      const lateCount = task.assignees.filter((item) => item.latestVersion?.isLate).length;
      const submittedCount = task.assignees.filter((item) => item.latestVersionId).length;
      return {
        id: task.id,
        title: task.title,
        dueAt: task.dueAt.toISOString(),
        status: task.status,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        createdBy: {
          id: task.createdBy.id,
          name: task.createdBy.name,
          email: task.createdBy.email,
        },
        stats: {
          totalAssignees: task.assignees.length,
          submittedCount,
          pendingCount: task.assignees.length - submittedCount,
          lateCount,
        },
        mySubmissionStatus: myAssignee
          ? getDocumentCollectionCurrentStatus({
              latestVersionId: myAssignee.latestVersionId,
              latestVersionIsLate: myAssignee.latestVersion?.isLate ?? null,
            })
          : undefined,
      };
    }),
  };
}
```

- [ ] **Step 4: Add `getDocumentCollectionTaskDetail`**

```ts
export async function getDocumentCollectionTaskDetail(input: {
  taskId: string;
  currentUserId: string;
}) {
  const task = await db.documentCollectionTask.findUnique({
    where: { id: input.taskId },
    include: {
      createdBy: true,
      attachments: true,
      assignees: {
        include: {
          user: true,
          latestVersion: true,
          versions: {
            include: {
              submittedBy: true,
            },
            orderBy: { version: "desc" },
          },
        },
      },
    },
  });

  if (!task) {
    return { success: false as const, error: { code: "NOT_FOUND", message: "任务不存在" } };
  }

  const visible = canViewDocumentCollectionTask({
    taskCreatedById: task.createdById,
    currentUserId: input.currentUserId,
    assigneeUserIds: task.assignees.map((item) => item.userId),
  });

  if (!visible) {
    return { success: false as const, error: { code: "NOT_FOUND", message: "任务不存在" } };
  }

  const isCreator = canManageDocumentCollectionTask({
    taskCreatedById: task.createdById,
    currentUserId: input.currentUserId,
  });

  const myAssignee = task.assignees.find((item) => item.userId === input.currentUserId) ?? null;

  if (isCreator) {
    return {
      success: true as const,
      data: {
        id: task.id,
        title: task.title,
        instruction: task.instruction,
        dueAt: task.dueAt.toISOString(),
        status: task.status,
        renameRule: task.renameRule,
        renameVariables: (task.renameVariables ?? {}) as Record<string, string>,
        viewerRole: "CREATOR" as const,
        attachments: task.attachments,
        assignees: task.assignees.map((item) => ({
          id: item.id,
          user: {
            id: item.user.id,
            name: item.user.name,
            email: item.user.email,
          },
          status: getDocumentCollectionCurrentStatus({
            latestVersionId: item.latestVersionId,
            latestVersionIsLate: item.latestVersion?.isLate ?? null,
          }),
          latestVersion: item.latestVersion
            ? {
                id: item.latestVersion.id,
                version: item.latestVersion.version,
                originalFileName: item.latestVersion.originalFileName,
                submittedAt: item.latestVersion.submittedAt.toISOString(),
              }
            : null,
          versionCount: item.versions.length,
        })),
      },
    };
  }

  return {
    success: true as const,
    data: {
      id: task.id,
      title: task.title,
      instruction: task.instruction,
      dueAt: task.dueAt.toISOString(),
      status: task.status,
      viewerRole: "ASSIGNEE" as const,
      attachments: task.attachments,
      myVersions: (myAssignee?.versions ?? []).map((version) => ({
        id: version.id,
        version: version.version,
        fileName: version.fileName,
        originalFileName: version.originalFileName,
        submittedAt: version.submittedAt.toISOString(),
        note: version.note,
        isLate: version.isLate,
        submittedBy: {
          id: version.submittedBy.id,
          name: version.submittedBy.name,
        },
      })),
    },
  };
}
```

- [ ] **Step 5: Run service tests**

Run: `npm run test:run -- src/lib/services/document-collection-task.service.test.ts`
Expected: PASS for create/list/detail scenarios, including scope filtering and status derivation.

- [ ] **Step 6: Verification checkpoint**

Run: `git diff -- src/lib/services/document-collection-task.service.ts src/lib/services/document-collection-task.service.test.ts`
Expected: diff only adds create/list/detail service logic and matching tests.

## Task 7: Implement submission service with version history and late marking

**Files:**
- Create: `src/lib/services/document-collection-submission.service.ts`
- Modify: `src/lib/services/document-collection-submission.service.test.ts`

- [ ] **Step 1: Write the failing submission tests**

```ts
it("creates a new submission version and updates latestVersionId", async () => {
  vi.mocked(db.documentCollectionAssignee.findUnique).mockResolvedValue({
    id: "assignee-1",
    taskId: "task-1",
    userId: "user-1",
    latestVersionId: "ver-1",
    task: {
      id: "task-1",
      dueAt: new Date("2026-04-10T10:00:00.000Z"),
      status: "ACTIVE",
      createdById: "creator-1",
    },
    versions: [{ version: 1 }],
  } as never);

  const result = await createDocumentCollectionSubmission({
    taskId: "task-1",
    currentUserId: "user-1",
    file: {
      buffer: Buffer.from("file"),
      originalName: "scan.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 4,
    },
    note: "补交修订版",
    now: new Date("2026-04-10T11:00:00.000Z"),
  });

  expect(result.success).toBe(true);
});
```

- [ ] **Step 2: Create `src/lib/services/document-collection-submission.service.ts`**

```ts
import { db } from "@/lib/db";
import { saveCollectionSubmissionFile } from "@/lib/file.service";
import { Prisma } from "@/generated/prisma/client";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function createDocumentCollectionSubmission(input: {
  taskId: string;
  currentUserId: string;
  file: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
  };
  note?: string;
  now?: Date;
}): Promise<ServiceResult<{ versionId: string }>> {
  const assignee = await db.documentCollectionAssignee.findFirst({
    where: { taskId: input.taskId, userId: input.currentUserId },
    include: {
      task: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!assignee) {
    return { success: false, error: { code: "FORBIDDEN", message: "当前用户不是任务提交人" } };
  }

  if (assignee.task.status === "CLOSED") {
    return { success: false, error: { code: "TASK_CLOSED", message: "任务已关闭，无法继续提交" } };
  }

  const submittedAt = input.now ?? new Date();
  const nextVersion = (assignee.versions[0]?.version ?? 0) + 1;

  const versionId = crypto.randomUUID();
  const saved = await saveCollectionSubmissionFile(
    assignee.id,
    versionId,
    input.file.buffer,
    input.file.originalName
  );

  await db.$transaction(async (tx) => {
    await tx.documentCollectionSubmissionVersion.create({
      data: {
        id: versionId,
        assigneeId: assignee.id,
        version: nextVersion,
        fileName: saved.fileName,
        originalFileName: input.file.originalName,
        storagePath: saved.filePath,
        fileSize: input.file.size,
        mimeType: input.file.mimeType,
        submittedById: input.currentUserId,
        submittedAt,
        note: input.note ?? null,
        isLate: submittedAt > assignee.task.dueAt,
      },
    });

    await tx.documentCollectionAssignee.update({
      where: { id: assignee.id },
      data: {
        latestVersionId: versionId,
        submittedAt,
      },
    });
  });

  return { success: true, data: { versionId } };
}
```

- [ ] **Step 3: Add version-history query method**

```ts
export async function listDocumentCollectionSubmissionVersions(input: {
  taskId: string;
  currentUserId: string;
  assigneeId?: string;
}) {
  const assignee = await db.documentCollectionAssignee.findFirst({
    where: input.assigneeId
      ? { id: input.assigneeId, taskId: input.taskId }
      : { taskId: input.taskId, userId: input.currentUserId },
    include: {
      task: true,
      user: true,
      versions: {
        include: {
          submittedBy: true,
        },
        orderBy: { version: "desc" },
      },
    },
  });

  if (!assignee) {
    return { success: false as const, error: { code: "NOT_FOUND", message: "提交记录不存在" } };
  }

  const canViewOthers =
    assignee.task.createdById === input.currentUserId || assignee.userId === input.currentUserId;
  if (!canViewOthers) {
    return { success: false as const, error: { code: "FORBIDDEN", message: "无权查看提交历史" } };
  }

  return {
    success: true as const,
    data: assignee.versions.map((version) => ({
      id: version.id,
      version: version.version,
      fileName: version.fileName,
      originalFileName: version.originalFileName,
      submittedAt: version.submittedAt.toISOString(),
      note: version.note,
      isLate: version.isLate,
      submittedBy: {
        id: version.submittedBy.id,
        name: version.submittedBy.name,
      },
    })),
  };
}
```

- [ ] **Step 4: Run submission tests**

Run: `npm run test:run -- src/lib/services/document-collection-submission.service.test.ts`
Expected: PASS for version increments, task-closed rejection, and late-submission marking.

- [ ] **Step 5: Verification checkpoint**

Run: `git diff -- src/lib/services/document-collection-submission.service.ts src/lib/services/document-collection-submission.service.test.ts`
Expected: diff only adds versioned submission writes, history reads, and late-marking coverage.

## Task 8: Implement ZIP packaging service

**Files:**
- Create: `src/lib/services/document-collection-download.service.ts`
- Modify: `src/lib/services/document-collection-download.service.test.ts`

- [ ] **Step 1: Write the failing ZIP packaging test**

```ts
it("packages the latest submission for each assignee using the rename rule", async () => {
  const result = await buildDocumentCollectionDownloadPackage({
    taskId: "task-1",
    currentUserId: "creator-1",
  });

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.fileName).toBe("task-1.zip");
  }
});
```

- [ ] **Step 2: Create `src/lib/services/document-collection-download.service.ts`**

```ts
import archiver from "archiver";
import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";
import { UPLOAD_DIR } from "@/lib/constants/upload";
import { buildDocumentCollectionFileName } from "@/lib/utils/document-collection-file-name";
import { generateUniqueFileName } from "@/lib/utils/file-name-builder";

export async function buildDocumentCollectionDownloadPackage(input: {
  taskId: string;
  currentUserId: string;
}) {
  const task = await db.documentCollectionTask.findUnique({
    where: { id: input.taskId },
    include: {
      assignees: {
        include: {
          user: true,
          latestVersion: true,
        },
      },
    },
  });

  if (!task) {
    return { success: false as const, error: { code: "NOT_FOUND", message: "任务不存在" } };
  }

  if (task.createdById !== input.currentUserId) {
    return { success: false as const, error: { code: "FORBIDDEN", message: "无权打包下载" } };
  }

  const versions = task.assignees
    .filter((item) => item.latestVersion)
    .map((item) => ({ assignee: item, version: item.latestVersion! }));

  if (versions.length === 0) {
    return { success: false as const, error: { code: "EMPTY", message: "当前任务暂无已提交文件" } };
  }

  const packagesDir = join(process.cwd(), UPLOAD_DIR, "collections", "packages");
  if (!existsSync(packagesDir)) await mkdir(packagesDir, { recursive: true });

  const zipName = `${task.id}.zip`;
  const zipPath = join(packagesDir, zipName);
  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  const usedNames = new Set<string>();

  archive.pipe(output);

  versions.forEach(({ assignee, version }, index) => {
    const name = generateUniqueFileName(
      buildDocumentCollectionFileName({
        pattern: task.renameRule,
        index: index + 1,
        taskTitle: task.title,
        assigneeName: assignee.user.name,
        assigneeEmail: assignee.user.email,
        submittedAt: version.submittedAt,
        originalFileName: version.originalFileName,
        version: version.version,
        renameVariables: (task.renameVariables ?? {}) as Record<string, string>,
      }),
      usedNames
    );
    usedNames.add(name);
    archive.file(version.storagePath, { name });
  });

  await archive.finalize();

  return {
    success: true as const,
    data: {
      fileName: zipName,
      filePath: zipPath,
      urlPath: `/uploads/collections/packages/${zipName}`,
    },
  };
}
```

- [ ] **Step 3: Run the download service tests**

Run: `npm run test:run -- src/lib/services/document-collection-download.service.test.ts`
Expected: PASS for empty-package rejection, rename-variable replacement, and same-name deduplication.

- [ ] **Step 4: Verification checkpoint**

Run: `git diff -- src/lib/services/document-collection-download.service.ts src/lib/services/document-collection-download.service.test.ts`
Expected: diff only adds ZIP packaging logic and rename/deduplication tests.

## Task 9: Add collections API route handlers

**Files:**
- Create: `src/app/api/collections/route.ts`
- Create: `src/app/api/collections/[id]/route.ts`
- Create: `src/app/api/collections/[id]/submissions/route.ts`
- Create: `src/app/api/collections/[id]/submissions/[versionId]/download/route.ts`
- Create: `src/app/api/collections/[id]/download/route.ts`
- Create: `src/app/api/collections/route.test.ts`
- Create: `src/app/api/collections/[id]/route.test.ts`
- Create: `src/app/api/collections/[id]/submissions/route.test.ts`
- Create: `src/app/api/collections/[id]/download/route.test.ts`

- [ ] **Step 1: Write the failing route tests**

```ts
describe("POST /api/collections", () => {
  it("returns 401 for unauthenticated requests", async () => {
    const response = await POST(new NextRequest("http://localhost/api/collections"));
    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Implement `src/app/api/collections/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createDocumentCollectionTaskSchema,
  documentCollectionListQuerySchema,
} from "@/validators/document-collection";
import {
  createDocumentCollectionTask,
  listDocumentCollectionTasks,
} from "@/lib/services/document-collection-task.service";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const query = documentCollectionListQuerySchema.parse({
    scope: request.nextUrl.searchParams.get("scope") ?? undefined,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    search: request.nextUrl.searchParams.get("search") ?? undefined,
  });

  const result = await listDocumentCollectionTasks({
    currentUserId: session.user.id,
    ...query,
  });

  return NextResponse.json({ success: true, data: result.data });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const parsed = createDocumentCollectionTaskSchema.parse({
    title: formData.get("title"),
    instruction: formData.get("instruction"),
    dueAt: formData.get("dueAt"),
    assigneeIds: JSON.parse(String(formData.get("assigneeIds") ?? "[]")),
    renameRule: formData.get("renameRule"),
    renameVariables: JSON.parse(String(formData.get("renameVariables") ?? "{}")),
  });

  const attachments = formData.getAll("attachments").filter((item): item is File => item instanceof File);
  const normalizedAttachments = await Promise.all(
    attachments.map(async (file) => ({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    }))
  );

  const result = await createDocumentCollectionTask({
    ...parsed,
    createdById: session.user.id,
    attachments: normalizedAttachments,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
```

- [ ] **Step 3: Implement `src/app/api/collections/[id]/route.ts` and `/submissions/route.ts`**

```ts
// /api/collections/[id]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocumentCollectionTaskDetail } from "@/lib/services/document-collection-task.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }

  const { id } = await params;
  const result = await getDocumentCollectionTaskDetail({
    taskId: id,
    currentUserId: session.user.id,
  });

  if (!result.success) {
    const status = result.error.code === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ success: true, data: result.data });
}
```

- [ ] **Step 4: Implement download routes**

```ts
// /api/collections/[id]/download/route.ts
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/lib/auth";
import { buildDocumentCollectionDownloadPackage } from "@/lib/services/document-collection-download.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }

  const { id } = await params;
  const result = await buildDocumentCollectionDownloadPackage({
    taskId: id,
    currentUserId: session.user.id,
  });

  if (!result.success) {
    const status =
      result.error.code === "FORBIDDEN" ? 403 :
      result.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  const fileBuffer = await readFile(result.data.filePath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.data.fileName}"`,
    },
  });
}
```

- [ ] **Step 5: Run route tests**

Run: `npm run test:run -- src/app/api/collections/route.test.ts src/app/api/collections/[id]/route.test.ts src/app/api/collections/[id]/submissions/route.test.ts src/app/api/collections/[id]/download/route.test.ts`
Expected: PASS for auth failures, happy-path creation, scoped detail, submission upload, and ZIP download permissions.

- [ ] **Step 6: Verification checkpoint**

Run: `git diff -- src/app/api/collections src/app/api/collections/route.test.ts src/app/api/collections/[id]/route.test.ts src/app/api/collections/[id]/submissions/route.test.ts src/app/api/collections/[id]/download/route.test.ts`
Expected: diff only adds collection route handlers and route tests.

## Task 10: Build collection task form and rename-rule editor

**Files:**
- Create: `src/components/collections/collection-task-form.tsx`
- Create: `src/components/collections/collection-assignee-picker.tsx`
- Create: `src/components/collections/collection-attachments-upload.tsx`
- Create: `src/components/collections/collection-rename-rule-editor.tsx`
- Create: `src/components/collections/collection-task-form.test.tsx`

- [ ] **Step 1: Write the failing component test for variable insertion**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectionRenameRuleEditor } from "./collection-rename-rule-editor";

it("inserts a clicked variable into the rule input", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();

  render(
    <CollectionRenameRuleEditor
      value=""
      onChange={onChange}
      variables={["{任务标题}", "{姓名}", "{前缀}"]}
      preview="法务部_张三_合同扫描件收集.docx"
    />
  );

  await user.click(screen.getByRole("button", { name: "{前缀}" }));
  expect(onChange).toHaveBeenCalledWith("{前缀}");
});
```

- [ ] **Step 2: Create `src/components/collections/collection-rename-rule-editor.tsx`**

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CollectionRenameRuleEditor(props: {
  value: string;
  onChange: (value: string) => void;
  variables: string[];
  preview: string;
}) {
  return (
    <div className="space-y-3">
      <Input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder="{前缀}_{姓名}_{任务标题}_{序号}"
      />
      <div className="flex flex-wrap gap-2">
        {props.variables.map((variable) => (
          <Button
            key={variable}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => props.onChange(`${props.value}${variable}`)}
          >
            {variable}
          </Button>
        ))}
      </div>
      <p className="text-sm text-zinc-500">预览：{props.preview}</p>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/collections/collection-task-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CollectionRenameRuleEditor } from "./collection-rename-rule-editor";

export function CollectionTaskForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [renameRule, setRenameRule] = useState("{前缀}_{姓名}_{任务标题}_{序号}");
  const [renameVariables, setRenameVariables] = useState([{ key: "前缀", value: "" }]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);

  async function handleSubmit() {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("instruction", instruction);
    formData.append("dueAt", dueAt);
    formData.append("assigneeIds", JSON.stringify(assigneeIds));
    formData.append("renameRule", renameRule);
    formData.append(
      "renameVariables",
      JSON.stringify(
        Object.fromEntries(renameVariables.filter((item) => item.key && item.value).map((item) => [item.key, item.value]))
      )
    );
    attachments.forEach((file) => formData.append("attachments", file));

    const response = await fetch("/api/collections", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      toast.error(payload?.error?.message || "创建任务失败");
      return;
    }

    const payload = await response.json();
    toast.success("任务已创建");
    router.push(`/collections/${payload.data.id}`);
  }

  return (
    <div className="space-y-6">
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="任务标题" />
      <Textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="提交要求说明" />
      <Input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      <CollectionRenameRuleEditor
        value={renameRule}
        onChange={setRenameRule}
        variables={["{任务标题}", "{姓名}", "{邮箱}", "{提交时间}", "{序号}", "{前缀}"]}
        preview="法务部_张三_合同扫描件收集_1.docx"
      />
      <Button type="button" onClick={handleSubmit}>创建任务</Button>
    </div>
  );
}
```

- [ ] **Step 4: Run component tests**

Run: `npm run test:run -- src/components/collections/collection-task-form.test.tsx`
Expected: PASS for variable insertion, payload serialization, and successful redirect handling.

- [ ] **Step 5: Verification checkpoint**

Run: `git diff -- src/components/collections/collection-task-form.tsx src/components/collections/collection-assignee-picker.tsx src/components/collections/collection-attachments-upload.tsx src/components/collections/collection-rename-rule-editor.tsx src/components/collections/collection-task-form.test.tsx`
Expected: diff only adds the create-task form flow and rename-rule editor coverage.

## Task 11: Build status badge, assignee table, submission upload, and version history components

**Files:**
- Create: `src/components/collections/collection-status-badge.tsx`
- Create: `src/components/collections/collection-assignee-table.tsx`
- Create: `src/components/collections/collection-submission-upload.tsx`
- Create: `src/components/collections/collection-version-history.tsx`
- Create: `src/components/collections/collection-status-badge.test.tsx`
- Create: `src/components/collections/collection-version-history.test.tsx`

- [ ] **Step 1: Write the failing badge and version-history tests**

```tsx
it("renders the late badge with destructive styling text", () => {
  render(<CollectionStatusBadge status="LATE" />);
  expect(screen.getByText("逾期提交")).toBeInTheDocument();
});

it("renders versions in descending order", () => {
  render(
    <CollectionVersionHistory
      versions={[
        { id: "v2", version: 2, originalFileName: "b.docx", submittedAt: "2026-04-10T12:00:00.000Z", note: null, isLate: false, submittedBy: { id: "u1", name: "张三" }, fileName: "v2.docx" },
        { id: "v1", version: 1, originalFileName: "a.docx", submittedAt: "2026-04-09T12:00:00.000Z", note: null, isLate: false, submittedBy: { id: "u1", name: "张三" }, fileName: "v1.docx" },
      ]}
    />
  );

  expect(screen.getByText("V2")).toBeInTheDocument();
  expect(screen.getByText("V1")).toBeInTheDocument();
});
```

- [ ] **Step 2: Create `src/components/collections/collection-status-badge.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";

export function CollectionStatusBadge(props: {
  status: "PENDING" | "SUBMITTED" | "LATE";
}) {
  if (props.status === "PENDING") {
    return <Badge variant="secondary">未提交</Badge>;
  }

  if (props.status === "LATE") {
    return <Badge variant="destructive">逾期提交</Badge>;
  }

  return <Badge variant="default">已提交</Badge>;
}
```

- [ ] **Step 3: Create `src/components/collections/collection-version-history.tsx`**

```tsx
import { CollectionStatusBadge } from "./collection-status-badge";

export function CollectionVersionHistory(props: {
  versions: Array<{
    id: string;
    version: number;
    originalFileName: string;
    submittedAt: string;
    note: string | null;
    isLate: boolean;
    submittedBy: { id: string; name: string };
    fileName: string;
  }>;
}) {
  return (
    <div className="space-y-3">
      {props.versions.map((version) => (
        <div key={version.id} className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">V{version.version}</p>
            <CollectionStatusBadge status={version.isLate ? "LATE" : "SUBMITTED"} />
          </div>
          <p className="text-sm text-zinc-600">{version.originalFileName}</p>
          <p className="text-sm text-zinc-500">{new Date(version.submittedAt).toLocaleString("zh-CN")}</p>
          {version.note ? <p className="text-sm">{version.note}</p> : null}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `CollectionAssigneeTable` and `CollectionSubmissionUpload`**

```tsx
// src/components/collections/collection-assignee-table.tsx
import Link from "next/link";
import { CollectionStatusBadge } from "./collection-status-badge";

export function CollectionAssigneeTable(props: {
  assignees: Array<{
    id: string;
    user: { id: string; name: string; email: string };
    status: "PENDING" | "SUBMITTED" | "LATE";
    latestVersion: { id: string; version: number; originalFileName: string; submittedAt: string } | null;
    versionCount: number;
  }>;
  renameRule: string;
  downloadUrl: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">命名规则：{props.renameRule}</p>
        <Link href={props.downloadUrl} className="text-sm font-medium text-blue-600">
          打包下载
        </Link>
      </div>
      <div className="rounded-lg border">
        {props.assignees.map((assignee) => (
          <div key={assignee.id} className="grid grid-cols-[1.2fr_0.8fr_1.4fr_1fr] gap-4 border-b p-4 last:border-b-0">
            <div>
              <p className="font-medium">{assignee.user.name}</p>
              <p className="text-sm text-zinc-500">{assignee.user.email}</p>
            </div>
            <CollectionStatusBadge status={assignee.status} />
            <div className="text-sm text-zinc-600">
              {assignee.latestVersion ? assignee.latestVersion.originalFileName : "暂无提交"}
            </div>
            <div className="text-sm text-zinc-500">历史 {assignee.versionCount} 版</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// src/components/collections/collection-submission-upload.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CollectionSubmissionUpload(props: { taskId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");

  async function handleSubmit() {
    if (!file) {
      toast.error("请选择上传文件");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("note", note);

    const response = await fetch(`/api/collections/${props.taskId}/submissions`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      toast.error(payload?.error?.message || "上传失败");
      return;
    }

    toast.success("已上传新版本");
    window.location.reload();
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <Input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="本次提交备注（可选）" />
      <Button type="button" onClick={handleSubmit}>上传新版本</Button>
    </div>
  );
}
```

- [ ] **Step 5: Run component tests**

Run: `npm run test:run -- src/components/collections/collection-status-badge.test.tsx src/components/collections/collection-version-history.test.tsx`
Expected: PASS for status labeling and version order rendering.

- [ ] **Step 6: Verification checkpoint**

Run: `git diff -- src/components/collections/collection-status-badge.tsx src/components/collections/collection-assignee-table.tsx src/components/collections/collection-submission-upload.tsx src/components/collections/collection-version-history.tsx src/components/collections/collection-status-badge.test.tsx src/components/collections/collection-version-history.test.tsx`
Expected: diff only adds creator/assignee detail components and their tests.

## Task 12: Add dashboard pages and sidebar entry

**Files:**
- Create: `src/app/(dashboard)/collections/page.tsx`
- Create: `src/app/(dashboard)/collections/new/page.tsx`
- Create: `src/app/(dashboard)/collections/[id]/page.tsx`
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create list and new pages**

```tsx
// src/app/(dashboard)/collections/new/page.tsx
import { CollectionTaskForm } from "@/components/collections/collection-task-form";

export default function NewCollectionTaskPage() {
  return <CollectionTaskForm />;
}
```

```tsx
// src/app/(dashboard)/collections/page.tsx
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listDocumentCollectionTasks } from "@/lib/services/document-collection-task.service";

export default async function CollectionTaskListPage() {
  const session = await auth();
  const result = await listDocumentCollectionTasks({
    currentUserId: session!.user.id,
    scope: "all",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">文档收集</h1>
        <Link href="/collections/new">新建任务</Link>
      </div>
      <div className="space-y-4">
        {result.data.map((item) => (
          <Link key={item.id} href={`/collections/${item.id}`} className="block rounded-lg border p-4">
            <p className="font-medium">{item.title}</p>
            <p className="text-sm text-zinc-500">截止时间：{new Date(item.dueAt).toLocaleString("zh-CN")}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the task detail page with creator/assignee split view**

```tsx
import { auth } from "@/lib/auth";
import { getDocumentCollectionTaskDetail } from "@/lib/services/document-collection-task.service";
import { CollectionAssigneeTable } from "@/components/collections/collection-assignee-table";
import { CollectionSubmissionUpload } from "@/components/collections/collection-submission-upload";
import { CollectionVersionHistory } from "@/components/collections/collection-version-history";

export default async function CollectionTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const result = await getDocumentCollectionTaskDetail({
    taskId: id,
    currentUserId: session!.user.id,
  });

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data.viewerRole === "CREATOR" ? (
    <CollectionAssigneeTable
      assignees={result.data.assignees}
      renameRule={result.data.renameRule}
      downloadUrl={`/api/collections/${id}/download`}
    />
  ) : (
    <div className="space-y-6">
      <CollectionSubmissionUpload taskId={id} />
      <CollectionVersionHistory versions={result.data.myVersions} />
    </div>
  );
}
```

- [ ] **Step 3: Add a sidebar navigation item**

```tsx
{
  title: "文档收集",
  href: "/collections",
  icon: FolderOpen,
}
```

- [ ] **Step 4: Run targeted UI tests and lint**

Run: `npm run test:run -- src/components/collections/collection-task-form.test.tsx src/components/collections/collection-status-badge.test.tsx src/components/collections/collection-version-history.test.tsx && npm run lint`
Expected: tests pass and ESLint completes without errors for new files.

- [ ] **Step 5: Verification checkpoint**

Run: `git diff -- src/app/(dashboard)/collections src/components/layout/sidebar.tsx`
Expected: diff only adds collection pages and the sidebar navigation entry.

## Task 13: End-to-end verification and documentation update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md` feature list and route overview**

```md
- **文档收集任务** — 发起文档收集、指定提交人、保留历史版本、打包下载最新提交
```

- [ ] **Step 2: Run the focused verification suite**

Run: `npm run test:run -- src/lib/utils/document-collection-file-name.test.ts src/lib/services/document-collection-task.service.test.ts src/lib/services/document-collection-submission.service.test.ts src/lib/services/document-collection-download.service.test.ts src/app/api/collections/route.test.ts src/app/api/collections/[id]/route.test.ts src/app/api/collections/[id]/submissions/route.test.ts src/app/api/collections/[id]/download/route.test.ts src/components/collections/collection-task-form.test.tsx src/components/collections/collection-status-badge.test.tsx src/components/collections/collection-version-history.test.tsx`
Expected: all document-collection tests pass.

- [ ] **Step 3: Run app-level verification**

Run: `npm run lint && npx prisma validate && npm run build`
Expected: lint passes, schema validates, and production build succeeds.

- [ ] **Step 4: Verification checkpoint**

Run: `git diff -- README.md`
Expected: diff only adds document collection feature documentation.

## Self-Review

### Spec coverage

- Task creation with attachments, due date, assignees, rename rule, and custom rename variables is covered in Tasks 3, 4, 6, 9, and 10.
- Assignee-only submission with repeated uploads and version history is covered in Tasks 5, 7, 9, 11, and 12.
- Creator-facing task panel and package download are covered in Tasks 6, 8, 9, 11, and 12.
- Late submission support and current-status derivation are covered in Tasks 5 and 7.
- Sidebar entry and README update are covered in Tasks 12 and 13.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task includes concrete file paths, code blocks, and exact commands.
- The plan does not defer admin bypass, approval flow, or notification work into the implementation scope.
- All previous commit steps were intentionally replaced with verification checkpoints to comply with this repository's AGENTS instructions.

### Type consistency

- Shared status values are consistently `PENDING | SUBMITTED | LATE`.
- Route handlers call `createDocumentCollectionTask`, `listDocumentCollectionTasks`, `getDocumentCollectionTaskDetail`, `createDocumentCollectionSubmission`, and `buildDocumentCollectionDownloadPackage` consistently.
- Rename-variable structures consistently use `Record<string, string>`.
