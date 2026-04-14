// src/lib/agent2/context-builder.ts

import { listTables, getTableSchema } from "./tool-helpers";

// 系统提示缓存（30 秒 TTL）
let syspromptCache: { text: string; expiresAt: number } | null = null;
const SYSPROMPT_TTL = 30_000;

export function invalidateSyspromptCache(): void {
  syspromptCache = null;
}

export async function buildSystemPrompt(tableId?: string): Promise<string> {
  // When tableId is provided, each table gets a different prompt — skip global cache
  if (!tableId && syspromptCache && Date.now() < syspromptCache.expiresAt) {
    return syspromptCache.text;
  }

  let tableContext = "";
  let currentTableContext = "";
  let mcpContext = "";
  let tablesResult: Awaited<ReturnType<typeof listTables>> | null = null;

  try {
    const { getEnabledMcpServers } = await import("@/lib/services/agent2-mcp.service");
    const serversResult = await getEnabledMcpServers();
    if (serversResult.success && serversResult.data.length > 0) {
      mcpContext = "\n## 可用的 MCP 外部工具\n";
      mcpContext += "你还可以使用以下 MCP 外部工具来获取外部数据。工具名称格式为 `mcp__服务器名__工具名`。\n\n";
      for (const server of serversResult.data) {
        const config = server.config as Record<string, unknown>;
        mcpContext += `- **${server.name}** (${server.transportType}): ${config.url || config.command || ""}\n`;
      }
      mcpContext += "\n提示：使用 MCP 工具前，先了解该工具的参数要求。MCP 工具名称前缀为 `mcp__`。\n";
    }
  } catch {
    // MCP 上下文获取失败不影响系统提示
  }

  try {
    tablesResult = await listTables();
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

  // Build current table context when tableId is provided
  if (tableId) {
    try {
      const schemaResult = await getTableSchema(tableId);

      if (schemaResult.success) {
        const s = schemaResult.data;
        const fieldsList = s.fields
          .map(f => {
            let desc = `- ${f.label} (${f.key}, 类型: ${f.type})`;
            if (f.required) desc += " [必填]";
            if (f.options?.length) desc += ` [选项: ${f.options.join("/")}]`;
            if (f.relationTo) desc += ` [关联→${f.relationTo}]`;
            return desc;
          })
          .join("\n");

        // Get recordCount from tablesResult if available, otherwise fetch it
        let recordCount = 0;
        if (tablesResult?.success) {
          const tableInfo = tablesResult.data.find(t => t.id === tableId);
          if (tableInfo) recordCount = tableInfo.recordCount;
        } else {
          // Fallback: fetch the current table info if tablesResult is not available
          const fallbackResult = await listTables();
          if (fallbackResult.success) {
            const tableInfo = fallbackResult.data.find(t => t.id === tableId);
            if (tableInfo) recordCount = tableInfo.recordCount;
          }
        }

        currentTableContext = `
## 当前数据表（用户正在查看的页面）
表名：${s.name}（ID: ${s.id}）
描述：${s.description || "无"}
记录数：${recordCount}
字段：
${fieldsList}

用户当前正在查看此数据表，你应优先针对此表进行问答和操作。
`;
      }
    } catch {
      // Current table context fetch failure should not break the prompt
    }
  }

  const text = `你是一个系统集成 AI 助手，能够操作本系统的数据表、模板和记录。

## 能力范围
- 查询和管理数据表（查看、搜索、聚合）
- 创建、更新、删除记录
- 查看和生成文档（基于模板）
- 生成数据可视化图表
- 获取当前时间
- 通过 DOI 查询并导入论文（fetchPaperByDOI）
- 解析用户输入的论文文本并导入（parsePaperText）
- 导入论文到论文表，自动匹配/创建作者（importPaper）

## 工作原则
1. 先查询再操作 — 在修改数据前，先确认目标记录或数据
2. 确认重要操作 — 创建、更新、删除操作需要用户确认
3. 解释操作结果 — 每次操作后清晰说明结果
4. 主动提供帮助 — 根据用户意图推荐合适的工具
5. 批量导入 — 用户上传文件后，解析内容并使用 batchCreateRecords 批量导入
6. 论文导入流程 — 用户提到"导入论文"时：先用 parsePaperText 解析文本或 fetchPaperByDOI 获取 DOI 信息，展示结果让用户确认，再调用 importPaper 导入。逐条确认。
7. 确认流程 — 调用需要确认的工具（createRecord, updateRecord, deleteRecord, batchDeleteRecords, importPaper 等）时：
   - 工具会返回 { _needsConfirm: true }，表示操作已暂停等待用户确认
   - 收到此响应后，你必须停止生成，不要再次调用相同或类似的工具
   - 简短告知用户操作正在等待确认，用户可以在确认框中查看详情
   - 等待用户在界面中确认或拒绝后再继续
   - 当用户发送"确认执行"时，如果历史消息中该工具的输出包含 { success: true, message: "..." }，说明操作已被用户确认并成功执行，直接总结结果即可，绝对不要再次调用该工具
8. 删除操作流程 — 当用户要求删除记录时：
   - 如果用户提供了明确的记录 ID，直接调用 deleteRecord
   - 如果用户提供了模糊描述（如"删除论文 Attention Is All You Need"），先用 searchRecords 查询确认记录
   - deleteRecord 调用后系统会自动在确认框中展示记录详情
   - 不要反复重试调用，等待用户确认即可
${currentTableContext}
${tableContext}
${mcpContext}
## 回答语言
默认使用中文回答，除非用户明确要求其他语言。`;

  // Only cache when tableId is NOT provided (to avoid cache pollution)
  if (!tableId) {
    syspromptCache = { text, expiresAt: Date.now() + SYSPROMPT_TTL };
  }
  return text;
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
