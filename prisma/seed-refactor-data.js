const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding UI/UX Refactor Mock Data...');

  // 1. Get existing customers, services, and sources
  const customers = await prisma.customer.findMany({ where: { isDeleted: false }, take: 10 });
  const services = await prisma.service.findMany({ where: { isDeleted: false }, take: 5 });
  const sources = await prisma.supplierSource.findMany({ where: { isDeleted: false }, take: 5 });

  if (customers.length === 0 || services.length === 0) {
    console.error('Error: Please run seed first to have customers and services.');
    return;
  }

  // Cleanup existing refactor seed orders to make the script idempotent
  console.log('Cleaning up existing ERR- and DEBT- mock orders...');
  await prisma.order.deleteMany({
    where: {
      OR: [
        { orderCode: { startsWith: 'ERR-' } },
        { orderCode: { startsWith: 'DEBT-' } }
      ]
    }
  });

  const now = new Date();

  // 2. Generate 25 Warranty / Reported Orders with various states
  const warrantyStates = [
    { status: 'REPORTED', refundStatus: 'PENDING' },
    { status: 'WAIT_SOURCE', refundStatus: 'PENDING' },
    { status: 'WAIT_CUSTOMER_REFUND', refundStatus: 'REFUNDED' }, // agreed by source
    { status: 'SOURCE_REJECTED', refundStatus: 'REJECTED' },
    { status: 'COMPLETED', refundStatus: 'REFUNDED' }
  ];

  console.log('Creating 25 mock warranty orders...');
  for (let i = 0; i < 25; i++) {
    const customer = customers[i % customers.length];
    const service = services[i % services.length];
    const source = sources[i % sources.length];
    const state = warrantyStates[i % warrantyStates.length];
    
    const daysAgo = i * 2 + 1; // staggered dates
    const startDate = new Date(now.getTime() - (daysAgo + 30) * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const errorDate = new Date(startDate.getTime() + 15 * 24 * 60 * 60 * 1000); // broke after 15 days
    const sourceReplyDate = new Date(errorDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    const refundDate = new Date(errorDate.getTime() + 2 * 24 * 60 * 60 * 1000);

    const orderCode = `ERR-${100000 + i}`;
    const salePrice = 120000 + (i * 10000);
    const costPrice = 60000 + (i * 5000);
    const profit = salePrice - costPrice;

    const durationDays = i % 2 === 0 ? 30 : 90;
    const daysUsed = 15;
    const daysRemaining = durationDays - daysUsed;
    const costPerDay = costPrice / durationDays;

    const order = await prisma.order.create({
      data: {
        orderCode,
        customerId: customer.id,
        serviceId: service.id,
        packageName: `Gói Premium ${i % 2 === 0 ? '30' : '90'} ngày`,
        durationDays,
        accountEmail: `warranty${i}@account.com`,
        accountPassword: `pass${123 + i}`,
        supplierSourceId: source?.id || null,
        supplierSourceName: source?.name || 'N/A',
        salePrice,
        costPrice,
        profit,
        paymentStatus: 'PAID',
        paidAmount: salePrice,
        paidAt: startDate,
        startDate,
        endDate,
        status: state.status,
      }
    });

    // Create refund history to simulate warranty logs
    await prisma.refundHistory.create({
      data: {
        orderId: order.id,
        errorDate,
        amount: Math.round(salePrice * 0.5), // refund half
        sourceStatus: state.refundStatus,
        sourceRefundExpected: Math.round(costPrice * 0.5),
        sourceRefundActual: state.status === 'COMPLETED' ? Math.round(costPrice * 0.5) : 0,
        daysUsed,
        daysRemaining,
        costPerDay,
        note: `Báo lỗi bảo hành tự động bởi seed script: tài khoản bị locked out. [Mã: ${orderCode}]`,
        createdAt: refundDate,
      }
    });
  }

  // 3. Generate 25 Debt / Unpaid Orders with various aging
  console.log('Creating 25 mock debt orders...');
  const debtStates = ['UNPAID', 'OVERDUE'];

  for (let i = 0; i < 25; i++) {
    const customer = customers[i % customers.length];
    const service = services[i % services.length];
    const source = sources[i % sources.length];
    const paymentStatus = debtStates[i % debtStates.length];
    
    // Aging: 1 day, 3 days, 7 days, 14 days, 30 days, 45 days
    const daysInDebt = [1, 3, 7, 14, 30, 45][i % 6];
    const startDate = new Date(now.getTime() - daysInDebt * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const paymentDueDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days term

    const orderCode = `DEBT-${200000 + i}`;
    const salePrice = 150000 + (i * 12000);
    const costPrice = 80000 + (i * 6000);
    const profit = salePrice - costPrice;

    await prisma.order.create({
      data: {
        orderCode,
        customerId: customer.id,
        serviceId: service.id,
        packageName: `Gói Premium Nợ ${daysInDebt} ngày`,
        durationDays: 30,
        accountEmail: `debt${i}@account.com`,
        accountPassword: `pass${456 + i}`,
        supplierSourceId: source?.id || null,
        supplierSourceName: source?.name || 'N/A',
        salePrice,
        costPrice,
        profit,
        paymentStatus,
        paidAmount: i % 3 === 0 ? Math.round(salePrice * 0.2) : 0, // some partial paid
        startDate,
        endDate,
        paymentDueDate,
        status: 'ACTIVE',
      }
    });
  }

  console.log('Seed completed successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
