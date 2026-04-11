import { db } from "@/lib/db";
import type { Agent2GlobalSettingsData, BackupConfig } from "@/types/agent2";
import type { ServiceResult } from "@/types/data-table";

const SINGLETON_ID = "global";

function mapGlobalSettings(row: {
  id: string;
  suggestions: unknown;
  backupConfig: unknown;
  lastBackupAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Agent2GlobalSettingsData {
  const rawBackupConfig = row.backupConfig as Record<string, unknown> | null;
  return {
    id: row.id,
    suggestions: Array.isArray(row.suggestions) ? row.suggestions as string[] : [],
    backupConfig: {
      enabled: (rawBackupConfig?.enabled as boolean) ?? false,
      schedule: (rawBackupConfig?.schedule as BackupConfig["schedule"]) ?? "daily",
    },
    lastBackupAt: row.lastBackupAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getGlobalSettings(): Promise<ServiceResult<Agent2GlobalSettingsData>> {
  const settings = await db.agent2GlobalSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID, suggestions: [] },
  });

  return {
    success: true,
    data: mapGlobalSettings(settings),
  };
}

export async function updateGlobalSettings(data: {
  suggestions?: string[];
  backupConfig?: BackupConfig;
  lastBackupAt?: Date | null;
}): Promise<ServiceResult<Agent2GlobalSettingsData>> {
  await db.agent2GlobalSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID, suggestions: [] },
  });

  const updateData: Record<string, unknown> = {};
  if (data.suggestions !== undefined) updateData.suggestions = data.suggestions;
  if (data.backupConfig !== undefined) updateData.backupConfig = data.backupConfig;
  if (data.lastBackupAt !== undefined) updateData.lastBackupAt = data.lastBackupAt;

  const updated = await db.agent2GlobalSettings.update({
    where: { id: SINGLETON_ID },
    data: updateData,
  });

  return {
    success: true,
    data: mapGlobalSettings(updated),
  };
}
