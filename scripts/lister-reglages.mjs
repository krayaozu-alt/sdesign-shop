import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const r = await prisma.setting.findMany({ orderBy: { key: 'asc' }, select: { key: true, value: true } });
for (const s of r) console.log(s.key.padEnd(24), s.value.length > 60 ? s.value.slice(0, 57) + '…' : s.value);
await prisma.$disconnect();
