import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });

import { PrismaClient } from "../src/generated/prisma/client.js";
import { Role } from "../src/generated/prisma/enums.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const adminPassword = await hash("admin123", 10);
  const userPassword = await hash("user123", 10);
  const editorPassword = await hash("editor123", 10);
  const viewerPassword = await hash("viewer123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@example.com",
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      name: "User",
      email: "user@example.com",
      password: userPassword,
      role: Role.USER,
    },
  });

  const editor = await prisma.user.upsert({
    where: { email: "editor@example.com" },
    update: {},
    create: {
      name: "Editor",
      email: "editor@example.com",
      password: editorPassword,
      role: Role.USER,
    },
  });

  const viewer = await prisma.user.upsert({
    where: { email: "viewer@example.com" },
    update: {},
    create: {
      name: "Viewer",
      email: "viewer@example.com",
      password: viewerPassword,
      role: Role.USER,
    },
  });

  console.log({ admin, user, editor, viewer });

  // Seed Editor AI Actions
  const existingActions = await prisma.editorAIAction.count({
    where: { isBuiltIn: true },
  });
  if (existingActions === 0) {
    const builtInActions = [
      { name: "润色", icon: "✨", prompt: "请润色以下文本，改善表达流畅度和文字质量，但保持原意不变：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 1 },
      { name: "缩写", icon: "📝", prompt: "请将以下文本精简缩写，保留核心要点，去除冗余表述：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 2 },
      { name: "扩写", icon: "📖", prompt: "请扩写以下文本，增加细节、论证和具体描述，使内容更加丰富：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 3 },
      { name: "翻译为英文", icon: "🌐", prompt: "请将以下文本翻译为英文：\n\n{{selection}}", category: "translation", scope: "selection", sortOrder: 4 },
      { name: "翻译为中文", icon: "🌐", prompt: "Please translate the following text to Chinese:\n\n{{selection}}", category: "translation", scope: "selection", sortOrder: 5 },
      { name: "纠错", icon: "🎯", prompt: "请检查以下文本中的语法、拼写、标点错误并修正，列出修改内容：\n\n{{selection}}", category: "writing", scope: "selection", sortOrder: 6 },
      { name: "正式语气", icon: "💼", prompt: "请将以下文本改写为正式、专业的语气，使用更规范的措辞：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 7 },
      { name: "轻松语气", icon: "😊", prompt: "请将以下文本改写为轻松自然的语气，使其更加亲切易读：\n\n{{selection}}\n\n上下文：\n{{context}}", category: "writing", scope: "selection", sortOrder: 8 },
    ];

    for (const action of builtInActions) {
      await prisma.editorAIAction.create({
        data: { ...action, isBuiltIn: true, enabled: true, userId: null },
      });
    }
    console.log(`Seeded ${builtInActions.length} built-in editor AI actions`);
  }

  console.log("Seeding completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
