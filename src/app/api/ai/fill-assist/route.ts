import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { streamText } from "ai";
import { randomUUID } from "crypto";
import { z } from "zod";
import { resolveModel } from "@/lib/agent2/model-resolver";
import { createTools } from "@/lib/agent2/tools";
import { db } from "@/lib/db";

const SYSTEM_PROMPT = `你是一个文档表单填充助手。用户正在填写一个文档模板的表单，你需要根据用户的需求，为表单字段生成合适的填充建议。

## 核心能力

你可以使用工具来查询系统中的数据，帮助用户更准确地填写表单：
- **listTables**: 查看系统中有哪些数据表
- **getTableSchema**: 查看某个数据表的字段结构
- **searchRecords**: 搜索数据表中的记录（支持筛选、分页）
- **getRecord**: 获取单条记录的详情

例如，如果用户说"帮我查找张三的联系方式"，你可以使用 searchRecords 查询用户表，获取张三的信息后填入表单。

## 规则

1. 优先使用工具查询真实数据来填充表单，而不是编造数据
2. 查询到数据后，将结果映射到表单字段生成填充建议
3. 你的回复应该包含两部分：
   - 简短的文字说明你做了什么（如查到了什么数据）
   - 一个 JSON 代码块，格式为 \`\`\`json ... \`\`\`，包含字段填充建议
4. JSON 格式为 { "field_key": "建议值" }，只包含你能确定值的字段
5. 对于不确定的字段，不要包含在 JSON 中
6. 如果用户只提问而不要求填充，正常回答即可，不需要输出 JSON
7. **重要**：对于标记为 [CHOICE_SINGLE] 或 [CHOICE_MULTI] 的字段，其可选值会在字段后列出（格式为"显示名(实际值)"或仅"显示名"当两者相同时）。你必须且只能从列出的选项中选择，并在 JSON 中使用括号内的实际值。对于 CHOICE_MULTI 字段，值应为数组，如 { "field_key": ["value1", "value2"] }`;

const fillAssistSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
  templateId: z.string().optional(),
  context: z.object({
    templateName: z.string(),
    fields: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.string(),
        description: z.string().optional(),
        options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
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
    const { model, providerName, extraParams } = await resolveModel(modelId, session.user.id);

    // Build context-aware system prompt
    const fieldsDescription = validated.context.fields
      .map((f) => {
        const current = validated.context.currentValues[f.key];
        const suffix = current ? `（当前值: ${current})` : "";
        const desc = f.description ? ` — ${f.description}` : "";
        const options = f.options && f.options.length > 0
          ? `，可选值: [${f.options.map((o) => o.label === o.value ? o.label : `${o.label}(${o.value})`).join(", ")}]`
          : "";
        return `- ${f.label} (${f.key}) [${f.type}]${desc}${suffix}${options}`;
      })
      .join("\n");

    // Fetch template-specific prompt if templateId provided
    let customPrompt = "";
    if (validated.templateId) {
      const template = await db.template.findUnique({
        where: { id: validated.templateId },
        select: { fillAssistPrompt: true },
      });
      if (template?.fillAssistPrompt) {
        customPrompt = `\n## 模板专属指令\n${template.fillAssistPrompt}\n`;
      }
    }

    const systemPrompt = [
      SYSTEM_PROMPT,
      customPrompt,
      "## 当前表单信息",
      `模板: ${validated.context.templateName}`,
      "",
      "## 可填充字段",
      fieldsDescription,
    ].join("\n");

    const messages = validated.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Create tools — use a fake conversation/message ID since we don't persist
    const fakeConversationId = `fill-assist-${randomUUID()}`;
    const fakeMessageId = randomUUID();
    const tools = createTools(
      fakeConversationId,
      fakeMessageId,
      session.user.id,
      session.user.role
    );

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools,
      providerOptions: extraParams ? { [providerName]: extraParams } as Record<string, unknown> as import("@ai-sdk/provider").SharedV3ProviderOptions : undefined,
      stopWhen: ({ steps }) => steps.length >= 5,
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
