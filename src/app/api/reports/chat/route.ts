import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";

const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL,
  apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60;

function stripDeleteFromToolDefs(toolDefs: Record<string, unknown>) {
  const patched = JSON.parse(JSON.stringify(toolDefs)) as Record<string, Record<string, unknown>>;
  for (const tool of Object.values(patched)) {
    const operations = (tool as Record<string, unknown>).inputSchema as Record<string, unknown> | undefined;
    const props = operations?.properties as Record<string, unknown> | undefined;
    const items = props?.operations as Record<string, unknown> | undefined;
    if (items && "anyOf" in items && Array.isArray(items.anyOf)) {
      (items as { anyOf: Record<string, unknown>[] }).anyOf = (items as { anyOf: Record<string, unknown>[] }).anyOf.filter(
        (opt) => !((opt.properties as Record<string, unknown>)?.type as Record<string, unknown>)?.enum || !Array.isArray(((opt.properties as Record<string, unknown>)?.type as Record<string, unknown>)?.enum) || !(((opt.properties as Record<string, unknown>)?.type as Record<string, unknown>)?.enum as unknown[]).includes("delete")
      );
    }
  }
  return patched;
}

const extraSystemPrompt = `
CRITICAL: When modifying an existing block (translating, rewriting, etc.), ALWAYS use "update" operation type. NEVER use "delete" to remove a block and then "add" to replace it. Using "delete" will destroy the block and cause errors.
`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, toolDefinitions } = body;
    const model = openai.chat(process.env.OPENAI_MODEL || "gpt-4o", {
      structuredOutputs: false,
    });
    const patchedToolDefs = stripDeleteFromToolDefs(toolDefinitions);
    const injected = injectDocumentStateMessages(messages);
    const modelMessages = await convertToModelMessages(injected);
    const result = streamText({
      model,
      system: aiDocumentFormats.html.systemPrompt + extraSystemPrompt,
      messages: modelMessages,
      tools: toolDefinitionsToToolSet(patchedToolDefs),
      toolChoice: "required",
      providerOptions: {
        openai: { enable_thinking: false },
      },
    });
    return result.toUIMessageStreamResponse();
  } catch (e: unknown) {
    console.error("[Report AI Chat Error]", e instanceof Error ? e.message : e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
