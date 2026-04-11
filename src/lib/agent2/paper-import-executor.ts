// src/lib/agent2/paper-import-executor.ts
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { syncRelationSubtableValues } from "@/lib/services/data-relation.service";
import type { RelationSubtableValueItem } from "@/types/data-table";

// ── Types ──

export interface PaperInput {
  title_en: string;
  title_cn?: string;
  paper_type?: "journal" | "conference";
  group_name?: string;
  publish_year?: number;
  publish_date?: string;
  conf_start_date?: string;
  conf_end_date?: string;
  venue_name?: string;
  venue_name_cn?: string;
  conf_location?: string;
  doi?: string;
  index_type?: string;
  pub_status?: string;
  archive_status?: string;
  corr_authors?: string;
  inst_rank?: number;
  fund_no?: string;
  paper_url?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  impact_factor?: number;
  issn_isbn?: string;
  ccf_category?: string;
  cas_partition?: string;
  jcr_partition?: string;
  sci_partition?: string;
}

export interface AuthorInput {
  name: string;
  author_order: number;
  is_first_author: "Y" | "N";
  is_corresponding_author: "Y" | "N";
}

export interface ImportResult {
  paperId: string;
  authors: Array<{
    name: string;
    status: "matched" | "created";
    authorId: string;
  }>;
}

// ── Helpers ──

/** 标准化姓名：小写、去空格标点 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-,.]+/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** 获取当前论文表中最大的 paper_id（数字）+1 */
async function nextPaperId(paperTableId: string): Promise<string> {
  const result = await db.$queryRawUnsafe<Array<{ max_id: string | null }>>(
    `SELECT MAX(CAST(data->>'paper_id' AS INTEGER)) as max_id
     FROM "DataRecord" WHERE "tableId" = $1`,
    paperTableId
  );
  const maxId = result[0]?.max_id;
  return maxId ? String(Number(maxId) + 1) : "1";
}

/** 按名称查找"作者"表和"论文"表 */
async function findPaperAndAuthorTables(): Promise<{
  paperTableId: string;
  authorTableId: string;
  authorsFieldId: string;
} | null> {
  const paperTable = await db.dataTable.findFirst({
    where: { name: { contains: "论文" } },
    include: { fields: true },
  });
  if (!paperTable) return null;

  const authorsField = paperTable.fields.find(
    (f) => f.key === "authors" && f.type === "RELATION_SUBTABLE"
  );
  if (!authorsField || !authorsField.relationTo) return null;

  return {
    paperTableId: paperTable.id,
    authorTableId: authorsField.relationTo,
    authorsFieldId: authorsField.id,
  };
}

/** 在作者表中按标准化姓名匹配作者 */
async function matchOrCreateAuthor(
  authorTableId: string,
  name: string,
  userId: string
): Promise<{ id: string; status: "matched" | "created" }> {
  const norm = normalizeName(name);

  const existing = await db.dataRecord.findFirst({
    where: {
      tableId: authorTableId,
      OR: [
        { data: { path: ["name_norm"], string_contains: norm } },
        { data: { path: ["name_cn"], string_contains: norm } },
        { data: { path: ["name_en"], string_contains: norm } },
      ],
    },
  });

  if (existing) {
    return { id: existing.id, status: "matched" };
  }

  const record = await db.dataRecord.create({
    data: {
      tableId: authorTableId,
      data: {
        name_cn: name,
        name_en: name,
        name_norm: norm,
      } as unknown as Prisma.InputJsonValue,
      createdById: userId,
    },
  });

  return { id: record.id, status: "created" };
}

// ── Main executor ──

export async function importPaper(
  paperData: PaperInput,
  authors: AuthorInput[],
  userId: string
): Promise<{ success: true; data: ImportResult } | { success: false; error: string }> {
  try {
    const tables = await findPaperAndAuthorTables();
    if (!tables) {
      return { success: false, error: "未找到论文表或作者表，请确保已运行 seed-papers 初始化" };
    }

    const { paperTableId, authorTableId } = tables;

    // 1. 匹配/创建所有作者
    const authorResults: ImportResult["authors"] = [];

    for (const author of authors) {
      const result = await matchOrCreateAuthor(authorTableId, author.name, userId);
      authorResults.push({
        name: author.name,
        status: result.status,
        authorId: result.id,
      });
    }

    // 2. 创建论文记录
    const paperRecord = await db.dataRecord.create({
      data: {
        tableId: paperTableId,
        data: {
          paper_id: await nextPaperId(paperTableId),
          title_en: paperData.title_en,
          title_cn: paperData.title_cn ?? "",
          paper_type: paperData.paper_type ?? "",
          group_name: paperData.group_name ?? "",
          publish_year: paperData.publish_year ?? null,
          publish_date: paperData.publish_date ?? "",
          conf_start_date: paperData.conf_start_date ?? "",
          conf_end_date: paperData.conf_end_date ?? "",
          venue_name: paperData.venue_name ?? "",
          venue_name_cn: paperData.venue_name_cn ?? "",
          conf_location: paperData.conf_location ?? "",
          doi: paperData.doi ?? "",
          index_type: paperData.index_type ?? "",
          pub_status: paperData.pub_status ?? "",
          archive_status: paperData.archive_status ?? "",
          corr_authors: paperData.corr_authors ?? "",
          inst_rank: paperData.inst_rank ?? null,
          fund_no: paperData.fund_no ?? "",
          paper_url: paperData.paper_url ?? "",
          volume: paperData.volume ?? "",
          issue: paperData.issue ?? "",
          pages: paperData.pages ?? "",
          impact_factor: paperData.impact_factor ?? null,
          issn_isbn: paperData.issn_isbn ?? "",
          ccf_category: paperData.ccf_category ?? "",
          cas_partition: paperData.cas_partition ?? "",
          jcr_partition: paperData.jcr_partition ?? "",
          sci_partition: paperData.sci_partition ?? "",
        } as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    // 3. 建立论文-作者关联（RELATION_SUBTABLE）
    if (authors.length > 0) {
      const relationItems: RelationSubtableValueItem[] = authors.map((author, idx) => ({
        targetRecordId: authorResults[idx].authorId,
        displayValue: author.name,
        attributes: {
          author_order: author.author_order,
          is_first_author: author.is_first_author,
          is_corresponding_author: author.is_corresponding_author,
        },
        sortOrder: author.author_order,
      }));

      await db.$transaction(async (tx) => {
        await syncRelationSubtableValues({
          tx,
          sourceRecordId: paperRecord.id,
          tableId: paperTableId,
          relationPayload: { authors: relationItems },
        });
      });
    }

    return {
      success: true,
      data: {
        paperId: paperRecord.id,
        authors: authorResults,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `导入论文失败: ${err instanceof Error ? err.message : "未知错误"}`,
    };
  }
}
