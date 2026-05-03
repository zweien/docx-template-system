import { convertToModelMessages, streamText, jsonSchema, tool } from "ai";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/agent2/model-resolver";

export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripDeleteFromToolDefs(toolDefs: Record<string, any>) {
  const patched = JSON.parse(JSON.stringify(toolDefs));
  for (const toolDef of Object.values(patched)) {
    const items = (toolDef as any)?.inputSchema?.properties?.operations?.items;
    if (items?.anyOf) {
      items.anyOf = items.anyOf.filter(
        (opt: any) => !(opt.properties?.type?.enum?.includes("delete"))
      );
    }
  }
  return patched;
}

const extraSystemPrompt = `
CRITICAL: When modifying an existing block (translating, rewriting, etc.), ALWAYS use "update" operation type. NEVER use "delete" to remove a block and then "add" to replace it. Using "delete" will destroy the block and cause errors.
`;

// From @blocknote/xl-ai — HTML document format system prompt
const HTML_SYSTEM_PROMPT = `You're manipulating a text document using HTML blocks.
Make sure to follow the json schema provided. When referencing ids they MUST be EXACTLY the same (including the trailing $).
List items are 1 block with 1 list item each, so block content \`<ul><li>item1</li></ul>\` is valid, but \`<ul><li>item1</li><li>item2</li></ul>\` is invalid. We'll merge them automatically.
For code blocks, you can use the \`data-language\` attribute on a <code> block (wrapped with <pre>) to specify the language.

If the user requests updates to the document, use the "applyDocumentOperations" tool to update the document.
---
IF there is no selection active in the latest state, first, determine what part of the document the user is talking about. You SHOULD probably take cursor info into account if needed.
  EXAMPLE: if user says "below" (without pointing to a specific part of the document) he / she probably indicates the block(s) after the cursor.
  EXAMPLE: If you want to insert content AT the cursor position (UNLESS indicated otherwise by the user), then you need \`referenceId\` to point to the block before the cursor with position \`after\` (or block below and \`before\`
---
`;

// Reimplementation of @blocknote/xl-ai's injectDocumentStateMessages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function injectDocumentStateMessages(messages: any[]): any[] {
  return messages.flatMap((msg) => {
    if (msg.role === "user" && msg.metadata?.documentState) {
      const ds = msg.metadata.documentState;
      const parts: any[] = [];
      if (ds.selection) {
        parts.push(
          { type: "text", text: "This is the latest state of the selection (ignore previous selections, you MUST issue operations against this latest version of the selection):" },
          { type: "text", text: JSON.stringify(ds.selectedBlocks) },
          { type: "text", text: "This is the latest state of the entire document (INCLUDING the selected text), you can use this to find the selected text to understand the context (but you MUST NOT issue operations against this document, you MUST issue operations against the selection):" },
          { type: "text", text: JSON.stringify(ds.blocks) }
        );
      } else {
        parts.push(
          { type: "text", text: `There is no active selection. This is the latest state of the document (ignore previous documents, you MUST issue operations against this latest version of the document). The cursor is BETWEEN two blocks as indicated by cursor: true.${ds.isEmptyDocument ? " Because the document is empty, YOU MUST first update the empty block before adding new blocks." : " Prefer updating existing blocks over removing and adding (but this also depends on the user's question)."}` },
          { type: "text", text: JSON.stringify(ds.blocks) }
        );
      }
      return [{ role: "assistant", id: `assistant-document-state-${msg.id}`, parts }, msg];
    }
    return [msg];
  });
}

// Reimplementation of @blocknote/xl-ai's toolDefinitionsToToolSet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function toolDefinitionsToToolSet(toolDefs: Record<string, any>): Promise<any> {
  const entries = await Promise.all(
    Object.entries(toolDefs).map(async ([name, def]) => {
      const d = def as any;
      return [
        name,
        tool({
          ...d,
          inputSchema: jsonSchema(d.inputSchema),
          outputSchema: jsonSchema(d.outputSchema),
        }),
      ] as const;
    })
  );
  return Object.fromEntries(entries);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messages, toolDefinitions } = body;
    const modelId = process.env.AI_MODEL || "gpt-4o";
    const { model, providerName, extraParams } = await resolveModel(modelId, session.user.id);
    const patchedToolDefs = stripDeleteFromToolDefs(toolDefinitions);
    const injected = injectDocumentStateMessages(messages);
    const modelMessages = await convertToModelMessages(injected);
    const tools = await toolDefinitionsToToolSet(patchedToolDefs);
    const result = streamText({
      model,
      system: HTML_SYSTEM_PROMPT + extraSystemPrompt,
      messages: modelMessages,
      tools,
      toolChoice: "required",
      providerOptions: extraParams ? { [providerName]: extraParams } as Record<string, unknown> as import("@ai-sdk/provider").SharedV3ProviderOptions : undefined,
    });
    return result.toUIMessageStreamResponse();
  } catch (e: unknown) {
    console.error("[Report AI Chat Error]", e instanceof Error ? e.stack : e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
