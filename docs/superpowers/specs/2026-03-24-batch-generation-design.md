# Phase 2b: 批量生成功能设计规范

## 概述

批量生成功能允许用户基于主数据表中的多条记录
批量生成文档
显著提高文档生成效率。

## 功能范围

1. **批量生成功能** - 基于主数据记录批量生成文档
2. **主数据与模板关联** - 将模板与主数据表建立关联
3. **高级搜索/筛选** - 增强记录查询能力
4. **生成记录关联主数据** - 追踪文档来源

## 用户流程

### 入口

- **主入口：** 模板详情页 `/templates/[id]`
- **批量生成按钮：** 与"填写表单"按钮并列
- **导航路径：** `/templates/[id]/batch`

### 步骤流程

```
┌─────────────────────────────────────────────────────────────┐
│                    批量生成向导                              │
├─────────────────────────────────────────────────────────────┤
│ Step 1: 选择数据源                                          │
│   - 选择主数据表                                             │
│   - 筛选记录（搜索/过滤）                                     │
│   - 勾选需要生成的记录                                       │
├─────────────────────────────────────────────────────────────┤
│ Step 2: 字段映射                                             │
│   - 自动匹配（字段名 = 占位符名）                             │
│   - 手动调整映射关系                                         │
│   - 预览映射结果                                             │
├─────────────────────────────────────────────────────────────┤
│ Step 3: 生成设置                                             │
│   - 文件名规则（支持变量）                                   │
│   - 完成操作（下载ZIP / 保存到记录）                          │
├─────────────────────────────────────────────────────────────┤
│ Step 4: 执行与结果                                           │
│   - 生成进度                                                 │
│   - 成功/失败统计                                            │
│   - 下载/查看结果                                            │
└─────────────────────────────────────────────────────────────┘
```

## 数据模型

### Prisma Schema 扩展

```prisma
// 模板添加主数据关联
model Template {
  // ... 现有字段
  dataTableId  String?     // 关联的主数据表ID
  dataTable    DataTable?  @relation(fields: [dataTableId], references: [id])
  fieldMapping Json?      // 字段映射配置 {placeholder: dataFieldKey}
}

// 生成记录添加主数据关联
model Record {
  // ... 现有字段
  dataRecordId  String?     // 关联的主数据记录ID
  dataRecord   DataRecord? @relation(fields: [dataRecordId], references: [id])
}

// 批量生成批次（可选，用于追踪大型批量任务）
model BatchGeneration {
  id           String   @id @default(cuid())
  templateId  String
  template    Template @relation(fields: [templateId], references: [id])
  dataTableId  String
  dataTable    DataTable @relation(fields: [dataTableId], references: [id])
  totalCount   Int
  successCount Int
  failedCount  Int
  status       BatchStatus @default(PENDING)
  fileNamePattern String?
  outputMethod String   // DOWNLOAD / SAVE_TO_RECORDS
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([templateId])
  @@index([status])
}

enum BatchStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

### TypeScript 类型

```typescript
// src/types/batch-generation.ts

export interface BatchGenerationItem {
  id: string;
  templateId: string;
  dataTableId: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: BatchStatus;
  fileNamePattern: string | null;
  outputMethod: 'DOWNLOAD' | 'SAVE_TO_RECORDS';
  createdAt: Date;
  updatedAt: Date;
  createdByName: string;
}

export interface FieldMapping {
  [placeholderKey: string]: string | null; // dataFieldKey or null
}

export interface BatchGenerationInput {
  templateId: string;
  dataTableId: string;
  recordIds: string[];
  fieldMapping: FieldMapping;
  fileNamePattern: string;
  outputMethod: 'DOWNLOAD' | 'SAVE_TO_RECORDS';
}

