# Master Data Relation Subtable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现通用“关系子表格字段”，支持一对一/一对多/多对多、反向字段自动生成、边属性、业务唯一键导入和双向同步。

**Architecture:** 以“单一通用关系行表 + `DataRecord.data` 关系快照”为核心。字段保存阶段创建正反字段对，记录保存阶段由 relation service 计算 diff 并在事务内写关系行和双向快照，导入阶段基于表级业务唯一键匹配主记录与关联记录。

**Tech Stack:** Next.js 16 App Router, Prisma 7, PostgreSQL JSONB, React 19, TypeScript, Zod, Vitest

---

## File Map

- Modify: `prisma/schema.prisma`  
  新增关系基数 enum、业务唯一键配置、关系字段元数据、通用关系行表。
- Modify: `src/types/data-table.ts`  
  扩展字段类型、关系快照类型、关系行类型、业务唯一键类型。
- Modify: `src/validators/data-table.ts`  
  扩展字段 schema、记录 schema、导入 schema。
- Create: `src/lib/services/data-field.service.ts`  
  负责字段对创建、反向字段自动生成、结构性校验。
- Create: `src/lib/services/data-relation.service.ts`  
  负责关系 diff、关系行写入、快照刷新、删除清理、唯一性校验。
- Modify: `src/lib/services/data-table.service.ts`  
  表详情读取包含关系元数据和业务唯一键；`updateFields` 改为委托 field service。
- Modify: `src/lib/services/data-record.service.ts`  
  普通字段校验保留，关系字段写入委托 relation service，列表读取适配关系快照。
- Modify: `src/lib/services/import.service.ts`  
  增加业务唯一键 upsert 和关系明细导入能力。
- Create: `src/lib/services/data-field.service.test.ts`
- Create: `src/lib/services/data-relation.service.test.ts`
- Modify: `src/lib/services/data-table.service.test.ts` 或新增同目录测试文件  
  覆盖字段对创建后的表详情读取。
- Modify: `src/components/data/field-config-form.tsx`
- Modify: `src/components/data/field-config-list.tsx`
- Create: `src/components/data/relation-subtable-editor.tsx`
- Create: `src/components/data/relation-target-picker.tsx`
- Modify: `src/components/data/dynamic-record-form.tsx`
- Modify: `src/components/data/record-table.tsx`
- Modify: `src/components/data/import-wizard.tsx`
- Modify: `src/app/api/data-tables/[id]/fields/route.ts`
- Modify: `src/app/api/data-tables/[id]/records/route.ts`
- Modify: `src/app/api/data-tables/[id]/records/[recordId]/route.ts`
- Create: `src/app/api/data-tables/[id]/relation-options/route.ts`
- Create: `src/app/api/data-tables/[id]/relation-import/route.ts`
- Create: `scripts/migrate-relation-fields.ts`

---

### Task 1: Prisma 数据模型扩展

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 扩展 schema**

在 `FieldType` 增加新类型，在 `DataField`、`DataTable`、`DataRecord` 附近补充关系模型：

