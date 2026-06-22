const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');

try {
  const dbPath = path.join(__dirname, 'prisma', 'dev.db');
  const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`,
  });
  const prisma = new PrismaClient({ adapter });
  console.log('Prisma Client successfully initialized');
  console.log('Models:');
  const keys = Object.keys(prisma);
  for (const k of keys) {
    if (!k.startsWith('_') && !k.startsWith('$')) {
      console.log(' -', k);
    }
  }
} catch (e) {
  console.error('Initialization failed:', e);
}

