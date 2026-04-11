import { writeFile, readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import type { ServiceResult } from "@/types/data-table";
import type { BackupConfig } from "@/types/agent2";

const BACKUP_DIR = process.env.BACKUP_DIR || ".data/backups";

interface BackupMeta {
  filename: string;
  size: number;
  createdAt: string;
}

async function ensureBackupDir() {
  try {
    await readdir(BACKUP_DIR);
  } catch {
    const { mkdir } = await import("fs/promises");
    await mkdir(BACKUP_DIR, { recursive: true });
  }
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
    const filepath = join(BACKUP_DIR, filename);

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
    const files = await readdir(BACKUP_DIR);
    const backups: BackupMeta[] = [];

    for (const file of files) {
      if (!file.startsWith("backup_") || !file.endsWith(".json")) continue;
      const filepath = join(BACKUP_DIR, file);
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
    // Sanitize filename - only allow backup_*.json files
    if (!filename.startsWith("backup_") || !filename.endsWith(".json")) {
      return { success: false, error: { code: "INVALID_FILE", message: "无效的备份文件名" } };
    }
    const filepath = join(BACKUP_DIR, filename);
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
    if (!filename.startsWith("backup_") || !filename.endsWith(".json")) {
      return { success: false, error: { code: "INVALID_FILE", message: "无效的备份文件名" } };
    }
    const { unlink } = await import("fs/promises");
    const filepath = join(BACKUP_DIR, filename);
    await unlink(filepath);
    return { success: true, data: { filename } };
  } catch {
    return { success: false, error: { code: "NOT_FOUND", message: "备份文件不存在" } };
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
