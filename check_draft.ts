import { db } from "./src/lib/db";

async function main() {
  const draft = await db.reportDraft.findUnique({
    where: { id: "cmofueo7t0007a4bmdakm9u44" },
    include: { template: true },
  });

  if (!draft) { console.log("not found"); return; }
  console.log("Title:", draft.title);
  console.log("Template:", draft.template.name, draft.template.filePath);
  console.log("Sections keys:", Object.keys(draft.sections as Record<string, unknown>));
  console.log("Section enabled:", JSON.stringify(draft.sectionEnabled));
  console.log("Context:", JSON.stringify(draft.context));

  for (const [k, v] of Object.entries(draft.sections as Record<string, unknown[]>)) {
    const blocks = v || [];
    console.log("\nSection", k, "block count:", blocks.length);
    for (let i = 0; i < Math.min(blocks.length, 3); i++) {
      console.log("  Block", i, ":", JSON.stringify(blocks[i], null, 2).substring(0, 500));
    }
    if (blocks.length > 3) console.log("  ... and", blocks.length - 3, "more blocks");
  }

  await db.$disconnect();
}

main().catch(console.error);
