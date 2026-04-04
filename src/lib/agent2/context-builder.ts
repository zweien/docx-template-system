// src/lib/agent2/context-builder.ts

import { listTables, getTableSchema } from "./tool-helpers";

export async function buildSystemPrompt(): Promise<string> {
  let tableContext = "";

  try {
    const tablesResult = await listTables();
    if (tablesResult.success && tablesResult.data.length > 0) {
      tableContext = "\n## 当前系统数据表概览\n";
      for (const t of tablesResult.data.slice(0, 5)) {
        const schema = await getTableSchema(t.id);
        if (schema.success) {
          tableContext += `\n### ${t.name}（ID: ${t.id}，${t.recordCount} 条记录）\n`;
          tableContext += "字段：" + schema.data.fields
            .map(f => {
              let desc = `${f.label}(${f.type})`;
              if (f.required) desc += "[必填]";
              if (f.options?.length) desc += `[选项: ${f.options.join("/")}]`;
              if ((f as Record<string, unknown>).relationTo) desc += `[关联→${(f as Record<string, unknown>).relationTo}]`;
              return desc;
            })
            .join("、") + "\n";
        }
      }
      tableContext += "\n提示：使用 getTableSchema(tableId) 可获取完整字段定义。如需查询其他表，先用 listTables() 查看所有表。\n";
    }
  } catch {
    // 动态上下文获取失败时不影响系统正常运行
  }

  return `你是一个系统集成 AI 助手，能够操作本系统的数据表、模板和记录。

## 能力范围
- 查询和管理数据表（查看、搜索、聚合）
- 创建、更新、删除记录
- 查看和生成文档（基于模板）
- 生成数据可视化图表
- 获取当前时间

## 工作原则
1. 先查询再操作 — 在修改数据前，先确认目标记录或数据
2. 确认重要操作 — 创建、更新、删除操作需要用户确认
3. 解释操作结果 — 每次操作后清晰说明结果
4. 主动提供帮助 — 根据用户意图推荐合适的工具
5. 批量导入 — 用户上传文件后，解析内容并使用 batchCreateRecords 批量导入
${tableContext}
## 回答语言
默认使用中文回答，除非用户明确要求其他语言。`;
}

export function truncateMessages<T extends { role: string; content: string }>(
  messages: T[],
  maxTokens: number = 100000
): T[] {
  const MAX_TOKENS = maxTokens;
  const TRUNCATE_THRESHOLD = MAX_TOKENS * 0.8;
  const TARGET_TOKENS = MAX_TOKENS * 0.7;

  let estimatedTokens = 0;
  for (const msg of messages) {
    estimatedTokens += Math.ceil(msg.content.length / 3) + 100;
  }

  if (estimatedTokens < TRUNCATE_THRESHOLD) return messages;

  // Truncate from oldest, keep recent messages
  let totalTokens = 0;
  const truncated: T[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = Math.ceil(messages[i].content.length / 3) + 100;
    if (totalTokens + msgTokens > TARGET_TOKENS && truncated.length > 0) break;
    totalTokens += msgTokens;
    truncated.unshift(messages[i]);
  }

  return truncated;
}
