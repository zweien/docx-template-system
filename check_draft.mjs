import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './src/generated/prisma/client';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const draft = await prisma.reportDraft.findUnique({
  where: { id: 'cmofueo7t0007a4bmdakm9u44' },
  include: { template: true },
});
if (!draft) { console.log('not found'); process.exit(1); }
console.log('Title:', draft.title);
console.log('Template:', draft.template.name, draft.template.filePath);
console.log('Sections keys:', Object.keys(draft.sections));
console.log('Section enabled:', JSON.stringify(draft.sectionEnabled));
console.log('Context:', JSON.stringify(draft.context));
for (const [k, v] of Object.entries(draft.sections)) {
  console.log('Section', k, 'block count:', (v || []).length);
  if ((v || []).length > 0) {
    console.log('  First block:', JSON.stringify(v[0], null, 2).substring(0, 500));
  }
}
await prisma.$disconnect();
await pool.end();
