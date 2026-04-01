import { db } from "@/lib/db";
import type { Agent2UserSettingsData } from "@/types/agent2";

type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

function mapSettings(row: {
  id: string;
  userId: string;
  autoConfirmTools: unknown;
  defaultModel: string;
  showReasoning: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Agent2UserSettingsData {
  return {
    id: row.id,
    userId: row.userId,
    autoConfirmTools: row.autoConfirmTools as Record<string, boolean>,
    defaultModel: row.defaultModel,
    showReasoning: row.showReasoning,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getSettings(
  userId: string
): Promise<ServiceResult<Agent2UserSettingsData>> {
  const settings = await db.agent2UserSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  return {
    success: true,
    data: mapSettings(settings),
  };
}

export async function updateSettings(
  userId: string,
  data: {
    autoConfirmTools?: Record<string, boolean>;
    defaultModel?: string;
    showReasoning?: boolean;
  }
): Promise<ServiceResult<Agent2UserSettingsData>> {
  // Ensure settings row exists first
  await db.agent2UserSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const updated = await db.agent2UserSettings.update({
    where: { userId },
    data,
  });

  return {
    success: true,
    data: mapSettings(updated),
  };
}
