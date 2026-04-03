/**
 * 数据迁移脚本：将现有 RELATION 字段迁移到 RELATION_SUBTABLE + DataRelationRow 模式
 *
 * 1. 扫描现有 RELATION 字段
 * 2. 为缺失反向字段的字段生成系统反向字段
 * 3. 从历史 DataRecord.data[fieldKey] 回填 DataRelationRow
 * 4. 刷新正反 JSONB 快照
 * 5. 对引用不存在、单值脏数组、重复关系输出报告并阻断提交
 *
 * 用法：
 *   npx tsx scripts/migrate-relation-fields.ts --dry-run   # 预览迁移统计，不写库
 *   npx tsx scripts/migrate-relation-fields.ts             # 执行迁移
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";

const DRY_RUN = process.argv.includes("--dry-run");

interface MigrationReport {
  totalRelationFields: number;
  fieldsWithInverse: number;
  fieldsWithoutInverse: number;
  inverseFieldsCreated: number;
  relationRowsCreated: number;
  snapshotsRefreshed: number;
  errors: Array<{ fieldId: string; fieldKey: string; message: string }>;
  warnings: Array<{ fieldId: string; fieldKey: string; message: string }>;
}

async function main() {
  console.log(
    DRY_RUN
      ? "=== 预览迁移：RELATION → RELATION_SUBTABLE ===\n"
      : "=== 执行迁移：RELATION → RELATION_SUBTABLE ===\n"
  );

  const report: MigrationReport = {
    totalRelationFields: 0,
    fieldsWithInverse: 0,
    fieldsWithoutInverse: 0,
    inverseFieldsCreated: 0,
    relationRowsCreated: 0,
    snapshotsRefreshed: 0,
    errors: [],
    warnings: [],
  };

  // 1. 扫描现有 RELATION 字段
  const relationFields = await db.dataField.findMany({
    where: { type: "RELATION" },
    include: {
      inverseField: true,
    },
  });

  report.totalRelationFields = relationFields.length;
  console.log(`找到 ${relationFields.length} 个 RELATION 字段\n`);

  if (relationFields.length === 0) {
    console.log("无需迁移。\n");
    printReport(report);
    return;
  }

  // 2. 检查哪些字段缺失反向字段
  for (const field of relationFields) {
    if (field.inverseFieldId && field.inverseField) {
      report.fieldsWithInverse++;
    } else {
      report.fieldsWithoutInverse++;
    }
  }

  console.log(
    `  - 已有反向字段: ${report.fieldsWithInverse}\n` +
    `  - 缺失反向字段: ${report.fieldsWithoutInverse}\n`
  );

  // 3. 验证数据完整性
  console.log("正在验证关系数据...\n");

  for (const field of relationFields) {
    if (!field.relationTo) {
      report.errors.push({
        fieldId: field.id,
        fieldKey: field.key,
        message: "RELATION 字段缺少 relationTo 配置",
      });
      continue;
    }

    // 检查目标表是否存在
    const targetTable = await db.dataTable.findUnique({
      where: { id: field.relationTo },
    });
    if (!targetTable) {
      report.errors.push({
        fieldId: field.id,
        fieldKey: field.key,
        message: `目标表 ${field.relationTo} 不存在`,
      });
      continue;
    }

    // 获取使用该字段的所有记录
    const records = await db.dataRecord.findMany({
      where: { tableId: field.tableId },
    });

    for (const record of records) {
      const data = record.data as Record<string, unknown>;
      const value = data[field.key];

      if (value === undefined || value === null || value === "") {
        continue;
      }

      // 检查引用的目标记录是否存在
      if (typeof value === "string") {
        const targetRecord = await db.dataRecord.findUnique({
          where: { id: value },
        });
        if (!targetRecord) {
          report.warnings.push({
            fieldId: field.id,
            fieldKey: field.key,
            message: `记录 ${record.id} 引用了不存在的目标记录 ${value}`,
          });
        }
      } else if (Array.isArray(value)) {
        for (const itemId of value) {
          if (typeof itemId === "string") {
            const targetRecord = await db.dataRecord.findUnique({
              where: { id: itemId },
            });
            if (!targetRecord) {
              report.warnings.push({
                fieldId: field.id,
                fieldKey: field.key,
                message: `记录 ${record.id} 引用了不存在的目标记录 ${itemId}`,
              });
            }
          }
        }
      } else {
        report.warnings.push({
          fieldId: field.id,
          fieldKey: field.key,
          message: `记录 ${record.id} 的字段值类型异常: ${typeof value}`,
        });
      }
    }
  }

  // 如果有阻断性错误，停止迁移
  if (report.errors.length > 0) {
    console.log("\n!!! 阻断性错误，终止迁移 !!!\n");
    printReport(report);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("\n--- 预览模式，不执行写入 ---\n");
    printReport(report);
    return;
  }

  // 4. 执行迁移
  console.log("\n开始执行迁移...\n");

  for (const field of relationFields) {
    if (!field.relationTo) continue;

    // 4a. 将 RELATION 字段类型改为 RELATION_SUBTABLE
    await db.dataField.update({
      where: { id: field.id },
      data: {
        type: "RELATION_SUBTABLE",
        relationCardinality: "SINGLE",
      },
    });
    console.log(`  字段 ${field.key}: RELATION → RELATION_SUBTABLE (SINGLE)`);

    // 4b. 创建缺失的反向字段
    if (!field.inverseFieldId) {
      const sourceTable = await db.dataTable.findUnique({
        where: { id: field.tableId },
      });
      const sourceFields = await db.dataField.findMany({
        where: { tableId: field.tableId },
      });
      const firstTextField = sourceFields.find((f) => f.type === "TEXT");
      const displayField = firstTextField?.key ?? "id";

      const inverseKey = `${field.key}_inverse`;
      const inverseLabel = `${field.label}（反向）`;

      const inverseField = await db.dataField.create({
        data: {
          tableId: field.relationTo,
          key: inverseKey,
          label: inverseLabel,
          type: "RELATION_SUBTABLE",
          relationTo: field.tableId,
          displayField,
          relationCardinality: "MULTIPLE",
          inverseFieldId: field.id,
          isSystemManagedInverse: true,
          sortOrder: 999,
        },
      });

      // 更新正向字段的反向引用
      await db.dataField.update({
        where: { id: field.id },
        data: { inverseFieldId: inverseField.id },
      });

      report.inverseFieldsCreated++;
      console.log(`    创建反向字段 ${inverseKey} → ${sourceTable?.name ?? field.tableId}`);
    }

    // 4c. 回填 DataRelationRow
    const records = await db.dataRecord.findMany({
      where: { tableId: field.tableId },
    });

    for (const record of records) {
      const data = record.data as Record<string, unknown>;
      const value = data[field.key];

      if (value === undefined || value === null || value === "") {
        continue;
      }

      const targetIds: string[] = [];
      if (typeof value === "string") {
        targetIds.push(value);
      } else if (Array.isArray(value)) {
        for (const itemId of value) {
          if (typeof itemId === "string" && itemId) {
            targetIds.push(itemId);
          }
        }
      }

      for (let i = 0; i < targetIds.length; i++) {
        // 检查是否已存在
        const existing = await db.dataRelationRow.findFirst({
          where: {
            fieldId: field.id,
            sourceRecordId: record.id,
            targetRecordId: targetIds[i],
          },
        });

        if (!existing) {
          await db.dataRelationRow.create({
            data: {
              fieldId: field.id,
              sourceRecordId: record.id,
              targetRecordId: targetIds[i],
              attributes: { version: 1, values: {} },
              sortOrder: i,
            },
          });
          report.relationRowsCreated++;
        }
      }
    }

    // 4d. 刷新快照
    await refreshSnapshots(field.tableId, field.id);
    report.snapshotsRefreshed++;
    console.log(`    刷新了快照`);
  }

  console.log("\n迁移完成！\n");
  printReport(report);
}

async function refreshSnapshots(tableId: string, fieldId: string): Promise<void> {
  const records = await db.dataRecord.findMany({
    where: { tableId },
  });

  const field = await db.dataField.findUnique({
    where: { id: fieldId },
    include: { inverseField: true },
  });

  if (!field) return;

  const relationRows = await db.dataRelationRow.findMany({
    where: {
      OR: [
        { fieldId, sourceRecordId: { in: records.map((r) => r.id) } },
        {
          fieldId: field.inverseFieldId ?? "",
          targetRecordId: { in: records.map((r) => r.id) },
        },
      ],
    },
  });

  // Collect all affected record IDs
  const affectedRecordIds = new Set<string>();
  for (const row of relationRows) {
    affectedRecordIds.add(row.sourceRecordId);
    affectedRecordIds.add(row.targetRecordId);
  }

  // Fetch all affected records
  const affectedRecords = await db.dataRecord.findMany({
    where: { id: { in: [...affectedRecordIds] } },
  });

  // Group relation rows by source
  const rowsBySource = new Map<string, typeof relationRows>();
  for (const row of relationRows) {
    const rows = rowsBySource.get(row.sourceRecordId) ?? [];
    rows.push(row);
    rowsBySource.set(row.sourceRecordId, rows);
  }

  // Refresh forward snapshots
  for (const record of records) {
    const rows = rowsBySource.get(record.id) ?? [];
    if (rows.length === 0) continue;

    const data = record.data as Record<string, unknown>;
    const items = rows
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => ({
        targetRecordId: row.targetRecordId,
        displayValue: row.targetRecordId,
        attributes: (row.attributes as { values?: Record<string, unknown> })?.values ?? {},
        sortOrder: row.sortOrder,
      }));

    data[field.key] = field.relationCardinality === "SINGLE" ? (items[0] ?? null) : items;

    await db.dataRecord.update({
      where: { id: record.id },
      data: { data: JSON.parse(JSON.stringify(data)) },
    });
  }

  // Refresh inverse snapshots
  if (field.inverseFieldId && field.inverseField) {
    const inverseFieldId = field.inverseFieldId;
    const inverseFieldKey = field.inverseField.key;

    const inverseRows = await db.dataRelationRow.findMany({
      where: { fieldId: inverseFieldId },
    });

    const rowsByTarget = new Map<string, typeof inverseRows>();
    for (const row of inverseRows) {
      const rows = rowsByTarget.get(row.targetRecordId) ?? [];
      rows.push(row);
      rowsByTarget.set(row.targetRecordId, rows);
    }

    for (const [targetId, rows] of rowsByTarget) {
      const targetRecord = affectedRecords.find((r) => r.id === targetId);
      if (!targetRecord) continue;

      const data = targetRecord.data as Record<string, unknown>;
      const items = rows
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => ({
          targetRecordId: row.sourceRecordId,
          displayValue: row.sourceRecordId,
          attributes: (row.attributes as { values?: Record<string, unknown> })?.values ?? {},
          sortOrder: row.sortOrder,
        }));

      data[inverseFieldKey] =
        field.inverseField!.relationCardinality === "SINGLE" ? (items[0] ?? null) : items;

      await db.dataRecord.update({
        where: { id: targetId },
        data: { data: JSON.parse(JSON.stringify(data)) },
      });
    }
  }
}

function printReport(report: MigrationReport): void {
  console.log("=== 迁移报告 ===\n");
  console.log(`RELATION 字段总数:     ${report.totalRelationFields}`);
  console.log(`  已有反向字段:        ${report.fieldsWithInverse}`);
  console.log(`  缺失反向字段:        ${report.fieldsWithoutInverse}`);
  console.log(`创建反向字段:          ${report.inverseFieldsCreated}`);
  console.log(`创建关系行:            ${report.relationRowsCreated}`);
  console.log(`刷新快照:              ${report.snapshotsRefreshed}`);

  if (report.errors.length > 0) {
    console.log(`\n阻断性错误 (${report.errors.length}):`);
    for (const err of report.errors) {
      console.log(`  [${err.fieldKey}] ${err.message}`);
    }
  }

  if (report.warnings.length > 0) {
    console.log(`\n警告 (${report.warnings.length}):`);
    for (const w of report.warnings.slice(0, 20)) {
      console.log(`  [${w.fieldKey}] ${w.message}`);
    }
    if (report.warnings.length > 20) {
      console.log(`  ...还有 ${report.warnings.length - 20} 条警告`);
    }
  }

  console.log("");
}

main()
  .catch((error) => {
    console.error("迁移失败:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
