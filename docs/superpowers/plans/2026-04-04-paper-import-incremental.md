# 论文数据增量补充导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造 `scripts/import-papers.ts`，为已有论文表补充缺失字段和数据，并为所有论文（含无DOI）建立完整的作者关系子表记录。

**Architecture:** 复用现有的 `importData`、`importRelationDetails`、`saveTableFieldsWithRelations` 服务，在同一个脚本中增加增量补充模式。脚本检测命令行参数 `--incremental`，跳过建表步骤，直接进行字段补充、数据更新和关系建立。

**Tech Stack:** TypeScript, XLSX, Prisma, 现有主数据服务层

---

### Task 1: 改造 import-papers.ts — 增加增量模式框架和完整字段定义

**Files:**
- Modify: `scripts/import-papers.ts` (全文重写)

- [ ] **Step 1: 重写脚本，添加完整字段定义和增量模式**

将现有脚本改造为支持两种模式：
- 默认模式（无参数）：原始的全量导入逻辑，保持不变
- `--incremental` 模式：增量补充

新增 17 个论文表字段定义，与原有 16 个字段合并为完整的 `paperFields` 数组。

完整脚本如下：

```typescript
/**
 * 论文数据导入脚本
 *
 * 用法:
 *   npx tsx scripts/import-papers.ts              # 全量导入（建表+导入数据）
 *   npx tsx scripts/import-papers.ts --incremental # 增量补充（补字段+补数据+补关系）
 */
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { createTable, getTable } from "@/lib/services/data-table.service";
import { saveTableFieldsWithRelations } from "@/lib/services/data-field.service";
import { importData, importRelationDetails } from "@/lib/services/import.service";
import type { DataFieldInput } from "@/validators/data-table";
import { FieldType } from "@/generated/prisma/enums";
import { RelationCardinality } from "@/generated/prisma/enums";

// ── 配置 ──

const EXCEL_PATH = "/home/z/桌面/paper_author_db_ready_package.xlsx";
const ADMIN_USER_ID = "cmn47udp500007mbmvx10gx8u"; // authentik Default Admin
const INCREMENTAL = process.argv.includes("--incremental");

// ── 辅助函数 ──

function log(msg: string) {
  console.log(`[import-papers] ${msg}`);
}

function assertSuccess<T>(result: { success: boolean; data?: T; error?: { code: string; message: string } }, label: string): T {
  if (!result.success) {
    throw new Error(`${label} 失败: ${result.error ? `[${result.error.code}] ${result.error.message}` : String(result.error)}`);
  }
  return result.data as T;
}

// ── 字段定义 ──

function getAuthorFields(): DataFieldInput[] {
  return [
    { key: "author_name_cn", label: "中文名", type: FieldType.TEXT, required: true, sortOrder: 0 },
    { key: "author_name_en", label: "英文名", type: FieldType.TEXT, required: false, sortOrder: 1 },
    { key: "author_name_norm", label: "标准化名", type: FieldType.TEXT, required: true, sortOrder: 2 },
    { key: "group_name", label: "归属组", type: FieldType.SELECT, required: false, options: ["优化组", "体系组"], sortOrder: 3 },
    { key: "title_or_role", label: "职称", type: FieldType.TEXT, required: false, sortOrder: 4 },
    { key: "email", label: "邮箱", type: FieldType.EMAIL, required: false, sortOrder: 5 },
    { key: "orcid", label: "ORCID", type: FieldType.TEXT, required: false, sortOrder: 6 },
    { key: "employee_status", label: "人员状态", type: FieldType.SELECT, required: false, options: ["active", "leave", "retired"], sortOrder: 7 },
  ];
}

function getPaperFields(authorTableId: string): DataFieldInput[] {
  return [
    // ── 原有字段 ──
    { key: "paper_title", label: "英文题名", type: FieldType.TEXT, required: true, sortOrder: 0 },
    { key: "paper_title_cn", label: "中文题名", type: FieldType.TEXT, required: false, sortOrder: 1 },
    { key: "paper_type", label: "论文类型", type: FieldType.SELECT, required: false, options: ["journal", "conference"], sortOrder: 2 },
    { key: "group_name", label: "归属组", type: FieldType.SELECT, required: false, options: ["优化组", "体系组"], sortOrder: 3 },
    { key: "stat_year", label: "统计年度", type: FieldType.NUMBER, required: true, sortOrder: 4 },
    { key: "publish_date", label: "发表日期", type: FieldType.DATE, required: false, sortOrder: 5 },
    { key: "venue_name", label: "期刊/会议名", type: FieldType.TEXT, required: false, sortOrder: 6 },
    { key: "doi", label: "DOI", type: FieldType.TEXT, required: false, sortOrder: 7 },
    { key: "index_type_std", label: "收录类型", type: FieldType.SELECT, required: false, options: ["SCI", "CCF", "中文核心", "EI", "其他", "无"], sortOrder: 8 },
    { key: "publication_status_std", label: "刊出状态", type: FieldType.SELECT, required: false, options: ["已刊出", "未刊出", "录用待刊"], sortOrder: 9 },
    { key: "archive_status_std", label: "归档状态", type: FieldType.SELECT, required: false, options: ["已归档", "未归档"], sortOrder: 10 },
    { key: "authors_cn", label: "作者原文", type: FieldType.TEXT, required: false, sortOrder: 11 },
    { key: "corresponding_authors", label: "通讯作者原文", type: FieldType.TEXT, required: false, sortOrder: 12 },
    { key: "completion_unit", label: "完成单位", type: FieldType.TEXT, required: false, sortOrder: 13 },
    { key: "support_project", label: "资助项目", type: FieldType.TEXT, required: false, sortOrder: 14 },
    // ── 新增字段 ──
    { key: "volume", label: "卷号", type: FieldType.TEXT, required: false, sortOrder: 15 },
    { key: "issue", label: "期号", type: FieldType.TEXT, required: false, sortOrder: 16 },
    { key: "pages", label: "页码", type: FieldType.TEXT, required: false, sortOrder: 17 },
    { key: "impact_factor", label: "影响因子", type: FieldType.TEXT, required: false, sortOrder: 18 },
    { key: "ccf_category_std", label: "CCF分类", type: FieldType.SELECT, required: false, options: ["A", "B", "C", "无"], sortOrder: 19 },
    { key: "cas_partition_std", label: "中科院分区", type: FieldType.SELECT, required: false, options: ["一区", "二区", "三区", "四区", "无"], sortOrder: 20 },
    { key: "jcr_partition_std", label: "JCR分区", type: FieldType.SELECT, required: false, options: ["一区", "二区", "三区", "四区", "无"], sortOrder: 21 },
    { key: "sci_partition_std", label: "SCI分区", type: FieldType.SELECT, required: false, options: ["一区", "二区", "三区", "四区", "无"], sortOrder: 22 },
    { key: "paper_link", label: "论文链接", type: FieldType.TEXT, required: false, sortOrder: 23 },
    { key: "issn_or_isbn", label: "刊号/ISBN", type: FieldType.TEXT, required: false, sortOrder: 24 },
    { key: "conference_name_cn", label: "会议中文名", type: FieldType.TEXT, required: false, sortOrder: 25 },
    { key: "conference_location_cn", label: "会议地点", type: FieldType.TEXT, required: false, sortOrder: 26 },
    { key: "institution_rank_std", label: "机构排名", type: FieldType.TEXT, required: false, sortOrder: 27 },
    { key: "issue_flag_std", label: "是否有问题", type: FieldType.SELECT, required: false, options: ["是", "否"], sortOrder: 28 },
    { key: "internal_author_flag_std", label: "内部作者标记", type: FieldType.SELECT, required: false, options: ["是", "否"], sortOrder: 29 },
    { key: "review_form_no", label: "审查表编号", type: FieldType.TEXT, required: false, sortOrder: 30 },
    { key: "source_sheet", label: "来源sheet", type: FieldType.TEXT, required: false, sortOrder: 31 },
    // ── 关系字段 ──
    {
      key: "authors",
      label: "作者",
      type: FieldType.RELATION_SUBTABLE,
      required: false,
      relationTo: authorTableId,
      displayField: "author_name_cn",
      relationCardinality: RelationCardinality.MULTIPLE,
      inverseRelationCardinality: RelationCardinality.MULTIPLE,
      relationSchema: {
        version: 1,
        fields: [
          { key: "author_order", label: "作者顺序", type: FieldType.NUMBER, required: true, sortOrder: 0 },
          { key: "is_first_author", label: "是否第一作者", type: FieldType.SELECT, required: true, options: ["Y", "N"], sortOrder: 1 },
          { key: "is_corresponding_author", label: "是否通讯作者", type: FieldType.SELECT, required: true, options: ["Y", "N"], sortOrder: 2 },
        ],
      },
      sortOrder: 32,
    },
  ];
}

// 完整的 Excel 列 → 系统字段映射
function getPaperColumnMapping(): Record<string, string> {
  return {
    paper_title: "paper_title",
    paper_title_cn: "paper_title_cn",
    paper_type: "paper_type",
    group_name: "group_name",
    stat_year: "stat_year",
    publish_date: "publish_date",
    venue_name: "venue_name",
    doi_std: "doi",
    index_type_std: "index_type_std",
    publication_status_std: "publication_status_std",
    archive_status_std: "archive_status_std",
    authors_cn: "authors_cn",
    corresponding_authors: "corresponding_authors",
    completion_unit: "completion_unit",
    support_project: "support_project",
    volume: "volume",
    issue: "issue",
    pages: "pages",
    impact_factor: "impact_factor",
    ccf_category_std: "ccf_category_std",
    cas_partition_std: "cas_partition_std",
    jcr_partition_std: "jcr_partition_std",
    sci_partition_std: "sci_partition_std",
    paper_link: "paper_link",
    issn_or_isbn: "issn_or_isbn",
    conference_name_cn: "conference_name_cn",
    conference_location_cn: "conference_location_cn",
    institution_rank_std: "institution_rank_std",
    issue_flag_std: "issue_flag_std",
    internal_author_flag_std: "internal_author_flag_std",
    review_form_no: "review_form_no",
    source_sheet: "source_sheet",
  };
}

function buildMapping(columnMapping: Record<string, string>, sampleRow: Record<string, unknown> | undefined): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  if (!sampleRow) return mapping;
  for (const [excelCol, fieldKey] of Object.entries(columnMapping)) {
    if (excelCol in sampleRow) {
      mapping[excelCol] = fieldKey;
    }
  }
  return mapping;
}

// ── Step 1: 全量模式 - 创建数据表和配置字段 ──

async function setupTables() {
  log("=== Step 1: 创建数据表 ===");

  // 1a. 创建或获取作者表
  log("创建作者表...");
  let authorTableId: string;
  const existingAuthorTable = await db.dataTable.findUnique({ where: { name: "作者" } });
  if (existingAuthorTable) {
    authorTableId = existingAuthorTable.id;
    log(`作者表已存在: ${authorTableId}`);
  } else {
    const authorTable = assertSuccess(
      await createTable(ADMIN_USER_ID, { name: "作者", description: "论文作者主数据" }),
      "创建作者表"
    );
    authorTableId = authorTable.id;
    log(`作者表已创建: ${authorTableId}`);
  }

  // 1b. 创建或获取论文表
  log("创建论文表...");
  let paperTableId: string;
  const existingPaperTable = await db.dataTable.findUnique({ where: { name: "论文" } });
  if (existingPaperTable) {
    paperTableId = existingPaperTable.id;
    log(`论文表已存在: ${paperTableId}`);
  } else {
    const paperTable = assertSuccess(
      await createTable(ADMIN_USER_ID, { name: "论文", description: "论文成果主数据" }),
      "创建论文表"
    );
    paperTableId = paperTable.id;
    log(`论文表已创建: ${paperTableId}`);
  }

  // 1c. 配置字段
  log("配置作者表字段...");
  assertSuccess(
    await saveTableFieldsWithRelations({ tableId: authorTableId, fields: getAuthorFields() }),
    "配置作者表字段"
  );
  log("作者表字段已保存");

  log("配置论文表字段...");
  assertSuccess(
    await saveTableFieldsWithRelations({ tableId: paperTableId, fields: getPaperFields(authorTableId) }),
    "配置论文表字段"
  );
  log("论文表字段已保存");

  // 1d. 设置业务唯一键
  log("设置业务唯一键...");
  await db.dataTable.update({
    where: { id: authorTableId },
    data: { businessKeys: ["author_name_norm"] },
  });
  await db.dataTable.update({
    where: { id: paperTableId },
    data: { businessKeys: ["doi"] },
  });
  log("业务唯一键已设置");

  return { authorTableId, paperTableId };
}

// ── Step 2: 导入数据 ──

async function importAllData(authorTableId: string, paperTableId: string) {
  log("\n=== Step 2: 导入数据 ===");

  log("读取 Excel 文件...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  if (!workbook) throw new Error("无法读取 Excel 文件");

  const authorTableDetail = assertSuccess(await getTable(authorTableId), "获取作者表字段");
  const authorFields = authorTableDetail.fields;
  const paperTableDetail = assertSuccess(await getTable(paperTableId), "获取论文表字段");
  const paperFields = paperTableDetail.fields;

  // 2a. 导入作者数据
  log("导入作者数据...");
  const authorsSheet = workbook.Sheets["authors_seed"];
  if (!authorsSheet) throw new Error("找不到 authors_seed sheet");
  const authorRows = XLSX.utils.sheet_to_json(authorsSheet, { defval: null }) as Record<string, unknown>[];

  log(`作者数据: ${authorRows.length} 行`);

  const authorFieldMap: Record<string, string> = {
    author_name_cn: "author_name_cn",
    author_name_en: "author_name_en",
    author_name_norm: "author_name_norm",
    group_name_guess: "group_name",
    title_or_role: "title_or_role",
    email: "email",
    orcid: "orcid",
    employee_status: "employee_status",
  };
  const authorMapping = buildMapping(authorFieldMap, authorRows[0]);

  const authorImportResult = assertSuccess(
    await importData(authorTableId, ADMIN_USER_ID, authorRows, authorMapping, {
      uniqueField: "author_name_norm",
      strategy: "skip",
    }, authorFields),
    "导入作者数据"
  );
  log(`作者导入完成: 创建 ${authorImportResult.created}, 更新 ${authorImportResult.updated}, 跳过 ${authorImportResult.skipped}, 错误 ${authorImportResult.errors.length}`);

  // 2b. 导入论文主数据
  log("导入论文主数据...");
  const papersSheet = workbook.Sheets["papers_final"];
  if (!papersSheet) throw new Error("找不到 papers_final sheet");
  const paperRowsAll = XLSX.utils.sheet_to_json(papersSheet, { defval: null }) as Record<string, unknown>[];

  log(`论文数据: ${paperRowsAll.length} 行`);

  const paperMapping = buildMapping(getPaperColumnMapping(), paperRowsAll[0]);

  const paperWithDoi = paperRowsAll.filter((row) => row.doi_std != null && row.doi_std !== "");
  const paperWithoutDoi = paperRowsAll.filter((row) => !row.doi_std || row.doi_std === "");

  log(`有 DOI 论文: ${paperWithDoi.length} 行，无 DOI 论文: ${paperWithoutDoi.length} 行`);

  const paperWithDoiResult = assertSuccess(
    await importData(paperTableId, ADMIN_USER_ID, paperWithDoi, paperMapping, {
      uniqueField: "doi",
      strategy: "overwrite",
    }, paperFields, { businessKeys: ["doi"] }),
    "导入有DOI论文"
  );
  log(`有DOI论文导入: 创建 ${paperWithDoiResult.created}, 更新 ${paperWithDoiResult.updated}, 跳过 ${paperWithDoiResult.skipped}, 错误 ${paperWithDoiResult.errors.length}`);

  const paperWithoutDoiResult = assertSuccess(
    await importData(paperTableId, ADMIN_USER_ID, paperWithoutDoi, paperMapping, {
      uniqueField: "paper_title",
      strategy: "skip",
    }, paperFields, { businessKeys: ["paper_title"] }),
    "导入无DOI论文"
  );
  log(`无DOI论文导入: 创建 ${paperWithoutDoiResult.created}, 更新 ${paperWithoutDoiResult.updated}, 跳过 ${paperWithoutDoiResult.skipped}, 错误 ${paperWithoutDoiResult.errors.length}`);

  // 2c. 导入论文-作者关系
  await importPaperAuthorRelations(paperTableId, authorTableId, workbook, paperFields);
}

// ── 导入论文-作者关系（抽取为可复用函数）──

async function importPaperAuthorRelations(
  paperTableId: string,
  authorTableId: string,
  workbook: XLSX.WorkBook,
  _paperFields?: DataFieldItem[]
) {
  log("导入论文-作者关系...");
  const paSheet = workbook.Sheets["paper_authors"];
  if (!paSheet) throw new Error("找不到 paper_authors sheet");
  const paRowsAll = XLSX.utils.sheet_to_json(paSheet, { defval: null }) as Record<string, unknown>[];

  // 有 DOI 的关系
  const paWithDoi = paRowsAll.filter((row) => row.doi_std != null && row.doi_std !== "");
  log(`关系数据（有DOI）: ${paWithDoi.length} 行`);

  if (paWithDoi.length > 0) {
    const relDoiResult = assertSuccess(
      await importRelationDetails({
        tableId: paperTableId,
        relationFieldKey: "authors",
        sourceBusinessKeys: ["doi"],
        targetBusinessKeys: ["author_name_norm"],
        targetTableId: authorTableId,
        sourceMapping: { doi_std: "doi" },
        targetMapping: { author_name_norm: "author_name_norm" },
        attributeMapping: {
          author_order: "author_order",
          is_first_author: "is_first_author",
          is_corresponding_author: "is_corresponding_author",
        },
        rows: paWithDoi,
        userId: ADMIN_USER_ID,
      }),
      "导入有DOI论文-作者关系"
    );
    log(`有DOI关系导入: 创建 ${relDoiResult.created}, 错误 ${relDoiResult.errors.length}`);
    if (relDoiResult.errors.length > 0) {
      log(`错误 (前10条):`);
      for (const err of relDoiResult.errors.slice(0, 10)) {
        log(`  行 ${err.row}: ${err.message}`);
      }
    }
  }

  // 无 DOI 的关系（用 paper_title 匹配）
  const paWithoutDoi = paRowsAll.filter((row) => !row.doi_std || row.doi_std === "");
  log(`关系数据（无DOI）: ${paWithoutDoi.length} 行`);

  if (paWithoutDoi.length > 0) {
    const relTitleResult = assertSuccess(
      await importRelationDetails({
        tableId: paperTableId,
        relationFieldKey: "authors",
        sourceBusinessKeys: ["paper_title"],
        targetBusinessKeys: ["author_name_norm"],
        targetTableId: authorTableId,
        sourceMapping: { paper_title: "paper_title" },
        targetMapping: { author_name_norm: "author_name_norm" },
        attributeMapping: {
          author_order: "author_order",
          is_first_author: "is_first_author",
          is_corresponding_author: "is_corresponding_author",
        },
        rows: paWithoutDoi,
        userId: ADMIN_USER_ID,
      }),
      "导入无DOI论文-作者关系"
    );
    log(`无DOI关系导入: 创建 ${relTitleResult.created}, 错误 ${relTitleResult.errors.length}`);
    if (relTitleResult.errors.length > 0) {
      log(`错误 (前10条):`);
      for (const err of relTitleResult.errors.slice(0, 10)) {
        log(`  行 ${err.row}: ${err.message}`);
      }
    }
  }
}

// ── 增量模式 ──

async function incrementalImport() {
  log("=== 增量补充模式 ===");

  // 1. 获取现有表
  const authorTable = await db.dataTable.findUnique({ where: { name: "作者" } });
  if (!authorTable) throw new Error("作者表不存在，请先运行全量导入");

  const paperTable = await db.dataTable.findUnique({ where: { name: "论文" } });
  if (!paperTable) throw new Error("论文表不存在，请先运行全量导入");

  const authorTableId = authorTable.id;
  const paperTableId = paperTable.id;

  log(`作者表: ${authorTableId}`);
  log(`论文表: ${paperTableId}`);

  // 1b. 更新论文表 businessKeys 以支持 paper_title 匹配（无 DOI 论文）
  log("更新论文表业务唯一键...");
  await db.dataTable.update({
    where: { id: paperTableId },
    data: { businessKeys: ["doi", "paper_title"] },
  });
  log("业务唯一键已更新为 [doi, paper_title]");

  // 2. 补充字段定义（传入完整字段列表）
  log("补充论文表字段定义...");
  assertSuccess(
    await saveTableFieldsWithRelations({
      tableId: paperTableId,
      fields: getPaperFields(authorTableId),
    }),
    "补充论文表字段"
  );
  log("论文表字段已更新");

  // 3. 读取 Excel
  log("读取 Excel 文件...");
  const workbook = XLSX.readFile(EXCEL_PATH);
  if (!workbook) throw new Error("无法读取 Excel 文件");

  const paperTableDetail = assertSuccess(await getTable(paperTableId), "获取论文表字段");
  const paperFields = paperTableDetail.fields;

  // 4. 增量更新论文数据
  log("增量更新论文数据...");
  const papersSheet = workbook.Sheets["papers_final"];
  if (!papersSheet) throw new Error("找不到 papers_final sheet");
  const paperRowsAll = XLSX.utils.sheet_to_json(papersSheet, { defval: null }) as Record<string, unknown>[];

  log(`论文数据: ${paperRowsAll.length} 行`);

  const paperMapping = buildMapping(getPaperColumnMapping(), paperRowsAll[0]);

  const paperWithDoi = paperRowsAll.filter((row) => row.doi_std != null && row.doi_std !== "");
  const paperWithoutDoi = paperRowsAll.filter((row) => !row.doi_std || row.doi_std === "");

  log(`有 DOI 论文: ${paperWithDoi.length} 行，无 DOI 论文: ${paperWithoutDoi.length} 行`);

  // 有 DOI 的：overwrite 策略
  if (paperWithDoi.length > 0) {
    const withDoiResult = assertSuccess(
      await importData(paperTableId, ADMIN_USER_ID, paperWithDoi, paperMapping, {
        uniqueField: "doi",
        strategy: "overwrite",
      }, paperFields, { businessKeys: ["doi"] }),
      "更新有DOI论文"
    );
    log(`有DOI论文: 创建 ${withDoiResult.created}, 更新 ${withDoiResult.updated}, 跳过 ${withDoiResult.skipped}, 错误 ${withDoiResult.errors.length}`);
  }

  // 无 DOI 的：overwrite 策略（用 paper_title 匹配）
  if (paperWithoutDoi.length > 0) {
    const withoutDoiResult = assertSuccess(
      await importData(paperTableId, ADMIN_USER_ID, paperWithoutDoi, paperMapping, {
        uniqueField: "paper_title",
        strategy: "overwrite",
      }, paperFields, { businessKeys: ["paper_title"] }),
      "更新无DOI论文"
    );
    log(`无DOI论文: 创建 ${withoutDoiResult.created}, 更新 ${withoutDoiResult.updated}, 跳过 ${withoutDoiResult.skipped}, 错误 ${withoutDoiResult.errors.length}`);
  }

  // 5. 补充作者关系（有 DOI + 无 DOI）
  await importPaperAuthorRelations(paperTableId, authorTableId, workbook, paperFields);
}

// ── 主流程 ──

async function main() {
  try {
    if (INCREMENTAL) {
      await incrementalImport();
    } else {
      const { authorTableId, paperTableId } = await setupTables();
      await importAllData(authorTableId, paperTableId);
    }
    log("\n导入完成!");
  } catch (error) {
    console.error("导入失败:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
```

- [ ] **Step 2: 运行增量导入**

先启动 dev server 确保数据库可用，然后执行：

```bash
npx tsx scripts/import-papers.ts --incremental
```

预期输出：字段更新成功，论文数据 overwrite 成功（约 173 篇），作者关系导入成功（约 871 条），错误数应为 0 或极少。

- [ ] **Step 3: 验证结果**

在浏览器打开应用，检查论文表：
1. 新增字段（卷号、影响因子、CCF分类等）是否出现在列中
2. 随机选择几篇论文，验证 DOI、volume、impact_factor 等字段是否有值
3. 打开任意论文的作者关系子表，验证作者列表完整
4. 确认无 DOI 论文也有作者关系记录

- [ ] **Step 4: 提交**

```bash
git add scripts/import-papers.ts docs/superpowers/specs/2026-04-04-paper-import-incremental-design.md
git commit -m "feat: add incremental import mode with complete field mapping for papers"
```