```prisma
enum FieldType {
  TEXT
  NUMBER
  DATE
  SELECT
  MULTISELECT
  EMAIL
  PHONE
  FILE
  RELATION
  RELATION_SUBTABLE
}

enum RelationCardinality {
  SINGLE
  MULTIPLE
}

model DataTable {
  id            String       @id @default(cuid())
  name          String       @unique
  description   String?
  icon          String?
  /// JSON 结构约定: { version: 1, fieldKeys: string[] }
  businessKeys  Json?
  fields        DataField[]
  records       DataRecord[]
  templates        Template[]
  batchGenerations BatchGeneration[]
  templateVersions TemplateVersion[]
  views            DataView[]
  createdBy        User     @relation(fields: [createdById], references: [id])
  createdById      String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([createdById])
}

model DataField {
  id                     String       @id @default(cuid())
  tableId                String
  table                  DataTable    @relation(fields: [tableId], references: [id], onDelete: Cascade)
  key                    String
  label                  String
  type                   FieldType    @default(TEXT)
  required               Boolean      @default(false)
  options                Json?
  relationTo             String?
  displayField           String?
  relationCardinality    RelationCardinality?
  inverseFieldId         String?
  inverseField           DataField?   @relation("InverseRelationField", fields: [inverseFieldId], references: [id], onDelete: SetNull)
  inverseOf              DataField?   @relation("InverseRelationField")
  isSystemManagedInverse Boolean      @default(false)
  /// JSON 结构约定: { version: 1, fields: RelationSchemaField[] }
  relationSchema         Json?
  defaultValue           String?
  sortOrder              Int          @default(0)
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt
  relationRows           DataRelationRow[] @relation("RelationRowsByField")

  @@unique([tableId, key])
  @@index([inverseFieldId])
}

model DataRelationRow {
  id             String     @id @default(cuid())
  fieldId        String
  field          DataField  @relation("RelationRowsByField", fields: [fieldId], references: [id], onDelete: Cascade)
  sourceRecordId String
  sourceRecord   DataRecord @relation("RelationRowsAsSource", fields: [sourceRecordId], references: [id], onDelete: Cascade)
  targetRecordId String
  targetRecord   DataRecord @relation("RelationRowsAsTarget", fields: [targetRecordId], references: [id], onDelete: Cascade)
  attributes     Json?
  sortOrder      Int        @default(0)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  /// SINGLE 基数的同源唯一性约束由 Task 4 的 service 事务校验保证。
  /// Prisma 无法在通用单表模型中表达基于字段元数据的条件唯一索引。

  @@unique([fieldId, sourceRecordId, targetRecordId])
  @@index([sourceRecordId, fieldId, sortOrder])
  @@index([targetRecordId])
}

model DataRecord {
  id                String            @id @default(cuid())
  tableId           String
  table             DataTable         @relation(fields: [tableId], references: [id], onDelete: Cascade)
  data              Json
  relationRowsFrom  DataRelationRow[] @relation("RelationRowsAsSource")
  relationRowsTo    DataRelationRow[] @relation("RelationRowsAsTarget")
  records           Record[]
  createdBy         User              @relation(fields: [createdById], references: [id])
  createdById       String
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([tableId])
  @@index([createdById])
  @@index([tableId, createdAt(sort: Desc)])
  @@index([tableId, createdById])
}
```

- [ ] **Step 2: 生成 Prisma Client**

Run: `npx prisma generate`

Expected: 本地 Prisma Client 重新生成且无 schema 解析错误；`src/generated/prisma/**` 保持不纳入 git 提交，遵循仓库 `.gitignore` 约定。

- [ ] **Step 3: 提交**

```bash
git add "prisma/schema.prisma"
git commit -m "feat: add relation subtable schema"
```

---

### Task 2: 类型与校验层扩展

**Files:**
- Modify: `src/types/data-table.ts`
- Modify: `src/validators/data-table.ts`

- [ ] **Step 1: 扩展类型定义**

在 `src/types/data-table.ts` 增加：

```typescript
export type RelationCardinality = "SINGLE" | "MULTIPLE";

export interface RelationSchemaField {
  key: string;
  label: string;
  type: Exclude<FieldType, FieldType.RELATION | FieldType.RELATION_SUBTABLE>;
  required: boolean;
  options?: string[];
  sortOrder: number;
}

export interface RelationSchemaConfig {
  version: 1;
  fields: RelationSchemaField[];
}

export interface RelationSubtableValueItem {
  targetRecordId: string;
  displayValue?: string;
  attributes: Record<string, unknown>;
  sortOrder: number;
}

export interface BusinessKeyConfig {
  fieldKeys: string[];
}
```

并在 `DataFieldItem` 增加 `relationCardinality`、`inverseRelationCardinality`、`inverseFieldId`、`isSystemManagedInverse`、`relationSchema?: RelationSchemaConfig | null`；在 `DataTableDetail` 增加 `businessKeys?: string[]`。

