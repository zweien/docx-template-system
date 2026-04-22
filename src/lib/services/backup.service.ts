import { writeFile, readdir, readFile, stat } from "fs/promises";
import { isAbsolute, join, normalize } from "path";
import { db } from "@/lib/db";
import type { ServiceResult } from "@/types/data-table";
import type { BackupConfig } from "@/types/agent2";
import type { Prisma } from "@/generated/prisma/client";

const DEFAULT_BACKUP_DIR = join(
  /* turbopackIgnore: true */ process.cwd(),
  ".data",
  "backups"
);

interface BackupMeta {
  filename: string;
  size: number;
  createdAt: string;
}

async function ensureBackupDir() {
  const backupDir = getBackupDir();

  try {
    await readdir(backupDir);
  } catch {
    const { mkdir } = await import("fs/promises");
    await mkdir(backupDir, { recursive: true });
  }
}

function getBackupDir() {
  const configuredDir = process.env.BACKUP_DIR?.trim();

  if (!configuredDir) {
    return DEFAULT_BACKUP_DIR;
  }

  const normalizedDir = normalize(configuredDir);
  if (isAbsolute(normalizedDir)) {
    return normalizedDir;
  }

  return join(
    /* turbopackIgnore: true */ process.cwd(),
    normalizedDir
  );
}

/**
 * 执行完整备份：导出所有数据表为 JSON 文件
 */
export async function runBackup(): Promise<ServiceResult<BackupMeta>> {
  try {
    await ensureBackupDir();

    const tables = await db.dataTable.findMany({
      include: { fields: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    });

    const backupData: {
      version: string;
      exportedAt: string;
      tables: Record<string, unknown>;
    } = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      tables: {},
    };

    for (const table of tables) {
      const records = await db.dataRecord.findMany({
        where: { tableId: table.id },
        orderBy: { createdAt: "desc" },
      });

      backupData.tables[table.name] = {
        id: table.id,
        description: table.description,
        fields: table.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options,
        })),
        records: records.map((r) => ({
          id: r.id,
          data: r.data,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    }

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `backup_${timestamp}.json`;
    const filepath = join(getBackupDir(), filename);

    await writeFile(filepath, JSON.stringify(backupData, null, 2), "utf-8");
    const fileStat = await stat(filepath);

    // Update lastBackupAt
    await db.agent2GlobalSettings.upsert({
      where: { id: "global" },
      update: { lastBackupAt: now },
      create: { id: "global", lastBackupAt: now },
    });

    return {
      success: true,
      data: {
        filename,
        size: fileStat.size,
        createdAt: now.toISOString(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "BACKUP_FAILED",
        message: error instanceof Error ? error.message : "备份失败",
      },
    };
  }
}

/**
 * 列出所有备份文件
 */
export async function listBackups(): Promise<ServiceResult<BackupMeta[]>> {
  try {
    await ensureBackupDir();
    const backupDir = getBackupDir();
    const files = await readdir(backupDir);
    const backups: BackupMeta[] = [];

    for (const file of files) {
      if (!file.startsWith("backup_") || !file.endsWith(".json")) continue;
      const filepath = join(backupDir, file);
      const fileStat = await stat(filepath);
      backups.push({
        filename: file,
        size: fileStat.size,
        createdAt: fileStat.mtime.toISOString(),
      });
    }

    backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { success: true, data: backups };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "LIST_FAILED",
        message: error instanceof Error ? error.message : "获取备份列表失败",
      },
    };
  }
}

/**
 * 读取备份文件内容
 */
export async function readBackup(
  filename: string
): Promise<ServiceResult<{ data: Buffer; size: number }>> {
  try {
    // Sanitize filename - only allow backup_*.json without path separators
    if (!filename.startsWith("backup_") || !filename.endsWith(".json") || filename.includes("/") || filename.includes("..")) {
      return { success: false, error: { code: "INVALID_FILE", message: "无效的备份文件名" } };
    }
    const filepath = join(getBackupDir(), filename);
    const data = await readFile(filepath);
    const fileStat = await stat(filepath);
    return { success: true, data: { data, size: fileStat.size } };
  } catch {
    return { success: false, error: { code: "NOT_FOUND", message: "备份文件不存在" } };
  }
}

/**
 * 删除备份文件
 */
export async function deleteBackup(
  filename: string
): Promise<ServiceResult<{ filename: string }>> {
  try {
    if (!filename.startsWith("backup_") || !filename.endsWith(".json") || filename.includes("/") || filename.includes("..")) {
      return { success: false, error: { code: "INVALID_FILE", message: "无效的备份文件名" } };
    }
    const { unlink } = await import("fs/promises");
    const filepath = join(getBackupDir(), filename);
    await unlink(filepath);
    return { success: true, data: { filename } };
  } catch {
    return { success: false, error: { code: "NOT_FOUND", message: "备份文件不存在" } };
  }
}

/**
 * 从备份文件恢复数据
 * 按表名匹配现有表，删除现有记录后重新插入备份记录
 */
export async function restoreBackup(
  filename: string
): Promise<
  ServiceResult<{
    tablesProcessed: number;
    recordsRestored: number;
    skippedTables: string[];
  }>
> {
  try {
    if (!filename.startsWith("backup_") || !filename.endsWith(".json") || filename.includes("/") || filename.includes("..")) {
      return { success: false, error: { code: "INVALID_FILE", message: "无效的备份文件名" } };
    }

    const filepath = join(getBackupDir(), filename);
    const content = await readFile(filepath, "utf-8");
    const backup = JSON.parse(content) as {
      version: string;
      exportedAt: string;
      tables: Record<
        string,
        {
          id: string;
          records: Array<{ id: string; data: unknown; createdAt: string; updatedAt: string }>;
        }
      >;
    };

    if (!backup.tables || typeof backup.tables !== "object") {
      return { success: false, error: { code: "INVALID_FORMAT", message: "备份文件格式无效" } };
    }

    const result = {
      tablesProcessed: 0,
      recordsRestored: 0,
      skippedTables: [] as string[],
    };

    await db.$transaction(async (tx) => {
      for (const [tableName, tableData] of Object.entries(backup.tables)) {
        // Find existing table by name
        const table = await tx.dataTable.findUnique({ where: { name: tableName } });
        if (!table) {
          result.skippedTables.push(tableName);
          continue;
        }

        // Delete existing records
        await tx.dataRecord.deleteMany({ where: { tableId: table.id } });

        // Insert backup records
        for (const record of tableData.records) {
          await tx.dataRecord.create({
            data: {
              id: record.id,
              tableId: table.id,
              data: record.data as Prisma.InputJsonValue,
              createdById: table.createdById,
              createdAt: new Date(record.createdAt),
              updatedAt: new Date(record.updatedAt),
            },
          });
        }

        result.tablesProcessed++;
        result.recordsRestored += tableData.records.length;
      }
    });

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "RESTORE_FAILED",
        message: error instanceof Error ? error.message : "恢复失败",
      },
    };
  }
}

/**
 * 获取 cron 表达式
 */
export function getCronExpression(schedule: BackupConfig["schedule"]): string {
  switch (schedule) {
    case "daily":
      return "0 3 * * *"; // 每天 3:00
    case "weekly":
      return "0 3 * * 0"; // 每周日 3:00
    case "monthly":
      return "0 3 1 * *"; // 每月 1 日 3:00
  }
}
