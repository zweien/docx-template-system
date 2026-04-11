import { db } from "@/lib/db";
import type { Agent2GlobalSettingsData } from "@/types/agent2";
import type { ServiceResult } from "@/types/data-table";

const SINGLETON_ID = "global";

function mapGlobalSettings(row: {
  id: string;
  suggestions: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Agent2GlobalSettingsData {
  return {
    id: row.id,
    suggestions: Array.isArray(row.suggestions) ? row.suggestions as string[] : [],
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
}): Promise<ServiceResult<Agent2GlobalSettingsData>> {
  await db.agent2GlobalSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID, suggestions: [] },
  });

  const updated = await db.agent2GlobalSettings.update({
    where: { id: SINGLETON_ID },
    data,
  });

  return {
    success: true,
    data: mapGlobalSettings(updated),
  };
}
