import { db } from "./src/lib/db";
import { convertBlocknoteToEngine } from "./src/modules/reports/converter/blocknote-to-engine";
import type { ReportTemplateStructure } from "./src/modules/reports/types";

type BlockNoteBlock = Record<string, unknown>;

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

async function main() {
  const draft = await db.reportDraft.findUnique({
    where: { id: "cmofueo7t0007a4bmdakm9u44" },
    include: { template: true },
  });

  if (!draft) {
    console.log("Draft not found");
    return;
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

  console.log("=== Payload ===");
  console.log(JSON.stringify(payload, null, 2));

  await db.$disconnect();
}

main().catch(console.error);
