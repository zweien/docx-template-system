import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "@/lib/db";
import type { Agent2ModelItem } from "@/types/agent2";
import type { ServiceResult } from "@/types/data-table";

// ── AES-256-GCM encryption ──

const ENCRYPTION_KEY = process.env.MODEL_CONFIG_ENCRYPTION_KEY || "";
const ALGORITHM = "aes-256-gcm";

// Validate encryption key at module load time
if (!ENCRYPTION_KEY || !/^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY)) {
  console.warn(
    "[agent2-model] MODEL_CONFIG_ENCRYPTION_KEY is not set or invalid (expected 64 hex chars / 32 bytes). " +
    "API key encryption will fail. Set it in .env.local"
  );
}

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error("MODEL_CONFIG_ENCRYPTION_KEY 未配置或无效（需要 64 位十六进制字符）");
  }
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error("MODEL_CONFIG_ENCRYPTION_KEY 未配置或无效（需要 64 位十六进制字符）");
  }
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ── Helpers ──

function mapModelItem(row: {
  id: string;
  name: string;
  providerId: string;
  modelId: string;
  baseUrl: string;
  isGlobal: boolean;
  userId: string | null;
  createdAt: Date;
}): Agent2ModelItem {
  return {
    id: row.id,
    name: row.name,
    providerId: row.providerId,
    modelId: row.modelId,
    baseUrl: row.baseUrl,
    isGlobal: row.isGlobal,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Env-configured default models ──

export function getEnvDefaultModels(): Agent2ModelItem[] {
  const models: Agent2ModelItem[] = [];
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;

  if (apiKey && baseUrl && model) {
    models.push({
      id: model,
      name: `${model}（系统默认）`,
      providerId: "env",
      modelId: model,
      baseUrl,
      isGlobal: true,
      userId: null,
      createdAt: new Date(0).toISOString(),
    });
  }

  return models;
}

// ── User model functions ──

export async function listUserModels(
  userId: string
): Promise<ServiceResult<Agent2ModelItem[]>> {
  const models = await db.agent2ModelConfig.findMany({
    where: { userId, isGlobal: false },
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    data: models.map(mapModelItem),
  };
}

export async function listAllModels(
  userId: string
): Promise<ServiceResult<Agent2ModelItem[]>> {
  const [globalModels, userModels] = await Promise.all([
    db.agent2ModelConfig.findMany({
      where: { isGlobal: true },
      orderBy: { createdAt: "desc" },
    }),
    db.agent2ModelConfig.findMany({
      where: { userId, isGlobal: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    success: true,
    data: [...getEnvDefaultModels(), ...globalModels.map(mapModelItem), ...userModels.map(mapModelItem)],
  };
}

export async function createModel(
  userId: string,
  data: {
    name: string;
    providerId: string;
    modelId: string;
    baseUrl: string;
    apiKey?: string;
  }
): Promise<ServiceResult<Agent2ModelItem>> {
  const model = await db.agent2ModelConfig.create({
    data: {
      name: data.name,
      providerId: data.providerId,
      modelId: data.modelId,
      baseUrl: data.baseUrl,
      apiKeyEncrypted: data.apiKey ? encrypt(data.apiKey) : null,
      isGlobal: false,
      userId,
    },
  });

  return {
    success: true,
    data: mapModelItem(model),
  };
}

export async function deleteModel(
  id: string,
  userId: string
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.agent2ModelConfig.findFirst({
    where: { id, userId, isGlobal: false },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "模型配置不存在" },
    };
  }

  await db.agent2ModelConfig.delete({
    where: { id },
  });

  return {
    success: true,
    data: { id },
  };
}

export async function updateModel(
  id: string,
  userId: string,
  data: {
    name?: string;
    modelId?: string;
    baseUrl?: string;
    apiKey?: string;
  }
): Promise<ServiceResult<Agent2ModelItem>> {
  const existing = await db.agent2ModelConfig.findFirst({
    where: { id, userId, isGlobal: false },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "模型配置不存在" },
    };
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.modelId !== undefined) updateData.modelId = data.modelId;
  if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
  // 只有明确提供了 apiKey（即使是空字符串）才更新
  if (data.apiKey !== undefined) {
    updateData.apiKeyEncrypted = data.apiKey ? encrypt(data.apiKey) : null;
  }

  const updated = await db.agent2ModelConfig.update({
    where: { id },
    data: updateData,
  });

  return {
    success: true,
    data: mapModelItem(updated),
  };
}

export async function testModelConnection(data: {
  baseUrl: string;
  apiKey?: string;
  modelId: string;
}): Promise<ServiceResult<{ success: boolean; message: string }>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (data.apiKey) {
      headers["Authorization"] = `Bearer ${data.apiKey}`;
    }

    const response = await fetch(`${data.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: data.modelId,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: { code: "CONNECTION_FAILED", message: `连接失败: ${response.status} ${errorText}` },
      };
    }

    return {
      success: true,
      data: { success: true, message: "连接成功" },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "CONNECTION_FAILED",
        message: error instanceof Error ? error.message : "连接失败",
      },
    };
  }
}

export async function getDecryptedApiKey(
  id: string,
  userId: string
): Promise<ServiceResult<string>> {
  const model = await db.agent2ModelConfig.findFirst({
    where: { id, userId },
  });

  if (!model) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "模型配置不存在" },
    };
  }

  if (!model.apiKeyEncrypted) {
    return {
      success: false,
      error: { code: "NO_API_KEY", message: "该模型未配置 API Key" },
    };
  }

  return {
    success: true,
    data: decrypt(model.apiKeyEncrypted),
  };
}

// ── Admin global model functions ──

export async function listGlobalModels(): Promise<
  ServiceResult<Agent2ModelItem[]>
> {
  const models = await db.agent2ModelConfig.findMany({
    where: { isGlobal: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    data: models.map(mapModelItem),
  };
}

export async function createGlobalModel(
  data: {
    name: string;
    providerId: string;
    modelId: string;
    baseUrl: string;
    apiKey?: string;
  }
): Promise<ServiceResult<Agent2ModelItem>> {
  const model = await db.agent2ModelConfig.create({
    data: {
      name: data.name,
      providerId: data.providerId,
      modelId: data.modelId,
      baseUrl: data.baseUrl,
      apiKeyEncrypted: data.apiKey ? encrypt(data.apiKey) : null,
      isGlobal: true,
      userId: null,
    },
  });

  return {
    success: true,
    data: mapModelItem(model),
  };
}

export async function updateGlobalModel(
  id: string,
  data: {
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    modelId?: string;
  }
): Promise<ServiceResult<Agent2ModelItem>> {
  const existing = await db.agent2ModelConfig.findFirst({
    where: { id, isGlobal: true },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "全局模型配置不存在" },
    };
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
  if (data.modelId !== undefined) updateData.modelId = data.modelId;
  if (data.apiKey !== undefined) {
    updateData.apiKeyEncrypted = data.apiKey ? encrypt(data.apiKey) : null;
  }

  const updated = await db.agent2ModelConfig.update({
    where: { id },
    data: updateData,
  });

  return {
    success: true,
    data: mapModelItem(updated),
  };
}

export async function deleteGlobalModel(
  id: string
): Promise<ServiceResult<{ id: string }>> {
  const existing = await db.agent2ModelConfig.findFirst({
    where: { id, isGlobal: true },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "全局模型配置不存在" },
    };
  }

  await db.agent2ModelConfig.delete({
    where: { id },
  });

  return {
    success: true,
    data: { id },
  };
}
