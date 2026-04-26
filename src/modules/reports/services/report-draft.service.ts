import { db } from "@/lib/db";
import type { ReportDraftDetail, ReportTemplateStructure } from "../types";
import { convertBlocknoteToEngine } from "../converter/blocknote-to-engine";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const REPORT_ENGINE_URL = process.env.REPORT_ENGINE_URL || "http://localhost:8066";

type BlockNoteBlock = Record<string, unknown>;

function initDraftSections(structure: ReportTemplateStructure): Record<string, BlockNoteBlock[]> {
  const sections: Record<string, BlockNoteBlock[]> = {};
  for (const s of structure.sections) {
    const th = s.template_headings;
    if (th && th.length > 0) {
      sections[s.id] = th.map((h, idx) => ({
        id: `heading-${s.id}-${idx}`,
        type: "heading",
        props: { level: h.level },
        content: [{ type: "text", text: h.text }],
        children: [],
      }));
    } else {
      sections[s.id] = [
        {
          id: `heading-${s.id}`,
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: s.title || s.id }],
          children: [],
        },
      ];
    }
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

export async function listReportDrafts(userId: string): Promise<ServiceResult<Record<string, unknown>[]>> {
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

export async function getReportDraft(id: string, userId: string): Promise<ServiceResult<ReportDraftDetail>> {
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
        template: {
          ...draft.template,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parsedStructure: draft.template.parsedStructure as any,
        },
        context: draft.context as Record<string, string>,
        sections: draft.sections as Record<string, BlockNoteBlock[]>,
        attachments: draft.attachments as Record<string, BlockNoteBlock[]>,
        sectionEnabled: draft.sectionEnabled as Record<string, boolean>,
        status: draft.status,
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
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
): Promise<ServiceResult<{ id: string; title: string }>> {
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
        title: title || "未命名报告",
        context: initContext(structure),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sections: initDraftSections(structure) as any,
        sectionEnabled: initSectionEnabled(structure),
      },
    });
    return { success: true, data: { id: draft.id, title: draft.title } };
  } catch (e: unknown) {
    return { success: false, error: { code: "CREATE_FAILED", message: e instanceof Error ? e.message : "创建报告草稿失败" } };
  }
}

export async function updateReportDraft(
  id: string,
  userId: string,
  data: {
    title?: string;
    context?: Record<string, string>;
    sections?: Record<string, BlockNoteBlock[]>;
    attachments?: Record<string, BlockNoteBlock[]>;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(data.sections !== undefined && { sections: data.sections as any }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(data.attachments !== undefined && { attachments: data.attachments as any }),
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
        sections: draft.sections as Record<string, BlockNoteBlock[]>,
        attachments: draft.attachments as Record<string, BlockNoteBlock[]>,
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

    return { success: true, data: response as unknown as Response };
  } catch (e: unknown) {
    return { success: false, error: { code: "EXPORT_FAILED", message: e instanceof Error ? e.message : "导出报告失败" } };
  }
}

function stripTemplateHeadings(
  blocks: { type: string }[],
  secMeta: { template_headings?: { text: string; level: number }[] }
): { type: string }[] {
  const th = secMeta.template_headings;
  if (!th || th.length === 0) return blocks;
  const n = th.length;
  let headingCount = 0;
  for (const b of blocks) {
    if (b.type === "heading") headingCount++;
    else break;
  }
  if (headingCount >= n) return blocks.slice(n);
  return blocks;
}

function buildPayload(
  draftData: {
    context: Record<string, string>;
    sections: Record<string, BlockNoteBlock[]>;
    attachments: Record<string, BlockNoteBlock[]>;
    sectionEnabled: Record<string, boolean>;
  },
  structure: ReportTemplateStructure
): Record<string, unknown> {
  const sections = structure.sections.map((secMeta) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawBlocks = (draftData.sections[secMeta.id] || []) as any[];
    const blocks = convertBlocknoteToEngine(rawBlocks);
    const stripped = stripTemplateHeadings(blocks, secMeta);
    return {
      id: secMeta.id,
      placeholder: secMeta.placeholder,
      flag_name: secMeta.flag_name,
      enabled: draftData.sectionEnabled[secMeta.id] ?? true,
      blocks: stripped,
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
