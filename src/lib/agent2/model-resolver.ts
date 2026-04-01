// src/lib/agent2/model-resolver.ts
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/services/agent2-model.service";
import type { LanguageModel } from "ai";

interface DefaultModelConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
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
};

export async function resolveModel(
  modelId: string,
  userId: string
): Promise<LanguageModel> {
  // Check if modelId matches a known shorthand
  const defaultConfig = DEFAULT_MODELS[modelId];
  if (defaultConfig) {
    const openai = createOpenAI({
      apiKey: defaultConfig.apiKey,
      baseURL: defaultConfig.baseURL,
    });
    return openai(defaultConfig.model);
  }

  // Look up custom model config by ID
  const config = await db.agent2ModelConfig.findFirst({
    where: {
      id: modelId,
      OR: [{ userId }, { isGlobal: true }],
    },
  });

  if (!config) {
    // Fallback to default gpt-4o
    const openai = createOpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL,
    });
    return openai("gpt-4o");
  }

  let apiKey = "";
  if (config.apiKeyEncrypted) {
    apiKey = decrypt(config.apiKeyEncrypted);
  } else {
    apiKey = process.env.AI_API_KEY || "";
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: config.baseUrl,
  });
  return openai(config.modelId);
}
