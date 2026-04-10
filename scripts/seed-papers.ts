/**
 * 论文数据导入脚本 (适配 paper_db_airtable_ready_venue_renamed1.xlsx)
 *
 * 用法: npx tsx --tsconfig tsconfig.json scripts/seed-papers.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import * as XLSX from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { FieldType, RelationCardinality } from "../src/generated/prisma/enums.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EXCEL_PATH = "/home/z/codebase/papers/paper_db_airtable_ready_venue_renamed1.xlsx";

function log(msg: string) {
  console.log(`[seed-papers] ${msg}`);
}

// ── Field definitions ──

const AUTHOR_FIELDS = [
  { key: "author_id", label: "作者ID", type: "TEXT" as const, required: true, sortOrder: 0 },
  { key: "name_cn", label: "中文名", type: "TEXT" as const, required: true, sortOrder: 1 },
  { key: "name_en", label: "英文名", type: "TEXT" as const, required: false, sortOrder: 2 },
  { key: "name_norm", label: "标准化名称", type: "TEXT" as const, required: false, sortOrder: 3 },
  { key: "group_name", label: "组别", type: "SELECT" as const, required: false, options: ["优化组", "体系组"], sortOrder: 4 },
  { key: "is_internal", label: "是否内部作者", type: "BOOLEAN" as const, required: false, sortOrder: 5 },
];

function paperFieldsDef(authorTableId: string) {
  return [
    { key: "paper_id", label: "论文ID", type: "TEXT" as const, required: true, sortOrder: 0 },
    { key: "title_en", label: "英文标题", type: "TEXT" as const, required: true, sortOrder: 1 },
    { key: "title_cn", label: "中文标题", type: "TEXT" as const, required: false, sortOrder: 2 },
    { key: "paper_type", label: "论文类型", type: "SELECT" as const, required: false, options: ["journal", "conference"], sortOrder: 3 },
    { key: "group_name", label: "组别", type: "SELECT" as const, required: false, options: ["优化组", "体系组"], sortOrder: 4 },
    { key: "publish_year", label: "发表年份", type: "NUMBER" as const, required: false, sortOrder: 5 },
    { key: "publish_date", label: "发表日期", type: "DATE" as const, required: false, sortOrder: 6 },
    { key: "conf_start_date", label: "会议开始日期", type: "DATE" as const, required: false, sortOrder: 7 },
    { key: "conf_end_date", label: "会议结束日期", type: "DATE" as const, required: false, sortOrder: 8 },
    { key: "venue_name", label: "期刊/会议名", type: "TEXT" as const, required: false, sortOrder: 9 },
    { key: "venue_name_cn", label: "期刊/会议中文名", type: "TEXT" as const, required: false, sortOrder: 10 },
    { key: "conf_location", label: "会议地点", type: "TEXT" as const, required: false, sortOrder: 11 },
    { key: "doi", label: "DOI", type: "TEXT" as const, required: false, sortOrder: 12 },
    { key: "index_type", label: "收录类型", type: "SELECT" as const, required: false, options: ["SCI", "EI", "中文核心", "其他", "无"], sortOrder: 13 },
    { key: "pub_status", label: "刊出状态", type: "SELECT" as const, required: false, options: ["已刊出", "未刊出", "录用待刊"], sortOrder: 14 },
    { key: "archive_status", label: "归档状态", type: "SELECT" as const, required: false, options: ["已归档", "未归档"], sortOrder: 15 },
    { key: "corr_authors", label: "通讯作者", type: "TEXT" as const, required: false, sortOrder: 16 },
    { key: "inst_rank", label: "机构排名", type: "NUMBER" as const, required: false, sortOrder: 17 },
    { key: "fund_no", label: "基金编号", type: "TEXT" as const, required: false, sortOrder: 18 },
    { key: "paper_url", label: "论文链接", type: "TEXT" as const, required: false, sortOrder: 19 },
    { key: "volume", label: "卷", type: "TEXT" as const, required: false, sortOrder: 20 },
    { key: "issue", label: "期", type: "TEXT" as const, required: false, sortOrder: 21 },
    { key: "pages", label: "页码", type: "TEXT" as const, required: false, sortOrder: 22 },
    { key: "impact_factor", label: "影响因子", type: "NUMBER" as const, required: false, sortOrder: 23 },
    { key: "issn_isbn", label: "ISSN/ISBN", type: "TEXT" as const, required: false, sortOrder: 24 },
    { key: "ccf_category", label: "CCF分类", type: "SELECT" as const, required: false, options: ["A", "B", "C", "无"], sortOrder: 25 },
    { key: "cas_partition", label: "中科院分区", type: "SELECT" as const, required: false, options: ["一区TOP", "一区", "二区", "三区", "四区", "无"], sortOrder: 26 },
    { key: "jcr_partition", label: "JCR分区", type: "SELECT" as const, required: false, options: ["一区", "二区", "三区", "四区", "无"], sortOrder: 27 },
    { key: "sci_partition", label: "SCI分区", type: "SELECT" as const, required: false, options: ["一区", "二区", "三区", "四区", "无"], sortOrder: 28 },
    {
      key: "authors",
      label: "作者",
      type: "RELATION_SUBTABLE" as const,
      required: false,
      relationTo: authorTableId,
      displayField: "name_cn",
      relationCardinality: "MULTIPLE" as const,
      inverseRelationCardinality: "MULTIPLE" as const,
      sortOrder: 29,
    },
  ];
}

// ── Excel column → field key ──

const AUTHOR_COL_MAP: Record<string, string> = {
  author_id: "author_id",
  author_name_cn: "name_cn",
  author_name_en: "name_en",
  author_name_norm: "name_norm",
  group_name: "group_name",
  is_internal: "is_internal",
};

const PAPER_COL_MAP: Record<string, string> = {
  paper_id: "paper_id",
  title_en: "title_en",
  title_cn: "title_cn",
  paper_type: "paper_type",
  group_name: "group_name",
  publish_year: "publish_year",
  publish_date: "publish_date",
  conference_start_date: "conf_start_date",
  conference_end_date: "conf_end_date",
  "期刊/会议名称": "venue_name",
  "期刊/会议中文名称": "venue_name_cn",
  conference_location: "conf_location",
  doi: "doi",
  index_type: "index_type",
  publication_status: "pub_status",
  archive_status: "archive_status",
  corresponding_authors: "corr_authors",
  institution_rank: "inst_rank",
  fund_project_no: "fund_no",
  paper_url: "paper_url",
  volume: "volume",
  issue: "issue",
  pages: "pages",
  impact_factor: "impact_factor",
  issn_or_isbn: "issn_isbn",
  ccf_category: "ccf_category",
  cas_partition: "cas_partition",
  jcr_partition: "jcr_partition",
  sci_partition: "sci_partition",
};

function mapRow(row: Record<string, unknown>, colMap: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [col, fieldKey] of Object.entries(colMap)) {
    if (col in row && row[col] !== null && row[col] !== undefined) {
      let val = row[col];
      // Convert Date to YYYY-MM-DD
      if (val instanceof Date) {
        val = val.toISOString().split("T")[0];
      }
      out[fieldKey] = val;
    }
  }
  return out;
}

// ── Main ──

async function main() {
  log("读取 Excel...");
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const authorRows = XLSX.utils.sheet_to_json(wb.Sheets["authors"], { defval: null }) as Record<string, unknown>[];
  const paperRows = XLSX.utils.sheet_to_json(wb.Sheets["papers"], { defval: null }) as Record<string, unknown>[];
  const paRows = XLSX.utils.sheet_to_json(wb.Sheets["paper_author"], { defval: null }) as Record<string, unknown>[];
  log(`Excel: ${authorRows.length} authors, ${paperRows.length} papers, ${paRows.length} relations`);

  // Get admin user
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("No admin user");
  log(`Admin: ${admin.name} (${admin.id})`);

  // ── Step 1: Create tables ──
  log("\n=== Step 1: 创建数据表 ===");

  // Clean up existing
  const existingAT = await prisma.dataTable.findUnique({ where: { name: "作者" } });
  if (existingAT) {
    log("删除已有作者表...");
    await prisma.dataRelationRow.deleteMany({
      where: { field: { tableId: existingAT.id } },
    });
    await prisma.dataRelationRow.deleteMany({
      where: { targetRecord: { tableId: existingAT.id } },
    });
    await prisma.dataRecord.deleteMany({ where: { tableId: existingAT.id } });
    await prisma.dataField.deleteMany({ where: { tableId: existingAT.id } });
    await prisma.dataView.deleteMany({ where: { tableId: existingAT.id } });
    await prisma.dataTable.delete({ where: { id: existingAT.id } });
  }

  const existingPT = await prisma.dataTable.findUnique({ where: { name: "论文" } });
  if (existingPT) {
    log("删除已有论文表...");
    await prisma.dataRelationRow.deleteMany({
      where: { field: { tableId: existingPT.id } },
    });
    await prisma.dataRelationRow.deleteMany({
      where: { targetRecord: { tableId: existingPT.id } },
    });
    await prisma.dataRecord.deleteMany({ where: { tableId: existingPT.id } });
    await prisma.dataField.deleteMany({ where: { tableId: existingPT.id } });
    await prisma.dataView.deleteMany({ where: { tableId: existingPT.id } });
    await prisma.dataTable.delete({ where: { id: existingPT.id } });
  }

  // Create authors table
  const authorTable = await prisma.dataTable.create({
    data: { name: "作者", description: "论文作者信息", createdById: admin.id },
  });
  const authorTableId = authorTable.id;
  log(`创建作者表: ${authorTableId}`);

  // Create author fields
  for (const f of AUTHOR_FIELDS) {
    await prisma.dataField.create({
      data: {
        tableId: authorTableId,
        key: f.key,
        label: f.label,
        type: f.type as any,
        required: f.required,
        options: (f as any).options ?? undefined,
        sortOrder: f.sortOrder,
      },
    });
  }
  // Set business keys
  await prisma.dataTable.update({
    where: { id: authorTableId },
    data: { businessKeys: ["author_id"] },
  });
  log("作者表字段已配置");

  // Create papers table
  const paperTable = await prisma.dataTable.create({
    data: { name: "论文", description: "论文信息管理", createdById: admin.id },
  });
  const paperTableId = paperTable.id;
  log(`创建论文表: ${paperTableId}`);

  // Create paper fields
  const paperFields = paperFieldsDef(authorTableId);
  let authorsFieldId = "";
  for (const f of paperFields) {
    const created = await prisma.dataField.create({
      data: {
        tableId: paperTableId,
        key: f.key,
        label: f.label,
        type: f.type as any,
        required: f.required,
        options: (f as any).options ?? undefined,
        relationTo: (f as any).relationTo ?? null,
        displayField: (f as any).displayField ?? null,
        relationCardinality: (f as any).relationCardinality ?? null,
        sortOrder: f.sortOrder,
      },
    });
    if (f.key === "authors") {
      authorsFieldId = created.id;
    }
  }

  // Create inverse field on authors table
  await prisma.dataField.create({
    data: {
      tableId: authorTableId,
      key: "papers_inverse",
      label: "论文",
      type: "RELATION_SUBTABLE",
      required: false,
      relationTo: paperTableId,
      displayField: "title_cn",
      relationCardinality: "MULTIPLE",
      inverseFieldId: authorsFieldId,
      isSystemManagedInverse: true,
      sortOrder: 99,
    },
  });

  // Set business keys
  await prisma.dataTable.update({
    where: { id: paperTableId },
    data: { businessKeys: ["paper_id"] },
  });
  log("论文表字段已配置");

  // ── Step 2: Import authors ──
  log("\n=== Step 2: 导入作者数据 ===");
  let authorCreated = 0;
  for (const row of authorRows) {
    const data = mapRow(row, AUTHOR_COL_MAP);
    // Convert is_internal
    if (data.is_internal !== undefined) {
      data.is_internal = data.is_internal === true || data.is_internal === "Y" || data.is_internal === 1;
    } else {
      delete data.is_internal;
    }
    await prisma.dataRecord.create({
      data: { tableId: authorTableId, data: data as any, createdById: admin.id },
    });
    authorCreated++;
  }
  log(`导入 ${authorCreated} 条作者`);

  // ── Step 3: Import papers ──
  log("\n=== Step 3: 导入论文数据 ===");
  let paperCreated = 0;
  for (const row of paperRows) {
    const data = mapRow(row, PAPER_COL_MAP);
    // Convert Date fields
    for (const key of ["publish_date", "conf_start_date", "conf_end_date"]) {
      if (data[key] instanceof Date) {
        data[key] = (data[key] as Date).toISOString().split("T")[0];
      }
    }
    await prisma.dataRecord.create({
      data: { tableId: paperTableId, data: data as any, createdById: admin.id },
    });
    paperCreated++;
  }
  log(`导入 ${paperCreated} 条论文`);

  // ── Step 4: Create paper-author relations ──
  log("\n=== Step 4: 建立论文-作者关联 ===");

  // Build ID maps
  const authorRecords = await prisma.dataRecord.findMany({
    where: { tableId: authorTableId },
    select: { id: true, data: true },
  });
  const authorIdToRecordId = new Map<string, string>();
  for (const rec of authorRecords) {
    const d = rec.data as Record<string, unknown>;
    const aid = String(d["author_id"] ?? "");
    if (aid) authorIdToRecordId.set(aid, rec.id);
  }
  log(`作者ID映射: ${authorIdToRecordId.size} 条`);

  const paperRecords = await prisma.dataRecord.findMany({
    where: { tableId: paperTableId },
    select: { id: true, data: true },
  });
  const paperIdToRecordId = new Map<string, string>();
  for (const rec of paperRecords) {
    const d = rec.data as Record<string, unknown>;
    const pid = String(d["paper_id"] ?? "");
    if (pid) paperIdToRecordId.set(pid, rec.id);
  }
  log(`论文ID映射: ${paperIdToRecordId.size} 条`);

  // Group paper_author by paper_id, sorted by author_order
  const paByPaper = new Map<string, Array<{ authorId: string; order: number }>>();
  for (const row of paRows) {
    const pid = String(row["paper_id"]);
    const aid = String(row["author_id"]);
    const order = Number(row["author_order"]) || 0;
    if (!pid || !aid) continue;
    const group = paByPaper.get(pid) ?? [];
    group.push({ authorId: aid, order });
    paByPaper.set(pid, group);
  }

  // Create relation rows
  let relCreated = 0;
  let relSkipped = 0;
  for (const [paperId, authors] of paByPaper) {
    const paperRecordId = paperIdToRecordId.get(paperId);
    if (!paperRecordId) {
      relSkipped++;
      continue;
    }
    authors.sort((a, b) => a.order - b.order);
    for (const { authorId, order } of authors) {
      const authorRecordId = authorIdToRecordId.get(authorId);
      if (!authorRecordId) {
        relSkipped++;
        continue;
      }
      await prisma.dataRelationRow.create({
        data: {
          fieldId: authorsFieldId,
          sourceRecordId: paperRecordId,
          targetRecordId: authorRecordId,
          attributes: {},
          sortOrder: order,
        },
      });
      relCreated++;
    }
  }
  log(`关联: 创建 ${relCreated}, 跳过 ${relSkipped}`);

  // ── Step 5: Refresh relation snapshots ──
  log("\n=== Step 5: 刷新关系快照 ===");

  // Refresh paper records (add authors snapshot)
  for (const rec of paperRecords) {
    const relRows = await prisma.dataRelationRow.findMany({
      where: { sourceRecordId: rec.id, fieldId: authorsFieldId },
      orderBy: { sortOrder: "asc" },
      include: { targetRecord: { select: { data: true } } },
    });
    const items = relRows.map((r) => {
      const td = r.targetRecord.data as Record<string, unknown>;
      return {
        targetRecordId: r.targetRecordId,
        displayValue: String(td["name_cn"] ?? r.targetRecordId),
        attributes: r.attributes,
        sortOrder: r.sortOrder,
      };
    });
    const updated = { ...(rec.data as Record<string, unknown>), authors: items };
    await prisma.dataRecord.update({
      where: { id: rec.id },
      data: { data: updated as any },
    });
  }
  log(`已刷新 ${paperRecords.length} 条论文记录的关系快照`);

  // Refresh author records (add papers_inverse snapshot)
  const invField = await prisma.dataField.findFirst({
    where: { tableId: authorTableId, key: "papers_inverse" },
  });
  if (invField) {
    for (const rec of authorRecords) {
      const relRows = await prisma.dataRelationRow.findMany({
        where: { targetRecordId: rec.id, fieldId: authorsFieldId },
        orderBy: { sortOrder: "asc" },
        include: { sourceRecord: { select: { data: true } } },
      });
      const items = relRows.map((r) => {
        const sd = r.sourceRecord.data as Record<string, unknown>;
        return {
          targetRecordId: r.sourceRecordId,
          displayValue: String(sd["title_cn"] ?? sd["title_en"] ?? r.sourceRecordId),
          attributes: r.attributes,
          sortOrder: r.sortOrder,
        };
      });
      const updated = { ...(rec.data as Record<string, unknown>), papers_inverse: items };
      await prisma.dataRecord.update({
        where: { id: rec.id },
        data: { data: updated as any },
      });
    }
    log(`已刷新 ${authorRecords.length} 条作者记录的反向关系快照`);
  }

  log("\n=== 导入完成! ===");
  log(`作者: ${authorCreated} 条`);
  log(`论文: ${paperCreated} 条`);
  log(`关联: ${relCreated} 条`);
}

main()
  .catch((e) => {
    console.error("导入失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