`inverseRelationCardinality?: RelationCardinality | null` 只用于“创建/编辑正向字段时显式声明反向侧基数”的输入模型，不对应 Prisma 新列。保存时由字段服务把它写到自动生成的反向字段 `relationCardinality` 上；读取表详情时如需回填，可从 `inverseField.relationCardinality` 推导。

- [ ] **Step 2: 扩展 Zod schema**

在 `src/validators/data-table.ts` 增加关系子字段 schema 和业务唯一键 schema，并扩展 `dataFieldItemSchema`：

```typescript
const relationSchemaFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(100),
  type: fieldTypeSchema.refine(
    (type) => type !== FieldType.RELATION && type !== FieldType.RELATION_SUBTABLE,
    "边属性子字段不允许嵌套关系字段"
  ),
  required: z.boolean().default(false),
  options: z.array(z.string()).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

const relationSchemaConfigSchema = z.object({
  version: z.literal(1),
  fields: z.array(relationSchemaFieldSchema),
});

export const businessKeySchema = z.object({
  fieldKeys: z.array(z.string()).min(1).max(5),
});
```

`dataFieldItemSchema` 新增：

```typescript
relationCardinality: z.enum(["SINGLE", "MULTIPLE"]).nullable().optional(),
inverseRelationCardinality: z.enum(["SINGLE", "MULTIPLE"]).nullable().optional(),
inverseFieldId: z.string().nullable().optional(),
isSystemManagedInverse: z.boolean().default(false),
relationSchema: relationSchemaConfigSchema.nullable().optional(),
```

- [ ] **Step 3: 跑类型检查**

Run: `npx tsc --noEmit`

Expected: 当前任务引入的类型错误全部修正；若仓库已有无关旧错误，需记录并只修本任务相关部分。

- [ ] **Step 4: 提交**

```bash
git add "src/types/data-table.ts" "src/validators/data-table.ts"
git commit -m "feat: add relation subtable types and validators"
```

---

### Task 3: 字段服务层 - 正反字段对创建与结构锁定

**Files:**
- Create: `src/lib/services/data-field.service.ts`
- Create: `src/lib/services/data-field.service.test.ts`
- Modify: `src/lib/services/data-table.service.ts`

- [ ] **Step 1: 先写失败测试**

在 `src/lib/services/data-field.service.test.ts` 覆盖：

```typescript
import { describe, expect, it } from "vitest";
import { saveTableFieldsWithRelations } from "./data-field.service";

describe("saveTableFieldsWithRelations", () => {
  it("creates forward and inverse relation subtable fields as a locked pair", async () => {
    const result = await saveTableFieldsWithRelations({
      tableId: "paper_table_id",
      fields: [
        {
          key: "authors",
          label: "作者",
          type: "RELATION_SUBTABLE" as never,
          required: false,
          relationTo: "author_table_id",
          displayField: "name",
          relationCardinality: "MULTIPLE",
          relationSchema: [
            { key: "author_order", label: "作者顺序", type: "NUMBER" as never, required: true, sortOrder: 0 },
          ],
          sortOrder: 0,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
```

测试里用当前仓库已有 db/mock 风格落地；如果现有服务测试直接连测试库，则补充最小 seed。

- [ ] **Step 2: 跑失败测试**

Run: `npx vitest run "src/lib/services/data-field.service.test.ts"`

Expected: 因 `saveTableFieldsWithRelations` 未实现而失败。

- [ ] **Step 3: 实现字段服务**

`src/lib/services/data-field.service.ts` 对外提供：

```typescript
import type { DataFieldInput } from "@/validators/data-table";
import type { ServiceResult } from "@/types/data-table";

export async function saveTableFieldsWithRelations(input: {
  tableId: string;
  fields: DataFieldInput[];
}): Promise<ServiceResult<null>> {
  // 1. 校验 relation 字段结构性约束
  // 2. 新建正向字段时自动创建反向字段
  // 3. 已存在字段只允许改 key/label/displayField/relationSchema 的非破坏性部分
  // 4. 在事务内全量落库
  return { success: true, data: null };
}
```

