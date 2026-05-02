import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/agent2/model-resolver";
import { getAction, renderPrompt } from "@/lib/services/editor-ai-action.service";
import { executeActionSchema } from "@/validators/editor-ai";

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
    const parsed = executeActionSchema.parse(body);

    let systemPrompt: string;
    let userMessage: string;

    if (parsed.actionId) {
      const actionResult = await getAction(parsed.actionId);
      if (!actionResult.success) {
        return new Response(JSON.stringify({ error: actionResult.error }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      systemPrompt = "你是一个专业的文本编辑助手。请根据用户指令处理提供的文本，直接返回处理后的结果，不要添加多余的解释。";
      userMessage = renderPrompt(actionResult.data.prompt, {
        selection: parsed.selection,
        context: parsed.context,
        instruction: parsed.instruction,
      });
    } else {
      systemPrompt = "你是一个专业的文本编辑助手。请根据用户指令处理提供的文本，直接返回处理后的结果。";
      userMessage = parsed.instruction || parsed.prompt || "";
      if (parsed.selection) {
        userMessage += "\n\n待处理文本：\n" + parsed.selection;
      }
      if (parsed.context) {
        userMessage += "\n\n上下文：\n" + parsed.context;
      }
    }

    const modelId = parsed.model || process.env.AI_MODEL || "gpt-4o";
    const { model, providerName, extraParams } = await resolveModel(modelId, session.user.id);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      providerOptions: extraParams
        ? { [providerName]: extraParams } as Record<string, unknown> as import("@ai-sdk/provider").SharedV3ProviderOptions
        : undefined,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[Editor AI Execute Error]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
