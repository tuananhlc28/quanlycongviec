const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

prisma.order.findMany({
  where: {
    status: { in: ['ACTIVE', 'EXPIRING_SOON'] }
  },
  select: {
    orderCode: true,
    status: true,
    endDate: true
  }
}).then(orders => {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  console.log('Total ACTIVE/EXPIRING_SOON orders in DB:', orders.length);
  const filtered = orders.filter(o => {
    const end = new Date(o.endDate);
    return end >= now && end <= sevenDaysLater;
  });
  console.log('Orders expiring in next 7 days:', filtered.length, filtered);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
