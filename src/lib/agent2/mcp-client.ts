import { createMCPClient } from "@ai-sdk/mcp";
import type { MCPClient, MCPClientConfig } from "@ai-sdk/mcp";
import type { Tool } from "ai";
import { getEnabledMcpServers } from "@/lib/services/agent2-mcp.service";

type McpTransport = MCPClientConfig["transport"];

interface McpToolsResult {
  tools: Record<string, Tool>;
  clients: MCPClient[];
}

/**
 * 创建单个 MCP 客户端连接并获取工具
 */
async function createMcpConnection(
  server: {
    name: string;
    transportType: "stdio" | "sse" | "http";
    config: Record<string, unknown>;
  },
  timeout: number = 5000
): Promise<{ client: MCPClient; tools: Record<string, Tool> } | null> {
  try {
    let transport: McpTransport;

    switch (server.transportType) {
      case "stdio": {
        const { Experimental_StdioMCPTransport } = await import(
          "@ai-sdk/mcp/mcp-stdio"
        );
        transport = new Experimental_StdioMCPTransport({
          command: server.config.command as string,
          args: server.config.args as string[] | undefined,
          env: server.config.env as Record<string, string> | undefined,
        });
        break;
      }
      case "sse": {
        transport = {
          type: "sse" as const,
          url: server.config.url as string,
          headers: server.config.headers as Record<string, string> | undefined,
        };
        break;
      }
      case "http": {
        transport = {
          type: "http" as const,
          url: server.config.url as string,
          headers: server.config.headers as Record<string, string> | undefined,
        };
        break;
      }
    }

    const client = await createMCPClient({ transport });

    const toolsPromise = client.tools();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `MCP 服务器 "${server.name}" 连接超时 (${timeout}ms)`
            )
          ),
        timeout
      )
    );

    const rawTools = await Promise.race([toolsPromise, timeoutPromise]);

    // Prefix tool names with mcp__{serverName}__ and add description tag
    const prefixedTools: Record<string, Tool> = {};
    for (const [toolName, toolDef] of Object.entries(rawTools)) {
      const prefixedName = `mcp__${server.name}__${toolName}`;
      const desc = (toolDef as { description?: string }).description;
      prefixedTools[prefixedName] = {
        ...toolDef,
        description: `[MCP: ${server.name}] ${desc || toolName}`,
      } as Tool;
    }

    return { client, tools: prefixedTools };
  } catch (error) {
    console.warn(
      `[mcp-client] Failed to connect to "${server.name}":`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * 获取所有已启用 MCP 服务器的工具
 */
export async function getEnabledMcpTools(): Promise<McpToolsResult> {
  const result: McpToolsResult = {
    tools: {},
    clients: [],
  };

  const serversResult = await getEnabledMcpServers();
  if (!serversResult.success || serversResult.data.length === 0) {
    return result;
  }

  const connections = await Promise.all(
    serversResult.data.map((server) => {
      const timeout =
        typeof server.config.timeout === "number"
          ? (server.config.timeout as number)
          : 5000;
      return createMcpConnection(server, timeout);
    })
  );

  for (const connection of connections) {
    if (connection) {
      result.tools = { ...result.tools, ...connection.tools };
      result.clients.push(connection.client);
    }
  }

  return result;
}

/**
 * 测试 MCP 服务器连接并返回工具列表（不带前缀）
 */
export async function testMcpConnection(
  server: {
    name: string;
    transportType: "stdio" | "sse" | "http";
    config: Record<string, unknown>;
  },
  timeout: number = 5000
): Promise<{
  success: boolean;
  tools?: Array<{ name: string; description?: string }>;
  error?: string;
}> {
  try {
    const connection = await createMcpConnection(server, timeout);
    if (!connection) {
      return { success: false, error: "连接失败" };
    }

    const toolList = Object.entries(connection.tools).map(
      ([name, toolDef]) => ({
        name: name.replace(`mcp__${server.name}__`, ""),
        description: (toolDef as { description?: string }).description?.replace(
          `[MCP: ${server.name}] `,
          ""
        ),
      })
    );

    await connection.client.close();
    return { success: true, tools: toolList };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "连接测试失败",
    };
  }
}
