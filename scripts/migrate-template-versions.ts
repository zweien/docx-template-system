/**
 * 数据迁移脚本：将现有模板迁移到版本管理模式
 *
 * 1. 为每个模板创建子目录 uploads/templates/{id}/
 * 2. 将现有文件复制到 {dir}/draft.docx
 * 3. READY 状态的模板额外复制到 {dir}/v1.docx，创建 TemplateVersion 记录，更新 status 为 PUBLISHED
 * 4. 回填现有 Record 和 BatchGeneration 的 templateVersionId
 * 5. 删除旧的 READY 枚举值
 */

// 在导入 db 之前加载环境变量
import { config } from "dotenv";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/db";
import { existsSync } from "fs";
import { mkdir, copyFile } from "fs/promises";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "public/uploads";
const TEMPLATES_DIR = join(process.cwd(), UPLOAD_DIR, "templates");

async function main() {
  console.log("=== 开始数据迁移：TemplateVersion ===\n");

  // 1. 获取所有现有模板（include placeholders）
  const templates = await db.template.findMany({
    include: {
      placeholders: { orderBy: { sortOrder: "asc" } },
      records: true,
      batchGenerations: true,
    },
  });

  console.log(`找到 ${templates.length} 个模板需要迁移\n`);

  for (const template of templates) {
    const { id, filePath, status, createdById, placeholders, records, batchGenerations } = template;
    const templateDir = join(TEMPLATES_DIR, id);

    console.log(`\n--- 处理模板: ${template.name} (${id}) ---`);
    console.log(`  状态: ${status}`);

    // 2. 创建子目录
    if (!existsSync(templateDir)) {
      await mkdir(templateDir, { recursive: true });
      console.log(`  创建目录: ${templateDir}`);
    }

    // 3. 将现有文件复制到 {dir}/draft.docx
    const draftPath = join(templateDir, "draft.docx");
    await copyFile(filePath, draftPath);
    console.log(`  复制文件 -> ${draftPath}`);

    // 4. READY 状态的模板：创建 v1
    if ((status as string) === "PUBLISHED" || (status as string) === "READY") {
      const v1Path = join(templateDir, "v1.docx");
      await copyFile(filePath, v1Path);
      console.log(`  复制文件 -> ${v1Path}`);

      // 构建 placeholder snapshot
      const placeholderSnapshot = placeholders.map((p) => ({
        key: p.key,
        label: p.label,
        inputType: p.inputType,
        required: p.required,
        defaultValue: p.defaultValue,
        sortOrder: p.sortOrder,
        sourceTableId: p.sourceTableId,
        sourceField: p.sourceField,
        enablePicker: p.enablePicker,
      }));

      // 创建 TemplateVersion 记录
      const version = await db.templateVersion.create({
        data: {
          version: 1,
          fileName: "v1.docx",
          filePath: v1Path,
          originalFileName: template.originalFileName,
          fileSize: template.fileSize,
          placeholderSnapshot: placeholderSnapshot as any,
          dataTableId: template.dataTableId,
          fieldMapping: template.fieldMapping as any,
          publishedById: createdById,
          templateId: id,
        },
      });

      console.log(`  创建 TemplateVersion: ${version.id} (v1)`);

      // 回填 Record 的 templateVersionId
      if (records.length > 0) {
        await db.record.updateMany({
          where: { templateId: id },
          data: { templateVersionId: version.id },
        });
        console.log(`  回填 ${records.length} 条 Record 的 templateVersionId`);
      }

      // 回填 BatchGeneration 的 templateVersionId
      if (batchGenerations.length > 0) {
        await db.batchGeneration.updateMany({
          where: { templateId: id },
          data: { templateVersionId: version.id },
        });
        console.log(`  回填 ${batchGenerations.length} 条 BatchGeneration 的 templateVersionId`);
      }

      // 更新模板状态为 PUBLISHED，并设置 currentVersionId
      await db.template.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          currentVersionId: version.id,
        },
      });
      console.log(`  状态更新: READY -> PUBLISHED`);
      console.log(`  currentVersionId: ${version.id}`);
    } else {
      console.log(`  非 READY 状态，跳过版本创建`);
    }
  }

  // 5. 删除旧的 READY 枚举值
  console.log("\n=== 删除旧的 READY 枚举值 ===");
  try {
    // 先检查是否有模板还在用 READY
    const readyTemplates = await db.template.count({ where: { status: "READY" as any } });
    if (readyTemplates > 0) {
      console.error(`  错误：仍有 ${readyTemplates} 个模板使用 READY 状态，无法删除枚举值`);
    } else {
      await db.$executeRawUnsafe(`
        ALTER TYPE "TemplateStatus" RENAME TO "TemplateStatus_old";
        CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
        ALTER TABLE "Template" ALTER COLUMN "status" TYPE "TemplateStatus" USING "status"::text::"TemplateStatus";
        DROP TYPE "TemplateStatus_old";
      `);
      console.log("  已删除 READY 枚举值");
    }
  } catch (err) {
    console.error("  删除 READY 枚举值失败:", err);
    console.error("  请手动执行 SQL 删除 READY 枚举值");
  }

  console.log("\n=== 数据迁移完成 ===");
}

main()
  .catch((err) => {
    console.error("迁移失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
