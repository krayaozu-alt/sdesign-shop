import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log(`  publications ${await p.post.count()} | bannieres ${await p.banner.count()} | sessions ${await p.courseSession.count()}`);
await p.$disconnect();