export interface BatchGenerationResult {
  success: boolean;
  batchId?: string;
  generatedRecords?: {
    id: string;
    fileName: string;
    dataRecordId: string;
  }[];
  errors?: Array<{ recordId: string; error: string }>;
  downloadUrl?: string;
}
```

## API 设计

### POST /api/templates/[id]/batch

执行批量生成。

**请求体：**
```json
{
  "dataTableId": "cmn4pes9k0001fhbmioud7pz5",
  "recordIds": ["id1", "id2", "id3"],
  "fieldMapping": {
    "project_name": "project_name",
    "contract_date": "sign_date"
  },
  "fileNamePattern": "{project_name}_合同_{date}",
  "outputMethod": "DOWNLOAD"
}
```

**响应（下载模式）：**
```json
{
  "success": true,
  "batchId": "batch_xxx",
  "generatedRecords": [
    { "id": "rec1", "fileName": "智慧城市项目_合同_2026-03-24.docx", "dataRecordId": "id1" }
  ],
  "downloadUrl": "/api/batch-xxx/download"
}
```

**响应（保存模式）：**
```json
{
  "success": true,
  "batchId": "batch_xxx",
  "generatedRecords": [
    { "id": "rec1", "fileName": "智慧城市项目_合同.docx", "dataRecordId": "id1" }
  ]
}
```

### GET /api/batch/[id]

获取批次状态。

**响应：**
```json
{
  "id": "batch_xxx",
  "templateId": "tpl_xxx",
  "dataTableId": "dt_xxx",
  "totalCount": 10,
  "successCount": 8,
  "failedCount": 2,
  "status": "COMPLETED",
  "fileNamePattern": "{project_name}_合同_{date}",
  "outputMethod": "DOWNLOAD",
  "createdAt": "2026-03-24T10:30:00Z",
  "createdByName": "张三"
}
```

### GET /api/batch/[id]/download

下载批量生成的 ZIP 文件（仅当 outputMethod 为 DOWNLOAD 时可用）。

## 服务层设计

### 批量生成服务 (src/lib/services/batch-generation.service.ts)

**核心方法：**

| 方法 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| `validateFieldMapping` | `templateId, dataTableId, mapping` | `{ valid, errors, autoMapping }` | 验证所有占位符是否有有效的映射 |
| `generateBatch` | `BatchGenerationInput` | `BatchGenerationResult` | 执行批量生成 |
| `getBatch` | `batchId` | `BatchGenerationItem` | 获取批次状态 |
| `cancelBatch` | `batchId` | `void` | 取消运行中的批次 |

### 批量生成核心逻辑

```typescript
async function generateBatch(input: BatchGenerationInput): Promise<BatchGenerationResult> {
  const { templateId, dataTableId, recordIds, fieldMapping, fileNamePattern, outputMethod } = input;

  // 1. 获取模板和数据表
  const template = await getTemplate(templateId);
  const dataTable = await getTable(dataTableId);

  // 2. 获取数据记录
  const records = await getRecordsByIds(dataTableId, recordIds);

  // 3. 创建批次记录
  const batch = await createBatch({
    templateId,
    dataTableId,
    totalCount: recordIds.length,
    status: 'PROCESSING',
    fileNamePattern,
    outputMethod,
  });

  // 4. 逐条生成文档
  const results = [];
  const errors = [];

  for (const record of records) {
    try {
      // 构建表单数据
      const formData = buildFormData(fieldMapping, record.data);

      // 生成文件名
      const fileName = buildFileName(fileNamePattern, record.data);

      // 调用 Python 服务生成文档
      const docPath = await generateDocument(template, formData, fileName);

      // 创建生成记录
      const genRecord = await createRecord({
        templateId,
        userId,
        formData,
        status: 'COMPLETED',
        fileName,
        filePath: docPath,
        dataRecordId: record.id,
      });

      results.push({
        id: genRecord.id,
        fileName,
        dataRecordId: record.id,
      });
    } catch (error) {
      errors.push({
        recordId: record.id,
        error: error.message,
      });
    }
  }

  // 5. 更新批次状态
  await updateBatch(batch.id, {
    successCount: results.length,
    failedCount: errors.length,
    status: 'COMPLETED',
  });

  // 6. 处理输出
  if (outputMethod === 'DOWNLOAD') {
    const zipPath = await createZipArchive(results);
    return {
      success: true,
      batchId: batch.id,
      generatedRecords: results,
      errors,
      downloadUrl: `/api/batch/${batch.id}/download`,
    };
  }

  return {
    success: true,
    batchId: batch.id,
    generatedRecords: results,
    errors,
  };
}
```

## UI 组件设计

### 步骤组件 (src/components/batch/)

| 组件 | 文件路径 | Props |
|------|----------|-------|
| Step1SelectData | `step1-select-data.tsx` | `dataTableId: string \| null`, `selectedIds: string[]`, `onDataTableChange: (id: string) => void`, `onSelectionChange: (ids: string[]) => void` |
| Step2FieldMapping | `step2-field-mapping.tsx` | `templateId: string`, `dataTableId: string`, `mapping: FieldMapping`, `onMappingChange: (mapping: FieldMapping) => void` |
| Step3Settings | `step3-settings.tsx` | `fileNamePattern: string`, `outputMethod: 'DOWNLOAD' \| 'SAVE_TO_RECORDS'`, `onSettingsChange: (settings: Settings) => void` |
| Step4Result | `step4-result.tsx` | `result: BatchGenerationResult`, `onDownload: () => void`, `onClose: () => void` |

### 页面结构

```
// src/app/(dashboard)/templates/[id]/batch/page.tsx

