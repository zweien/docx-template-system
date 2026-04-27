import { db } from "../src/lib/db";

const REPORT_ENGINE_URL = process.env.REPORT_ENGINE_URL || "http://localhost:8066";

function convertBlocknoteToEngine(blocks: any[]) {
  const result: any[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (!block || !block.type) { i++; continue; }
    switch (block.type) {
      case "heading":
        result.push({ type: "heading", text: extractText(block.content), level: block.props?.level || 2 });
        break;
      case "paragraph": {
        result.push({ type: "paragraph", text: extractText(block.content) });
        break;
      }
      case "image": {
        const url = block.props?.url || block.props?.src || "";
        if (url) result.push({ type: "image", path: url, caption: block.props?.caption || "" });
        break;
      }
    }
    i++;
  }
  return result;
}

function extractText(content: any): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter((s: any) => s && typeof s === "object" && "text" in s).map((s: any) => s.text || "").join("");
  }
  return "";
}

function stripTemplateHeadings(blocks: any[], secMeta: any) {
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

function buildPayload(draftData: any, structure: any) {
  const sections = structure.sections.map((secMeta: any) => {
    const rawBlocks = draftData.sections[secMeta.id] || [];
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
    attachments_bundle: structure.attachments_bundle ? { enabled: true, ...structure.attachments_bundle } : null,
    style_map: {},
  };
}

async function main() {
  const draft = await db.reportDraft.findUnique({
    where: { id: 'cmoftycac0002a4bmctvklag4' },
    include: { template: true },
  });

  if (!draft) {
    console.log("Draft not found");
    return;
  }

  const structure = draft.template.parsedStructure as any;
  const payload = buildPayload({
    context: draft.context as any,
    sections: draft.sections as any,
    attachments: draft.attachments as any,
    sectionEnabled: draft.sectionEnabled as any,
  }, structure);

  console.log("Payload sections count:", payload.sections.length);
  console.log("First section blocks:", JSON.stringify(payload.sections[0]?.blocks, null, 2));

  const response = await fetch(`${REPORT_ENGINE_URL}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template_path: draft.template.filePath,
      payload,
      output_filename: `${draft.title}.docx`,
    }),
  });

  console.log("Report-engine status:", response.status);
  if (!response.ok) {
    const err = await response.text();
    console.log("Report-engine error:", err);
  } else {
    console.log("Success!");
  }
}

main().catch(console.error).finally(() => db.$disconnect());
