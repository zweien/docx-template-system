import { db } from "@/lib/db";
import { encrypt, decrypt } from "./agent2-model.service";
import type { Agent2McpServerItem, McpServerConfig } from "@/types/agent2";
import type { ServiceResult } from "@/types/data-table";
import type { Prisma } from "@/generated/prisma/client";

// ── Helpers ──

type McpServerRow = {
  id: string;
  name: string;
  description: string | null;
  transportType: "stdio" | "sse" | "http";
  config: unknown;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 加密 config 中的敏感字段（headers 的值、env 的值）
 */
function encryptConfig(
  transportType: "stdio" | "sse" | "http",
  rawConfig: Record<string, unknown>
): Record<string, unknown> {
  const config = { ...rawConfig };

  if (config.headers && typeof config.headers === "object") {
    const encryptedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      config.headers as Record<string, string>
    )) {
      encryptedHeaders[key] = encrypt(value);
    }
    config.headers = encryptedHeaders;
  }

  if (transportType === "stdio" && config.env && typeof config.env === "object") {
    const encryptedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      config.env as Record<string, string>
    )) {
      encryptedEnv[key] = encrypt(value);
    }
    config.env = encryptedEnv;
  }

  return config;
}

/**
 * 解密 config 中的敏感字段
 */
function decryptConfig(
  transportType: "stdio" | "sse" | "http",
  rawConfig: Record<string, unknown>
): Record<string, unknown> {
  const config = { ...rawConfig };

  if (config.headers && typeof config.headers === "object") {
    const decryptedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      config.headers as Record<string, string>
    )) {
      try {
        decryptedHeaders[key] = decrypt(value);
      } catch {
        decryptedHeaders[key] = value;
      }
    }
    config.headers = decryptedHeaders;
  }

  if (transportType === "stdio" && config.env && typeof config.env === "object") {
    const decryptedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      config.env as Record<string, string>
    )) {
      try {
        decryptedEnv[key] = decrypt(value);
      } catch {
        decryptedEnv[key] = value;
      }
    }
    config.env = decryptedEnv;
  }

  return config;
}

/**
 * 将 config 中敏感字段掩码显示
 */
function maskConfig(
  transportType: "stdio" | "sse" | "http",
  rawConfig: Record<string, unknown>
): Record<string, unknown> {
  const config = { ...rawConfig };

  if (config.headers && typeof config.headers === "object") {
    const maskedHeaders: Record<string, string> = {};
    for (const key of Object.keys(config.headers as Record<string, string>)) {
      maskedHeaders[key] = "••••••••";
    }
    config.headers = maskedHeaders;
  }

  if (transportType === "stdio" && config.env && typeof config.env === "object") {
    const maskedEnv: Record<string, string> = {};
    for (const key of Object.keys(config.env as Record<string, string>)) {
      maskedEnv[key] = "••••••••";
    }
    config.env = maskedEnv;
  }

  return config;
}

function mapMcpServerItem(row: McpServerRow): Agent2McpServerItem {
  const rawConfig = row.config as Record<string, unknown>;
  rawConfig.type = row.transportType;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    transportType: row.transportType,
    config: maskConfig(row.transportType, rawConfig) as unknown as McpServerConfig,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── CRUD ──

export async function listMcpServers(): Promise<
  ServiceResult<Agent2McpServerItem[]>
> {
  const servers = await db.agent2McpServer.findMany({
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    data: servers.map((s) => mapMcpServerItem(s as unknown as McpServerRow)),
  };
}

export async function createMcpServer(data: {
  name: string;
  description?: string;
  transportType: "stdio" | "sse" | "http";
  config: Record<string, unknown>;
}): Promise<ServiceResult<Agent2McpServerItem>> {
  const existing = await db.agent2McpServer.findUnique({
    where: { name: data.name },
  });
  if (existing) {
    return {
      success: false,
      error: { code: "DUPLICATE_NAME", message: `MCP 服务器名称 "${data.name}" 已存在` },
    };
  }

  const encryptedConfig = encryptConfig(data.transportType, data.config);

  const server = await db.agent2McpServer.create({
    data: {
      name: data.name,
      description: data.description || null,
      transportType: data.transportType,
      config: encryptedConfig as unknown as Prisma.InputJsonValue,
      enabled: true,
    },
  });

  return {
    success: true,
    data: mapMcpServerItem(server as unknown as McpServerRow),
  };
}

export async function updateMcpServer(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }
): Promise<ServiceResult<Agent2McpServerItem>> {
  const existing = await db.agent2McpServer.findUnique({ where: { id } });
  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "MCP 服务器不存在" },
    };
  }

  if (data.name && data.name !== existing.name) {
    const duplicate = await db.agent2McpServer.findUnique({
      where: { name: data.name },
    });
    if (duplicate) {
      return {
        success: false,
        error: { code: "DUPLICATE_NAME", message: `MCP 服务器名称 "${data.name}" 已存在` },
      };
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.config !== undefined) {
    const transportType = existing.transportType as "stdio" | "sse" | "http";
    updateData.config = encryptConfig(transportType, data.config);
  }

  const updated = await db.agent2McpServer.update({
    where: { id },
    data: updateData,
  });

  return {
    success: true,
    data: mapMcpServerItem(updated as unknown as McpServerRow),
  };
}

export async function deleteMcpServer(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.agent2McpServer.findUnique({ where: { id } });
  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "MCP 服务器不存在" },
    };
  }

  await db.agent2McpServer.delete({ where: { id } });

  return {
    success: true,
    data: { id },
  };
}

/**
 * 获取已解密的配置（用于创建 MCP 客户端连接）
 */
export async function getDecryptedMcpServer(
  id: string
): Promise<
  ServiceResult<{
    id: string;
    name: string;
    transportType: "stdio" | "sse" | "http";
    config: Record<string, unknown>;
  }>
> {
  const server = await db.agent2McpServer.findUnique({ where: { id } });
  if (!server) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "MCP 服务器不存在" },
    };
  }

  const rawConfig = server.config as Record<string, unknown>;
  rawConfig.type = server.transportType;
  const decryptedConfig = decryptConfig(
    server.transportType as "stdio" | "sse" | "http",
    rawConfig
  );

  return {
    success: true,
    data: {
      id: server.id,
      name: server.name,
      transportType: server.transportType as "stdio" | "sse" | "http",
      config: decryptedConfig,
    },
  };
}

/**
 * 获取所有已启用的 MCP 服务器（解密配置）
 */
export async function getEnabledMcpServers(): Promise<
  ServiceResult<
    Array<{
      id: string;
      name: string;
      transportType: "stdio" | "sse" | "http";
      config: Record<string, unknown>;
    }>
  >
> {
  const servers = await db.agent2McpServer.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "desc" },
  });

  const result = servers.map((server) => {
    const rawConfig = server.config as Record<string, unknown>;
    rawConfig.type = server.transportType;
    const decryptedConfig = decryptConfig(
      server.transportType as "stdio" | "sse" | "http",
      rawConfig
    );
    return {
      id: server.id,
      name: server.name,
      transportType: server.transportType as "stdio" | "sse" | "http",
      config: decryptedConfig,
    };
  });

  return { success: true, data: result };
}
