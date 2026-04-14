import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { streamText } from "ai";
import { z } from "zod";
import { resolveModel } from "@/lib/agent2/model-resolver";

const SYSTEM_PROMPT = `你是一个文档表单填充助手。用户正在填写一个文档模板的表单，你需要根据用户的需求，为表单字段生成合适的填充建议。

## 规则

1. 根据用户的描述和表单上下文，生成字段填充建议
2. 你的回复应该包含两部分：
   - 简短的文字说明你生成了什么
   - 一个 JSON 代码块，格式为 \`\`\`json ... \`\`\`，包含字段填充建议
3. JSON 格式为 { "field_key": "建议值" }，只包含你能确定值的字段
4. 对于不确定的字段，不要包含在 JSON 中
5. 保持专业、简洁的语气
6. 如果用户只提问而不要求填充，正常回答即可，不需要输出 JSON

## 示例回复

根据您的要求，我为您生成了一份关于人工智能发展趋势的报告摘要。

\`\`\`json
{
  "title": "2024年人工智能发展趋势报告",
  "author": "张三",
  "abstract": "本报告分析了人工智能在自然语言处理、计算机视觉等领域的最新进展..."
}
\`\`\``;

const fillAssistSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
  context: z.object({
    templateName: z.string(),
    fields: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.string(),
        description: z.string().optional(),
      })
    ),
    currentValues: z.record(z.string(), z.string()),
  }),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = fillAssistSchema.parse(body);

    const modelId = validated.model || process.env.AI_MODEL || "gpt-4o";
    const model = await resolveModel(modelId, session.user.id);

    // Build context-aware user prompt
    const fieldsDescription = validated.context.fields
      .map((f) => {
        const current = validated.context.currentValues[f.key];
        const suffix = current ? `（当前值: ${current})` : "";
        const desc = f.description ? ` — ${f.description}` : "";
        return `- ${f.label} (${f.key}) [${f.type}]${desc}${suffix}`;
      })
      .join("\n");

    const contextMessage = {
      role: "system" as const,
      content: [
        SYSTEM_PROMPT,
        "",
        "## 当前表单信息",
        `模板: ${validated.context.templateName}`,
        "",
        "## 可填充字段",
        fieldsDescription,
      ].join("\n"),
    };

    const messages = [contextMessage, ...validated.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }))];

    const result = streamText({
      model,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "请求参数无效", details: error.issues },
        { status: 400 }
      );
    }
    console.error("[fill-assist] Error:", error);
    return NextResponse.json(
      { error: "AI 服务暂时不可用" },
      { status: 500 }
    );
  }
}