在 `src/lib/services/data-table.service.ts` 的 `updateFields` 中改为调用该服务，并保持现有返回风格不变。

- [ ] **Step 4: 跑测试和类型检查**

Run: `npx vitest run "src/lib/services/data-field.service.test.ts"`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: 无本任务新增类型错误。

- [ ] **Step 5: 提交**

```bash
git add "src/lib/services/data-field.service.ts" "src/lib/services/data-field.service.test.ts" "src/lib/services/data-table.service.ts"
git commit -m "feat: add relation field pair service"
```

---

### Task 4: 关系写入服务 - diff、约束校验、双向快照刷新

**Files:**
- Create: `src/lib/services/data-relation.service.ts`
- Create: `src/lib/services/data-relation.service.test.ts`
- Modify: `src/lib/services/data-record.service.ts`

- [ ] **Step 1: 写关系服务测试**

覆盖三类场景：

```typescript
describe("syncRelationSubtableValues", () => {
  it("syncs many-to-many rows and inverse snapshots", async () => {});
  it("rejects duplicate target rows for SINGLE cardinality", async () => {});
  it("removes inverse references when a relation row is deleted", async () => {});
});
```

- [ ] **Step 2: 跑失败测试**

Run: `npx vitest run "src/lib/services/data-relation.service.test.ts"`

Expected: 因服务未实现而失败。

- [ ] **Step 3: 实现 relation service**

`src/lib/services/data-relation.service.ts` 提供：

```typescript
export async function syncRelationSubtableValues(input: {
  tx: unknown;
  sourceRecordId: string;
  tableId: string;
  relationPayload: Record<string, RelationSubtableValueItem[] | RelationSubtableValueItem | null>;
}): Promise<ServiceResult<null>>;

export async function removeAllRelationsForRecord(input: {
  tx: unknown;
  recordId: string;
}): Promise<ServiceResult<null>>;
```

实现规则：

- 只处理 `RELATION_SUBTABLE` 字段。
- 先按字段读旧关系行，再和新 payload 做 diff。
- 单值字段写入前校验本侧最多 1 行；反向单值字段校验目标记录未被其它源记录占用。
- 关系行写入后刷新本记录和所有受影响对端记录的 JSONB 快照。
- 删除记录前调用 `removeAllRelationsForRecord` 清理对端快照。

- [ ] **Step 4: 接入 `data-record.service.ts`**

在 `createRecord`、`updateRecord`、`deleteRecord` 中分离普通字段和关系字段：

```typescript
const { scalarData, relationData } = splitRecordDataByFieldType(data, tableResult.data.fields);
```

普通字段继续写 `DataRecord.data`，关系字段交给 `syncRelationSubtableValues`；删除记录时先 `removeAllRelationsForRecord` 再删记录。

- [ ] **Step 5: 跑服务测试**

Run: `npx vitest run "src/lib/services/data-relation.service.test.ts"`

Expected: PASS

Run: `npx vitest run "src/lib/services/data-record.service.test.ts"`  

Expected: 如果当前仓库还没有 `src/lib/services/data-record.service.test.ts`，就在本任务补建最小回归测试文件，至少覆盖“保存关系子表格字段后可读回 JSONB 快照”和“删除记录后对端引用被清理”，不要用“文件不存在”跳过验证。

- [ ] **Step 6: 提交**

```bash
git add "src/lib/services/data-relation.service.ts" "src/lib/services/data-relation.service.test.ts" "src/lib/services/data-record.service.ts"
git commit -m "feat: sync relation subtable rows and inverse snapshots"
```

---

### Task 5: 字段配置 UI - 关系子表格字段和边属性 schema

**Files:**
- Modify: `src/components/data/field-config-form.tsx`
- Modify: `src/components/data/field-config-list.tsx`

