import { streamText } from "ai";
import { auth } from "@/lib/auth";
import { resolveModel } from "@/lib/agent2/model-resolver";

export const maxDuration = 120;

const SYSTEM_PROMPT = `你是一位专业的科研报告撰写助手。用户会给你：
1. 当前章节的写作要求（prompt）
2. 当前章节已有的内容（existingContent，可能为空）
3. 报告上下文变量（如申请人姓名）
4. 整篇报告的结构

你的任务是根据写作要求，生成高质量的 Markdown 格式内容。

规则：
- 如果已有内容为空或很少，直接根据要求生成完整内容
- 如果已有内容较多，分析现有内容是否满足要求，不满足则改写，满足则续写
- 使用标准 Markdown：# 表示标题，- 表示列表，**粗体** 等
- 只输出 Markdown 内容，不要输出任何解释或 meta 信息
- 内容要与上下文变量中的信息保持一致`;

function buildUserMessage(body: {
  prompt: string;
  target: string;
  existingContent?: string;
  context?: Record<string, string>;
  documentStructure?: { id: string; title: string }[];
}): string {
  const parts: string[] = [];

  parts.push(`## 当前章节：${body.target}`);
  parts.push(`\n## 写作要求\n${body.prompt}`);

  if (body.existingContent && body.existingContent.trim().length > 0) {
    parts.push(`\n## 已有内容\n${body.existingContent}`);
  } else {
    parts.push(`\n## 已有内容\n（空）`);
  }

  if (body.context && Object.keys(body.context).length > 0) {
    parts.push(`\n## 上下文变量\n`);
    for (const [key, value] of Object.entries(body.context)) {
      parts.push(`- ${key}: ${value}`);
    }
  }

  if (body.documentStructure && body.documentStructure.length > 0) {
    parts.push(`\n## 报告结构\n`);
    for (const sec of body.documentStructure) {
      parts.push(`- ${sec.title}`);
    }
  }

  return parts.join("\n");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { id, sectionId } = await params;
    const body = await req.json();

    const modelId = process.env.AI_MODEL || "gpt-4o";
    const { model, providerName, extraParams } = await resolveModel(modelId, session.user.id);

    const userMessage = buildUserMessage({
      prompt: body.prompt,
      target: body.target,
      existingContent: body.existingContent,
      context: body.context,
      documentStructure: body.documentStructure,
    });

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      providerOptions: extraParams ? { [providerName]: extraParams } as Record<string, unknown> as import("@ai-sdk/provider").SharedV3ProviderOptions : undefined,
    });

    return result.toTextStreamResponse();
  } catch (e: unknown) {
    console.error("[Section Generate Error]", e instanceof Error ? e.stack : e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
