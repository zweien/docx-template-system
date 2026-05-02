import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/agent2/model-resolver";
import { chatSchema } from "@/validators/editor-ai";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = chatSchema.parse(body);

    const { model } = await resolveModel(parsed.model, session.user.id);

    let systemPrompt = "你是一个专业的报告写作助手。用户正在撰写报告，你可以帮助润色、改写、扩展、分析文本。\n\n";

    if (parsed.context?.sectionContent) {
      systemPrompt += `当前章节内容（供参考）：\n${parsed.context.sectionContent.slice(0, 4000)}\n\n`;
    }

    if (parsed.context?.pinnedSelections?.length) {
      systemPrompt += `用户引用的文本片段：\n${parsed.context.pinnedSelections.map((s, i) => `[引用 ${i + 1}]: ${s}`).join("\n\n")}\n\n`;
    }

    systemPrompt += "请用中文回复。如果用户要求修改文本，直接返回修改后的内容。";

    const result = streamText({
      model,
      system: systemPrompt,
      messages: parsed.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[Editor AI Chat Error]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