- [ ] **Step 1: 先补组件测试**

如果当前没有现成测试文件，新增 `src/components/data/field-config-form.test.tsx`，覆盖：

```typescript
it("renders relation subtable config and locks structural fields for inverse fields", async () => {});
it("allows editing relation schema subfields for forward relation fields", async () => {});
```

- [ ] **Step 2: 实现字段配置表单**

`FieldConfigForm` 增加：

- 字段类型 `RELATION_SUBTABLE`
- 本侧基数选择 `SINGLE/MULTIPLE`
- 反向字段默认命名预览
- 边属性子字段编辑区
- 对 `isSystemManagedInverse=true` 的字段，锁定 `relationTo/relationCardinality/inverseFieldId`

- [ ] **Step 3: 更新字段列表展示**

在 `FieldConfigList` 中对 `RELATION_SUBTABLE` 展示：

- 关联目标表
- 本侧基数
- 反向字段名
- 边属性数量

- [ ] **Step 4: 跑组件测试**

Run: `npx vitest run "src/components/data/field-config-form.test.tsx"`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add "src/components/data/field-config-form.tsx" "src/components/data/field-config-list.tsx" "src/components/data/field-config-form.test.tsx"
git commit -m "feat: add relation subtable field configuration UI"
```

---

### Task 6: 记录编辑 UI - 内嵌关系子表格

**Files:**
- Create: `src/components/data/relation-target-picker.tsx`
- Create: `src/components/data/relation-subtable-editor.tsx`
- Modify: `src/components/data/dynamic-record-form.tsx`
- Modify: `src/components/data/record-table.tsx`
- Create: `src/app/api/data-tables/[id]/relation-options/route.ts`

- [ ] **Step 1: 先补组件测试**

新增 `src/components/data/relation-subtable-editor.test.tsx`，覆盖：

```typescript
it("adds/removes relation rows and edits relation attributes", async () => {});
it("prevents adding more than one row when cardinality is SINGLE", async () => {});
```

- [ ] **Step 2: 实现关系目标搜索接口**

`src/app/api/data-tables/[id]/relation-options/route.ts` 支持 `search` 查询，返回 `{ id, label }[]`，用于关系选择器按目标表记录搜索。

- [ ] **Step 3: 实现 `relation-target-picker.tsx`**

封装可搜索单选目标记录选择器，避免把 fetch/search 逻辑塞进子表格组件。

- [ ] **Step 4: 实现 `relation-subtable-editor.tsx`**

组件 props 建议：

```typescript
interface RelationSubtableEditorProps {
  field: DataFieldItem;
  value: RelationSubtableValueItem[];
  onChange: (next: RelationSubtableValueItem[]) => void;
}
```

每行包含目标记录选择器、边属性输入列、删除按钮；多条字段允许新增行和调整顺序，单条字段最多一行。

- [ ] **Step 5: 接入 `dynamic-record-form.tsx`**

对 `FieldType.RELATION_SUBTABLE` 渲染 `RelationSubtableEditor`，并在 Zod schema/defaultValues/submit 清洗逻辑里支持数组或单对象关系值。

- [ ] **Step 6: 更新列表页展示**

`record-table.tsx` 对 `RELATION_SUBTABLE` 读取 JSONB 快照：

- 单条显示一个 badge
- 多条显示前 3 个 badge + `+N`

- [ ] **Step 7: 跑测试**

Run: `npx vitest run "src/components/data/relation-subtable-editor.test.tsx"`

Expected: PASS

Run: `npx tsc --noEmit`

Expected: 无本任务新增类型错误。

- [ ] **Step 8: 提交**

```bash
git add "src/components/data/relation-target-picker.tsx" "src/components/data/relation-subtable-editor.tsx" "src/components/data/dynamic-record-form.tsx" "src/components/data/record-table.tsx" "src/app/api/data-tables/[id]/relation-options/route.ts" "src/components/data/relation-subtable-editor.test.tsx"
git commit -m "feat: edit relation subtable values in record forms"
```

---

### Task 7: 表级业务唯一键配置与导入服务增强

**Files:**
- Modify: `src/lib/services/data-table.service.ts`
- Modify: `src/lib/services/import.service.ts`
- Modify: `src/validators/data-table.ts`
- Modify: `src/components/data/import-wizard.tsx`
- Create: `src/app/api/data-tables/[id]/relation-import/route.ts`

- [ ] **Step 1: 先补导入服务测试**

新增或扩展 `src/lib/services/import.service.test.ts`，覆盖：

```typescript
it("upserts records by business keys and imports relation detail rows", async () => {});
it("rejects relation imports when business keys match multiple records", async () => {});
it("rejects multiple rows for SINGLE relation fields", async () => {});
```

- [ ] **Step 2: 扩展表级唯一键读取/保存**

在 `DataTable` 读取结果里返回 `businessKeys`；如果第一期先不做独立 UI，可在字段配置页增加一个最小“业务唯一键字段选择”入口，先保证导入链路可用。

- [ ] **Step 3: 扩展 `import.service.ts`**

增加两条主路径：

- 主表嵌套 JSON 导入：解析关系子表格字段列中的 JSON 数组
- 关系明细表导入：按主表唯一键 + 关联表唯一键 + 边属性列写关系行

公共能力：

```typescript
async function findRecordByBusinessKey(tableId: string, businessKeys: string[], row: Record<string, unknown>): Promise<string | null>;
```

多命中直接返回校验错误，未命中时按导入策略决定报错或创建。

- [ ] **Step 4: 新增关系明细导入 API**

`src/app/api/data-tables/[id]/relation-import/route.ts` 负责接收 Excel + 字段映射 + 目标关系字段 ID，调用导入服务完成预览校验和正式写入。

- [ ] **Step 5: 扩展导入向导 UI**

`import-wizard.tsx` 增加导入模式切换：

- 主表普通/嵌套导入
- 关系明细表导入

关系明细表模式下展示主表唯一键列、关联表唯一键列、边属性列映射。

- [ ] **Step 6: 跑测试**

Run: `npx vitest run "src/lib/services/import.service.test.ts"`

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add "src/lib/services/data-table.service.ts" "src/lib/services/import.service.ts" "src/validators/data-table.ts" "src/components/data/import-wizard.tsx" "src/app/api/data-tables/[id]/relation-import/route.ts" "src/lib/services/import.service.test.ts"
git commit -m "feat: import relation subtables by business keys"
```