export default function BatchGenerationPage({ params }) {
  const [step, setStep] = useState(1);
  const [dataTableId, setDataTableId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [settings, setSettings] = useState<Settings>({
    fileNamePattern: '{名称}_{日期}',
    outputMethod: 'DOWNLOAD',
  });
  const [result, setResult] = useState<BatchGenerationResult | null>(null);

  return (
    <div>
      <StepIndicator current={step} total={4} />

      {step === 1 && (
        <Step1SelectData
          dataTableId={dataTableId}
          selectedIds={selectedIds}
          onDataTableChange={setDataTableId}
          onSelectionChange={setSelectedIds}
        />
      )}

      {step === 2 && (
        <Step2FieldMapping
          templateId={params.id}
          dataTableId={dataTableId!}
          mapping={fieldMapping}
          onMappingChange={setFieldMapping}
        />
      )}

      {step === 3 && (
        <Step3Settings
          {...settings}
          onSettingsChange={setSettings}
        />
      )}

      {step === 4 && (
        <Step4Result
          result={result}
          onDownload={handleDownload}
          onClose={() => router.push('/templates')}
        />
      )}

      <StepNavigation
        current={step}
        onNext={handleNext}
        onPrev={() => setStep(s => s - 1)}
        canNext={canProceed}
      />
    </div>
  );
}
```

## 字段映射自动匹配逻辑

工具函数位于 `src/lib/utils/field-mapping.ts`：

| 函数 | 描述 |
|------|------|
| `autoMatchFields` | 根据名称相似度自动匹配占位符到数据字段 |
| `highlightMatches` | 高亮显示哪些映射是自动匹配的，哪些是手动的 |
| `suggestMappings` | 根据字段名称建议可能的映射 |

```typescript
// 自动匹配逻辑
function autoMatchFields(
  placeholders: Placeholder[],
  dataFields: DataField[]
): FieldMapping {
  const mapping: FieldMapping = {};

  for (const placeholder of placeholders) {
    // 1. 精确匹配
    const exactMatch = dataFields.find(
      f => f.key.toLowerCase() === placeholder.key.toLowerCase()
    );

    if (exactMatch) {
      mapping[placeholder.key] = exactMatch.key;
      continue;
    }

    // 2. 驼峰转下划线匹配
    const snakeCase = placeholder.key.replace(/([A-Z])/g, '_$1').toLowerCase();
    const snakeMatch = dataFields.find(f => f.key === snakeCase);

    if (snakeMatch) {
      mapping[placeholder.key] = snakeMatch.key;
      continue;
    }

    // 3. 模糊匹配（包含关系）
    const fuzzyMatch = dataFields.find(
      f => f.key.includes(placeholder.key) || placeholder.key.includes(f.key)
    );

    if (fuzzyMatch) {
      mapping[placeholder.key] = fuzzyMatch.key;
      continue;
    }

    // 4. 未匹配
    mapping[placeholder.key] = null;
  }

  return mapping;
}
```

## 文件名生成规则

工具函数位于 `src/lib/utils/file-name-builder.ts`：

| 函数 | 描述 |
|------|------|
| `buildFileName` | 根据模式和数据记录生成文件名 |
| `getAvailableVariables` | 获取文件名可用的变量列表 |

支持的变量：
- `{字段名}` - 主数据字段值（如 `{project_name}`）
- `{date}` - 当前日期（YYYY-MM-DD）
- `{time}` - 当前时间（HHmmss）
- `{序号}` - 批量生成时的序号（从1开始：1, 2, 3...）

示例：
- 模式：`{project_name}_合同_{date}`
- 结果：`智慧城市项目_合同_2026-03-24.docx`

## 错误处理

| 错误类型 | 处理策略 |
|----------|----------|
| NetworkError | 指数退避重试（3次） |
| TemplateError | 跳过该记录，记录错误，继续 |
| DataError | 跳过该记录，记录错误，继续 |
| FileSystemError | 重试一次，然后失败整个批次 |

## 测试计划

| 测试类型 | 描述 |
|----------|------|
| API 单元测试 | 测试批量生成服务、字段映射、文件名生成器 |
| 组件测试 | 测试步骤组件、导航、验证 |
| E2E 测试 | 通过浏览器自动化测试完整批量生成流程 |

**测试用例：**

- [ ] 批量生成服务正确处理单条记录
- [ ] 字段映射自动匹配准确
- [ ] 文件名生成正确
- [ ] 错误处理：单条失败不影响其他记录
- [ ] 下载ZIP功能正常
- [ ] 生成记录正确关联主数据

## 安全考虑

- [ ] 用户只能批量生成自己有权限的模板
- [ ] 用户只能访问自己有权限的主数据表
- [ ] 批量生成需要 ADMIN 或模板创建者权限
- [ ] 生成记录关联正确的用户和主数据记录

## 性能考虑

- [ ] 大批量（>100条）时显示警告
- [ ] 考虑使用后台任务队列处理超大批量（可选优化）
- [ ] ZIP文件流式生成，避免内存占用过大

## 实施优先级

1. **P0（必需）：**
   - Prisma schema 扩展
   - 基础 API 路由
   - 批量生成页面（4步骤）
   - 字段映射组件
   - 基础服务层

2. **P1（重要）：**
   - 自动字段匹配
   - 文件名变量支持
   - ZIP 下载
   - 生成记录关联

3. **P2（增强）：**
   - 模板详情页关联主数据表
   - 高级搜索/筛选
   - 批次历史查看

## 文件清单

| 文件路径 | 描述 |
|---------|------|
| `prisma/schema.prisma` | 添加 BatchGeneration 模型， 扩展 Template 和 Record |
| `src/types/batch-generation.ts` | 类型定义 |
| `src/validators/batch-generation.ts` | Zod 验证器 |
| `src/lib/services/batch-generation.service.ts` | 批量生成服务 |
| `src/lib/utils/field-mapping.ts` | 字段映射工具函数 |
| `src/lib/utils/file-name-builder.ts` | 文件名生成工具 |
| `src/app/api/templates/[id]/batch/route.ts` | API 路由 |
| `src/app/(dashboard)/templates/[id]/batch/page.tsx` | 批量生成页面 |
| `src/components/batch/step1-select-data.tsx` | 步骤1组件 |
| `src/components/batch/step2-field-mapping.tsx` | 步骤2组件 |
| `src/components/batch/step3-settings.tsx` | 步骤3组件 |
| `src/components/batch/step4-result.tsx` | 步骤4组件 |
| `src/components/batch/step-navigation.tsx` | 步骤导航组件 |
| `src/components/batch/step-indicator.tsx` | 步骤指示器组件 |
