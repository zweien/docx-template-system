// src/lib/agent2/model-resolver.ts
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/services/agent2-model.service";
import type { LanguageModel } from "ai";

interface DefaultModelConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
  headers?: Record<string, string>;
}

const DEFAULT_MODELS: Record<string, DefaultModelConfig> = {
  "gpt-4o": {
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL,
    model: "gpt-4o",
  },
  "gpt-4o-mini": {
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL,
    model: "gpt-4o-mini",
  },
  // Include the env-configured model so it resolves without DB lookup
  ...(process.env.AI_MODEL
    ? { [process.env.AI_MODEL]: {
        apiKey: process.env.AI_API_KEY,
        baseURL: process.env.AI_BASE_URL,
        model: process.env.AI_MODEL,
      } }
    : {}),
};

export interface ResolvedModel {
  model: LanguageModel;
  providerName: string;
  extraParams?: Record<string, unknown>;
}

// 检测模型是否输出 reasoning_content（需要特殊处理）
export function isReasoningModel(modelId: string, baseUrl: string): boolean {
  const lowerModelId = modelId.toLowerCase();
  const lowerBaseUrl = baseUrl.toLowerCase();

  return (
    lowerModelId.includes("kimi") ||
    lowerModelId.includes("k2") ||
    lowerModelId.includes("thinking") ||
    lowerBaseUrl.includes("moonshot") ||
    lowerBaseUrl.includes("kimi")
  );
}

export async function resolveModel(
  modelId: string,
  userId: string
): Promise<ResolvedModel> {
  // Check if modelId matches a known shorthand
  const defaultConfig = DEFAULT_MODELS[modelId];
  if (defaultConfig) {
    const openai = createOpenAI({
      apiKey: defaultConfig.apiKey,
      baseURL: defaultConfig.baseURL,
      headers: defaultConfig.headers,
    });
    return { model: openai.chat(defaultConfig.model), providerName: "openai" };
  }

  // Look up custom model config by ID
  const config = await db.agent2ModelConfig.findFirst({
    where: {
      id: modelId,
      OR: [{ userId }, { isGlobal: true }],
    },
  });

  if (!config) {
    // Fallback to env-configured model
    const openai = createOpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL,
    });
    return { model: openai.chat(process.env.AI_MODEL || "gpt-4o"), providerName: "openai" };
  }

  let apiKey = "";
  if (config.apiKeyEncrypted) {
    apiKey = decrypt(config.apiKeyEncrypted);
  } else {
    apiKey = process.env.AI_API_KEY || "";
  }

  const extraParams = (config.extraParams as Record<string, unknown>) ?? undefined;

  const providerName = config.providerId;
  const provider = createOpenAICompatible({
    name: providerName,
    apiKey,
    baseURL: config.baseUrl,
  });

  const model = provider.languageModel(config.modelId);

  return { model, providerName, extraParams };
}