---

### Task 8: 历史 RELATION 数据迁移与回归验证

**Files:**
- Create: `scripts/migrate-relation-fields.ts`
- Modify: `README.md`

- [ ] **Step 1: 编写迁移脚本**

`scripts/migrate-relation-fields.ts` 执行：

1. 扫描现有 `RELATION` 字段。
2. 为缺失反向字段的字段生成系统反向字段。
3. 从历史 `DataRecord.data[fieldKey]` 回填 `DataRelationRow`。
4. 刷新正反 JSONB 快照。
5. 对引用不存在、单值脏数组、重复关系输出报告并阻断提交。

- [ ] **Step 2: 在测试库跑迁移脚本**

Run: `npx tsx "scripts/migrate-relation-fields.ts" --dry-run`

Expected: 输出迁移统计和脏数据报告，不写库。

- [ ] **Step 3: 补 README 迁移说明**

在 `README.md` 的数据库初始化/升级说明中补充迁移命令和 dry-run 建议。

- [ ] **Step 4: 执行完整回归检查**

Run:

```bash
npx tsc --noEmit
npm run test:run
```

Expected: 关系字段新增测试通过；若现有仓库存在无关历史失败，需逐条记录失败用例名称和是否与本次改造相关，不允许笼统写“测试失败”。

- [ ] **Step 5: 提交**

```bash
git add "scripts/migrate-relation-fields.ts" "README.md"
git commit -m "chore: add relation subtable migration script"
```
