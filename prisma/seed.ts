/**
 * seed.ts — Dữ liệu mẫu thực tế 100 đơn hàng
 *
 * Tất cả số được tính theo công thức chuẩn — không nhập số cứng:
 *   dailyRate     = salePrice / durationDays
 *   daysRemaining = endDate - today
 *   expectedClientRefund = dailyRate × daysRemaining
 *   expectedSourceRefund = (costPrice / durationDays) × daysRemaining
 *   profitBeforeRefund   = salePrice - costPrice
 *   profitAfterRefund    = salePrice - costPrice - clientRefund + sourceRefund
 */

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const DAY_MS = 24 * 60 * 60 * 1000;

// ==========================================
// Helper: tính công thức chuẩn
// ==========================================
function computeRefundFields(params: {
  salePrice: number;
  costPrice: number;
  durationDays: number;
  startDate: Date;
  endDate: Date;
  errorDate: Date;
}) {
  const { salePrice, costPrice, durationDays, startDate, errorDate } = params;

  const daysUsed = Math.max(0, Math.floor((errorDate.getTime() - startDate.getTime()) / DAY_MS));
  const daysRemaining = Math.max(0, durationDays - daysUsed);
  const dailyRate = salePrice / durationDays;
  const costDailyRate = costPrice / durationDays;

  const autoRefundAmount = Math.round(dailyRate * daysRemaining);
  const sourceRefundExpected = Math.round(costDailyRate * daysRemaining);

  return { daysUsed, daysRemaining, costPerDay: dailyRate, autoRefundAmount, sourceRefundExpected };
}

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu mới (100 đơn hàng thực tế)...');

  // ==========================================
  // Dọn dẹp toàn bộ dữ liệu cũ
  // ==========================================
  await prisma.financialChangeLog.deleteMany();
  await prisma.paymentRecord.deleteMany();
  await prisma.refundHistory.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.supplierSource.deleteMany();
  await prisma.service.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  console.log('✅ Đã dọn sạch dữ liệu cũ');

  // ==========================================
  // 1. Tài khoản người dùng
  // ==========================================
  const hashedAdmin = await bcrypt.hash('admin123', 12);
  const hashedStaff = await bcrypt.hash('staff123', 12);

  const admin = await prisma.user.create({
    data: { email: 'admin@mmo.vn', password: hashedAdmin, name: 'Quản trị viên', role: 'ADMIN', isActive: true },
  });
  await prisma.user.create({
    data: { email: 'staff@mmo.vn', password: hashedStaff, name: 'Nguyễn Văn Nhân Viên', role: 'STAFF', isActive: true },
  });
  console.log('✅ Tài khoản admin & staff');

  // ==========================================
  // 2. Khách hàng (10 người)
  // ==========================================
  const customersData = [
    { name: 'Nguyễn Văn A', phone: '0912345678', facebook: 'fb.com/nguyenvana', telegram: '@vana_mmo', note: 'Khách quen chuyên Canva', tag: 'VIP' },
    { name: 'Trần Thị B',   phone: '0987654321', facebook: 'fb.com/tranthib',   telegram: '@thib_pro',  note: 'Mua ChatGPT cho công ty', tag: 'REGULAR' },
    { name: 'Lê Văn C',     phone: '0905123456', facebook: 'fb.com/levanc',     telegram: '@vanc_dev',  note: 'Claude Pro code game', tag: 'REGULAR' },
    { name: 'Phạm Minh D',  phone: '0933334444', facebook: 'fb.com/phamminhd',  telegram: '@minhd_ads', note: 'CapCut làm video quảng cáo', tag: 'VIP' },
    { name: 'Đỗ Hoàng E',   phone: '0944445555', facebook: 'fb.com/dohoange',   telegram: undefined,    note: 'YouTube Premium gia đình', tag: 'NEW' },
    { name: 'Ngô Quốc F',   phone: '0955556666', facebook: undefined,           telegram: '@quocf_mmo', note: 'Hay mua sỉ nhiều', tag: 'VIP' },
    { name: 'Vũ Thị G',     phone: '0966667777', facebook: 'fb.com/vuthig',     telegram: '@thig_desg', note: 'Thiết kế đồ họa', tag: 'REGULAR' },
    { name: 'Bùi Văn H',    phone: '0977778888', facebook: undefined,           telegram: undefined,    note: 'Khách mới', tag: 'NEW' },
    { name: 'Cao Thị I',    phone: '0988889999', facebook: 'fb.com/caothi_i',   telegram: '@caoi_vip',  note: 'Hay nợ tiền', tag: 'REGULAR' },
    { name: 'Đinh Văn J',   phone: '0999990000', facebook: undefined,           telegram: '@dinhvanj',  note: 'Khách sỉ Grok & Twitter', tag: 'VIP' },
  ];

  const customers = [];
  for (const c of customersData) {
    const cust = await prisma.customer.create({ data: c as any });
    customers.push(cust);
  }
  console.log(`✅ ${customers.length} khách hàng`);

  // ==========================================
  // 3. Dịch vụ (6 loại)
  // ==========================================
  const servicesData = [
    { name: 'Canva Pro',       slug: 'canva-pro',       logo: '🎨', description: 'Canva Pro chính chủ',          defaultSalePrice: 299000, defaultCostPrice: 120000, defaultDurationDays: 365 },
    { name: 'CapCut Pro',      slug: 'capcut-pro',      logo: '🎬', description: 'CapCut Pro PC/Mobile',         defaultSalePrice: 99000,  defaultCostPrice: 40000,  defaultDurationDays: 30 },
    { name: 'Grok Premium',    slug: 'grok-premium',    logo: '⚡', description: 'Grok Premium xAI',             defaultSalePrice: 450000, defaultCostPrice: 300000, defaultDurationDays: 30 },
    { name: 'ChatGPT Plus',    slug: 'chatgpt-plus',    logo: '🤖', description: 'ChatGPT Plus nâng cấp email',  defaultSalePrice: 499000, defaultCostPrice: 350000, defaultDurationDays: 30 },
    { name: 'Claude Pro',      slug: 'claude-pro',      logo: '🧠', description: 'Claude Pro Anthropic',         defaultSalePrice: 520000, defaultCostPrice: 380000, defaultDurationDays: 30 },
    { name: 'YouTube Premium', slug: 'youtube-premium', logo: '▶️', description: 'YouTube Premium không quảng cáo', defaultSalePrice: 150000, defaultCostPrice: 80000,  defaultDurationDays: 180 },
  ];

  const services = [];
  for (const s of servicesData) {
    const svc = await prisma.service.create({ data: s });
    services.push(svc);
  }
  // Lookup helpers
  const SVC: Record<string, typeof services[0]> = {};
  for (const s of services) SVC[s.slug] = s;
  console.log(`✅ ${services.length} dịch vụ`);

  // ==========================================
  // 4. Nguồn hàng (5 nguồn)
  // ==========================================
  const sourcesData = [
    { name: 'Nguồn A',       telegram: '@int_acc_seller',   zalo: '098111222', email: 'supplier_a@mmo.vn', note: 'Chuyên Canva, CapCut' },
    { name: 'Nguồn B',       telegram: '@vn_ai_warehouse',  zalo: '098333444', email: 'supplier_b@mmo.vn', note: 'Chuyên ChatGPT, Claude Pro' },
    { name: 'Nguồn C',       telegram: '@mmo_entertainment',zalo: '098555666', email: 'supplier_c@mmo.vn', note: 'Chuyên YouTube, Netflix' },
    { name: 'Nguồn Telegram', telegram: '@tele_seller_99',  zalo: undefined,   email: undefined,          note: 'Nhóm Telegram MMO tổng hợp' },
    { name: 'Nguồn Partner',  telegram: '@partner1_mmo',    zalo: '090123999', email: 'partner@gmail.com', note: 'Đối tác sỉ Canva chất lượng cao' },
  ];

  const sources = [];
  for (const src of sourcesData) {
    const s = await prisma.supplierSource.create({ data: src as any });
    sources.push(s);
  }
  const [srcA, srcB, srcC, srcTele, srcPartner] = sources;
  console.log(`✅ ${sources.length} nguồn hàng`);

  // ==========================================
  // 5. Tạo 100 Đơn hàng
  // ==========================================
  const now = new Date();
  let orderCount = 1;
  const ordersCreated: any[] = [];

  /**
   * Helper tạo đơn — tự tính profit
   */
  async function createOrder(data: {
    customerId: string;
    serviceId: string;
    packageName: string;
    durationDays: number;
    salePrice: number;
    costPrice: number;
    startDate: Date;
    endDate: Date;
    status: string;
    paymentStatus?: string;
    paymentDueDate?: Date;
    paidAmount?: number;
    supplierSourceId?: string;
    supplierSourceName?: string;
    accountEmail?: string;
    accountPassword?: string;
    note?: string;
    createdAt?: Date;
  }) {
    const code = `DH-${String(orderCount).padStart(6, '0')}`;
    orderCount++;
    const profit = data.salePrice - data.costPrice;
    const order = await prisma.order.create({
      data: {
        orderCode: code,
        customerId: data.customerId,
        serviceId: data.serviceId,
        packageName: data.packageName,
        durationDays: data.durationDays,
        salePrice: data.salePrice,
        costPrice: data.costPrice,
        profit,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
        paymentStatus: data.paymentStatus || 'PAID',
        paymentDueDate: data.paymentDueDate,
        paidAmount: data.paidAmount ?? data.salePrice,
        supplierSourceId: data.supplierSourceId,
        supplierSourceName: data.supplierSourceName,
        accountEmail: data.accountEmail || `user${orderCount}@example.com`,
        accountPassword: data.accountPassword || `Pass${orderCount}@2024`,
        note: data.note,
        createdAt: data.createdAt,
      },
    });
    ordersCreated.push(order);
    return order;
  }

  // ==========================================
  // NHÓM A: 40 đơn ACTIVE (còn hạn dài)
  // ==========================================
  console.log('📦 Tạo nhóm A: ACTIVE orders...');

  // Canva 365 ngày — Khách A
  for (let i = 0; i < 8; i++) {
    const startDate = new Date(now.getTime() - (30 + i * 5) * DAY_MS);
    const durationDays = 365;
    const salePrice = 299000;
    const costPrice = 120000;
    await createOrder({
      customerId: customers[i % 8].id,
      serviceId: SVC['canva-pro'].id,
      packageName: 'Gói 365 ngày',
      durationDays,
      salePrice,
      costPrice,
      startDate,
      endDate: new Date(startDate.getTime() + durationDays * DAY_MS),
      status: 'ACTIVE',
      supplierSourceId: srcPartner.id,
      supplierSourceName: srcPartner.name,
      accountEmail: `canva_user${i + 1}@gmail.com`,
      note: 'Mời vào team Pro thành công',
    });
  }

  // ChatGPT 30 ngày — Khách B, C, D
  for (let i = 0; i < 8; i++) {
    const startDate = new Date(now.getTime() - (i * 2) * DAY_MS);
    const durationDays = 30;
    const salePrice = 499000;
    const costPrice = 350000;
    await createOrder({
      customerId: customers[i % 3].id,
      serviceId: SVC['chatgpt-plus'].id,
      packageName: 'Gói 30 ngày',
      durationDays,
      salePrice,
      costPrice,
      startDate,
      endDate: new Date(startDate.getTime() + durationDays * DAY_MS),
      status: 'ACTIVE',
      supplierSourceId: srcB.id,
      supplierSourceName: srcB.name,
      accountEmail: `gpt_user${i + 1}@hotmail.com`,
    });
  }

  // Claude Pro 30 ngày
  for (let i = 0; i < 6; i++) {
    const startDate = new Date(now.getTime() - (i * 3) * DAY_MS);
    const durationDays = 30;
    const salePrice = 520000;
    const costPrice = 380000;
    await createOrder({
      customerId: customers[(i + 2) % 10].id,
      serviceId: SVC['claude-pro'].id,
      packageName: 'Gói 30 ngày',
      durationDays,
      salePrice,
      costPrice,
      startDate,
      endDate: new Date(startDate.getTime() + durationDays * DAY_MS),
      status: 'ACTIVE',
      supplierSourceId: srcB.id,
      supplierSourceName: srcB.name,
      accountEmail: `claude_user${i + 1}@gmail.com`,
    });
  }

  // CapCut 30 ngày
  for (let i = 0; i < 6; i++) {
    const startDate = new Date(now.getTime() - (5 + i) * DAY_MS);
    const durationDays = 30;
    const salePrice = 99000;
    const costPrice = 40000;
    await createOrder({
      customerId: customers[(i + 3) % 10].id,
      serviceId: SVC['capcut-pro'].id,
      packageName: 'Gói 30 ngày',
      durationDays,
      salePrice,
      costPrice,
      startDate,
      endDate: new Date(startDate.getTime() + durationDays * DAY_MS),
      status: 'ACTIVE',
      supplierSourceId: srcA.id,
      supplierSourceName: srcA.name,
      accountEmail: `capcut_user${i + 1}@gmail.com`,
    });
  }

  // Grok Premium 30 ngày
  for (let i = 0; i < 6; i++) {
    const startDate = new Date(now.getTime() - (i * 4) * DAY_MS);
    const durationDays = 30;
    const salePrice = 450000;
    const costPrice = 300000;
    await createOrder({
      customerId: customers[(i + 5) % 10].id,
      serviceId: SVC['grok-premium'].id,
      packageName: 'Gói 30 ngày',
      durationDays,
      salePrice,
      costPrice,
      startDate,
      endDate: new Date(startDate.getTime() + durationDays * DAY_MS),
      status: 'ACTIVE',
      supplierSourceId: srcC.id,
      supplierSourceName: srcC.name,
      accountEmail: `grok_user${i + 1}@twitter.com`,
    });
  }

  // YouTube Premium 180 ngày
  for (let i = 0; i < 6; i++) {
    const startDate = new Date(now.getTime() - (20 + i * 10) * DAY_MS);
    const durationDays = 180;
    const salePrice = 150000;
    const costPrice = 80000;
    await createOrder({
      customerId: customers[i % 10].id,
      serviceId: SVC['youtube-premium'].id,
      packageName: 'Gói 180 ngày',
      durationDays,
      salePrice,
      costPrice,
      startDate,
      endDate: new Date(startDate.getTime() + durationDays * DAY_MS),
      status: 'ACTIVE',
      supplierSourceId: srcC.id,
      supplierSourceName: srcC.name,
      accountEmail: `yt_user${i + 1}@gmail.com`,
    });
  }
  console.log(`  → ${ordersCreated.length} đơn ACTIVE`);

  // ==========================================
  // NHÓM B: 10 đơn EXPIRING_SOON (< 7 ngày)
  // ==========================================
  console.log('📦 Tạo nhóm B: EXPIRING_SOON orders...');
  const expiringServices = [
    { slug: 'chatgpt-plus', sp: 499000, cp: 350000, dur: 30, srcId: srcB.id, srcName: srcB.name },
    { slug: 'claude-pro',   sp: 520000, cp: 380000, dur: 30, srcId: srcB.id, srcName: srcB.name },
    { slug: 'grok-premium', sp: 450000, cp: 300000, dur: 30, srcId: srcC.id, srcName: srcC.name },
    { slug: 'canva-pro',    sp: 299000, cp: 120000, dur: 90, srcId: srcPartner.id, srcName: srcPartner.name },
    { slug: 'capcut-pro',   sp: 99000,  cp: 40000,  dur: 30, srcId: srcA.id, srcName: srcA.name },
  ];
  for (let i = 0; i < 10; i++) {
    const remainingDays = i + 1; // 1 to 10 days remaining
    const svc = expiringServices[i % expiringServices.length];
    const endDate = new Date(now.getTime() + remainingDays * DAY_MS);
    const startDate = new Date(endDate.getTime() - svc.dur * DAY_MS);
    await createOrder({
      customerId: customers[i % 10].id,
      serviceId: SVC[svc.slug].id,
      packageName: `Gói ${svc.dur} ngày`,
      durationDays: svc.dur,
      salePrice: svc.sp,
      costPrice: svc.cp,
      startDate,
      endDate,
      status: remainingDays <= 7 ? 'EXPIRING_SOON' : 'ACTIVE',
      supplierSourceId: svc.srcId,
      supplierSourceName: svc.srcName,
      accountEmail: `expiring_user${i + 1}@gmail.com`,
      note: `Còn ${remainingDays} ngày — cần nhắc gia hạn`,
    });
  }
  console.log(`  → ${ordersCreated.length} đơn (tổng)`);

  // ==========================================
  // NHÓM C: 15 đơn EXPIRED
  // ==========================================
  console.log('📦 Tạo nhóm C: EXPIRED orders...');
  for (let i = 0; i < 15; i++) {
    const expiredDaysAgo = 1 + i * 2;
    const dur = 30;
    const endDate = new Date(now.getTime() - expiredDaysAgo * DAY_MS);
    const startDate = new Date(endDate.getTime() - dur * DAY_MS);
    const svc = expiringServices[i % expiringServices.length];
    await createOrder({
      customerId: customers[i % 10].id,
      serviceId: SVC[svc.slug].id,
      packageName: `Gói ${dur} ngày`,
      durationDays: dur,
      salePrice: svc.sp,
      costPrice: svc.cp,
      startDate,
      endDate,
      status: 'EXPIRED',
      supplierSourceId: svc.srcId,
      supplierSourceName: svc.srcName,
      accountEmail: `expired_user${i + 1}@gmail.com`,
      createdAt: startDate,
    });
  }

  // ==========================================
  // NHÓM D: 10 đơn WARRANTY / BẢO HÀNH
  // ==========================================
  console.log('📦 Tạo nhóm D: WARRANTY orders...');
  const warrantyStatuses = [
    'WARRANTY',
    'WARRANTY_PENDING_SOURCE',
    'WARRANTY_PENDING_SOURCE',
    'WARRANTY_PENDING_REFUND',
    'WARRANTY_PENDING_REFUND',
    'WARRANTY',
    'WARRANTY_PENDING_SOURCE',
    'WARRANTY_PENDING_REFUND',
    'WARRANTY',
    'WARRANTY_PENDING_SOURCE',
  ];

  for (let i = 0; i < 10; i++) {
    const dur = 30;
    const startDate = new Date(now.getTime() - (15 + i) * DAY_MS);
    const endDate = new Date(startDate.getTime() + dur * DAY_MS);
    const svc = expiringServices[i % expiringServices.length];
    const status = warrantyStatuses[i];

    const order = await createOrder({
      customerId: customers[i % 10].id,
      serviceId: SVC[svc.slug].id,
      packageName: `Gói ${dur} ngày`,
      durationDays: dur,
      salePrice: svc.sp,
      costPrice: svc.cp,
      startDate,
      endDate,
      status,
      supplierSourceId: svc.srcId,
      supplierSourceName: svc.srcName,
      accountEmail: `warranty_user${i + 1}@gmail.com`,
      note: `Khách báo lỗi ngày ${new Date(now.getTime() - (10 - i) * DAY_MS).toLocaleDateString('vi-VN')}`,
    });

    // Tạo RefundHistory cho mỗi đơn bảo hành
    const errorDate = new Date(now.getTime() - (10 - i) * DAY_MS);
    const rf = computeRefundFields({ salePrice: svc.sp, costPrice: svc.cp, durationDays: dur, startDate, endDate, errorDate });

    // Quyết định source status theo order status
    let sourceStatus = 'PENDING';
    let sourceRefundActual = 0;
    if (status === 'WARRANTY_PENDING_REFUND') {
      sourceStatus = 'REFUNDED';
      sourceRefundActual = rf.sourceRefundExpected;
    }

    const netProfitAfterRefund = svc.sp - svc.cp - rf.autoRefundAmount + sourceRefundActual;

    await prisma.refundHistory.create({
      data: {
        orderId: order.id,
        amount: rf.autoRefundAmount,
        autoRefundAmount: rf.autoRefundAmount,
        daysUsed: rf.daysUsed,
        daysRemaining: rf.daysRemaining,
        costPerDay: rf.costPerDay,
        errorDate,
        operatorName: 'Quản trị viên',
        note: `Tài khoản bị lỗi sau ${rf.daysUsed} ngày sử dụng`,
        sourceRefundExpected: rf.sourceRefundExpected,
        sourceRefundActual,
        sourceStatus,
        netProfitAfterRefund,
      },
    });
  }

  // ==========================================
  // NHÓM E: 10 đơn WARRANTY_DONE & WARRANTY_REJECTED
  // ==========================================
  console.log('📦 Tạo nhóm E: WARRANTY_DONE & REJECTED orders...');
  for (let i = 0; i < 10; i++) {
    const dur = 30;
    const createdAt = new Date(now.getTime() - (20 + i * 3) * DAY_MS);
    const startDate = createdAt;
    const endDate = new Date(startDate.getTime() + dur * DAY_MS);
    const svc = expiringServices[i % expiringServices.length];
    const isDone = i < 6;
    const status = isDone ? 'WARRANTY_DONE' : 'WARRANTY_REJECTED';

    const order = await createOrder({
      customerId: customers[(i + 4) % 10].id,
      serviceId: SVC[svc.slug].id,
      packageName: `Gói ${dur} ngày`,
      durationDays: dur,
      salePrice: svc.sp,
      costPrice: svc.cp,
      startDate,
      endDate,
      status,
      supplierSourceId: svc.srcId,
      supplierSourceName: svc.srcName,
      accountEmail: `done_user${i + 1}@gmail.com`,
      createdAt,
    });

    const errorDate = new Date(createdAt.getTime() + 10 * DAY_MS);
    const rf = computeRefundFields({ salePrice: svc.sp, costPrice: svc.cp, durationDays: dur, startDate, endDate, errorDate });

    const sourceStatus = isDone ? 'REFUNDED' : 'REJECTED';
    const sourceRefundActual = isDone ? rf.sourceRefundExpected : 0;
    const netProfitAfterRefund = svc.sp - svc.cp - rf.autoRefundAmount + sourceRefundActual;

    await prisma.refundHistory.create({
      data: {
        orderId: order.id,
        amount: rf.autoRefundAmount,
        autoRefundAmount: rf.autoRefundAmount,
        daysUsed: rf.daysUsed,
        daysRemaining: rf.daysRemaining,
        costPerDay: rf.costPerDay,
        errorDate,
        operatorName: 'Quản trị viên',
        note: isDone ? 'Hoàn tất bảo hành, đã hoàn khách và nguồn' : 'Nguồn từ chối bảo hành, khách tự chịu lỗi',
        sourceRefundExpected: rf.sourceRefundExpected,
        sourceRefundActual,
        sourceStatus,
        netProfitAfterRefund,
      },
    });
  }

  // ==========================================
  // NHÓM F: 15 đơn CÔNG NỢ (UNPAID / OVERDUE)
  // ==========================================
  console.log('📦 Tạo nhóm F: DEBT orders (UNPAID/OVERDUE)...');

  // Khách I (hay nợ tiền) — 5 đơn OVERDUE
  for (let i = 0; i < 5; i++) {
    const dur = 30;
    const startDate = new Date(now.getTime() - (5 + i) * DAY_MS);
    const endDate = new Date(startDate.getTime() + dur * DAY_MS);
    const svc = expiringServices[i % expiringServices.length];
    const paymentDueDate = new Date(now.getTime() - (3 + i * 5) * DAY_MS); // Đã quá hạn

    await createOrder({
      customerId: customers[8].id, // Cao Thị I
      serviceId: SVC[svc.slug].id,
      packageName: `Gói ${dur} ngày`,
      durationDays: dur,
      salePrice: svc.sp,
      costPrice: svc.cp,
      startDate,
      endDate,
      status: 'ACTIVE',
      paymentStatus: 'OVERDUE',
      paymentDueDate,
      paidAmount: 0,
      supplierSourceId: svc.srcId,
      supplierSourceName: svc.srcName,
      accountEmail: `debt_overdue${i + 1}@gmail.com`,
      note: `Quá hạn thanh toán ${i + 3} ngày`,
    });
  }

  // Khách khác — 10 đơn UNPAID (chưa đến hạn)
  const debtCusts = [0, 1, 2, 3, 4, 6, 7, 9, 0, 1];
  for (let i = 0; i < 10; i++) {
    const dur = 30;
    const startDate = new Date(now.getTime() - i * DAY_MS);
    const endDate = new Date(startDate.getTime() + dur * DAY_MS);
    const svc = expiringServices[i % expiringServices.length];
    const paymentDueDate = new Date(now.getTime() + (2 + i) * DAY_MS); // Chưa đến hạn

    await createOrder({
      customerId: customers[debtCusts[i]].id,
      serviceId: SVC[svc.slug].id,
      packageName: `Gói ${dur} ngày`,
      durationDays: dur,
      salePrice: svc.sp,
      costPrice: svc.cp,
      startDate,
      endDate,
      status: 'ACTIVE',
      paymentStatus: 'UNPAID',
      paymentDueDate,
      paidAmount: 0,
      supplierSourceId: svc.srcId,
      supplierSourceName: svc.srcName,
      accountEmail: `debt_unpaid${i + 1}@gmail.com`,
      note: `Khách chưa thanh toán, hạn còn ${i + 2} ngày`,
    });
  }

  // ==========================================
  // NHÓM G: Đơn quá khứ (vẽ biểu đồ xu hướng — 12 tháng)
  // ==========================================
  console.log('📦 Tạo nhóm G: Historical orders cho biểu đồ...');

  // Tạo đủ dữ liệu cho 12 tháng gần nhất (3-5 đơn/tháng)
  for (let monthsAgo = 1; monthsAgo <= 12; monthsAgo++) {
    const baseDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 10);
    const ordersPerMonth = 3 + (monthsAgo % 3); // 3-5 đơn/tháng

    for (let j = 0; j < ordersPerMonth; j++) {
      const createdAt = new Date(baseDate.getTime() + j * 5 * DAY_MS);
      const svc = expiringServices[j % expiringServices.length];
      const dur = 30;

      await createOrder({
        customerId: customers[(monthsAgo + j) % 10].id,
        serviceId: SVC[svc.slug].id,
        packageName: `Gói ${dur} ngày`,
        durationDays: dur,
        salePrice: svc.sp,
        costPrice: svc.cp,
        startDate: createdAt,
        endDate: new Date(createdAt.getTime() + dur * DAY_MS),
        status: 'EXPIRED',
        supplierSourceId: svc.srcId,
        supplierSourceName: svc.srcName,
        accountEmail: `hist_${monthsAgo}_${j}@gmail.com`,
        createdAt,
      });
    }
  }

  // Thêm đơn hôm qua để biểu đồ hôm nay vs hôm qua có dữ liệu
  const yesterday = new Date(now.getTime() - 1 * DAY_MS);
  for (let i = 0; i < 3; i++) {
    const svc = expiringServices[i % expiringServices.length];
    await createOrder({
      customerId: customers[i % 10].id,
      serviceId: SVC[svc.slug].id,
      packageName: 'Gói 30 ngày',
      durationDays: 30,
      salePrice: svc.sp,
      costPrice: svc.cp,
      startDate: yesterday,
      endDate: new Date(yesterday.getTime() + 30 * DAY_MS),
      status: 'ACTIVE',
      supplierSourceId: svc.srcId,
      supplierSourceName: svc.srcName,
      accountEmail: `yesterday_user${i + 1}@gmail.com`,
      createdAt: yesterday,
    });
  }

  // Đơn hôm nay
  for (let i = 0; i < 2; i++) {
    const svc = expiringServices[i % expiringServices.length];
    await createOrder({
      customerId: customers[(i + 5) % 10].id,
      serviceId: SVC[svc.slug].id,
      packageName: 'Gói 30 ngày',
      durationDays: 30,
      salePrice: svc.sp,
      costPrice: svc.cp,
      startDate: now,
      endDate: new Date(now.getTime() + 30 * DAY_MS),
      status: 'ACTIVE',
      supplierSourceId: svc.srcId,
      supplierSourceName: svc.srcName,
      accountEmail: `today_user${i + 1}@gmail.com`,
      createdAt: now,
    });
  }

  console.log(`✅ Tổng ${ordersCreated.length} đơn hàng đã tạo`);

  // ==========================================
  // 6. Activity Logs
  // ==========================================
  await prisma.activityLog.createMany({
    data: [
      { userId: admin.id, action: 'SEED_DATA', target: 'Hệ thống', details: `Seed ${ordersCreated.length} đơn hàng thực tế` },
      { userId: admin.id, action: 'ĐĂNG_NHẬP', target: 'Dashboard', details: 'Đăng nhập quản trị' },
    ],
  });

  console.log('\n🎉 Seed dữ liệu hoàn tất!');
  console.log(`📊 Tổng đơn: ${ordersCreated.length}`);
  console.log('👤 Admin: admin@mmo.vn / admin123');
  console.log('👤 Staff: staff@mmo.vn / staff123');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
