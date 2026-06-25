import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET: Fetch debt dashboard & list with aging (#62, #65)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const minOverdueDaysParam = searchParams.get('minOverdueDays');
    const minOverdueDays = minOverdueDaysParam !== null && minOverdueDaysParam !== '' ? parseInt(minOverdueDaysParam) : null;


    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Auto-update UNPAID orders past 1 day since startDate to OVERDUE status
    await prisma.order.updateMany({
      where: {
        paymentStatus: 'UNPAID',
        startDate: { lte: oneDayAgo },
      },
      data: {
        paymentStatus: 'OVERDUE',
      },
    });

    // Get all unpaid/overdue orders with customer info — filter by ID not index
    const unpaidOrders = await prisma.order.findMany({
      where: {
        paymentStatus: { in: ['UNPAID', 'OVERDUE'] },
        customer: { isDeleted: false },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { name: true, logo: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // ==========================================
    // Group by customer & aggregate stats
    // ==========================================
    const customerDebtMap = new Map<string, {
      customer: { id: string; name: string; phone: string | null };
      orders: typeof unpaidOrders;
      totalDebt: number;
      orderCount: number;
      oldestOrderDate: Date;
      maxDebtDays: number;
    }>();

    let totalCostOccupied = 0;
    let totalExpectedProfit = 0;
    let debtOver1DayCount = 0;
    let debtOver7DaysCount = 0;

    for (const order of unpaidOrders) {
      const debt = order.salePrice - order.paidAmount;
      if (debt <= 0) continue;

      const startDateObj = new Date(order.startDate);
      const daysInDebt = Math.floor((now.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000));

      totalCostOccupied += order.costPrice;
      totalExpectedProfit += order.profit;

      if (daysInDebt > 1) {
        debtOver1DayCount++;
      }
      if (daysInDebt > 7) {
        debtOver7DaysCount++;
      }

      const cId = order.customer.id; // Always use ID — never index
      if (!customerDebtMap.has(cId)) {
        customerDebtMap.set(cId, {
          customer: order.customer,
          orders: [],
          totalDebt: 0,
          orderCount: 0,
          oldestOrderDate: startDateObj,
          maxDebtDays: 0,
        });
      }
      const entry = customerDebtMap.get(cId)!;
      entry.orders.push(order);
      entry.totalDebt += debt;
      entry.orderCount++;
      entry.maxDebtDays = Math.max(entry.maxDebtDays, daysInDebt);
      if (startDateObj < entry.oldestOrderDate) {
        entry.oldestOrderDate = startDateObj;
      }
    }

    let debtList = Array.from(customerDebtMap.values());

    // Filter by search
    if (search) {
      const lowerSearch = search.toLowerCase();
      debtList = debtList.filter((d) =>
        d.customer.name.toLowerCase().includes(lowerSearch) ||
        (d.customer.phone && d.customer.phone.includes(lowerSearch))
      );
    }

    // Sort by maxDebtDays desc (highest days of debt first)
    debtList.sort((a, b) => b.maxDebtDays - a.maxDebtDays);

    // Compute buckets statistics AFTER search, BEFORE aging filter
    const buckets = {
      all: {
        count: debtList.length,
        sum: debtList.reduce((sum, d) => sum + d.totalDebt, 0),
      },
      over1: {
        count: debtList.filter(d => d.maxDebtDays >= 1).length,
        sum: debtList.filter(d => d.maxDebtDays >= 1).reduce((sum, d) => sum + d.totalDebt, 0),
      },
      over3: {
        count: debtList.filter(d => d.maxDebtDays >= 3).length,
        sum: debtList.filter(d => d.maxDebtDays >= 3).reduce((sum, d) => sum + d.totalDebt, 0),
      },
      over7: {
        count: debtList.filter(d => d.maxDebtDays >= 7).length,
        sum: debtList.filter(d => d.maxDebtDays >= 7).reduce((sum, d) => sum + d.totalDebt, 0),
      },
      over30: {
        count: debtList.filter(d => d.maxDebtDays >= 30).length,
        sum: debtList.filter(d => d.maxDebtDays >= 30).reduce((sum, d) => sum + d.totalDebt, 0),
      },
    };

    // Filter by minOverdueDays
    if (minOverdueDays !== null && minOverdueDays > 0) {
      debtList = debtList.filter((d) => d.maxDebtDays >= minOverdueDays);
    }

    // ==========================================
    // Dashboard stats (of the currently selected list)
    // ==========================================
    const totalDebtAmount = debtList.reduce((sum, d) => sum + d.totalDebt, 0);
    const unpaidOrdersCount = debtList.reduce((sum, d) => sum + d.orderCount, 0);
    const debtCustomersCount = debtList.length;

    // Top 5 debtors
    const topDebtors = [...debtList].sort((a, b) => b.totalDebt - a.totalDebt).slice(0, 5).map((d) => ({
      customerId: d.customer.id,
      customerName: d.customer.name,
      totalDebt: d.totalDebt,
      orderCount: d.orderCount,
    }));

    // Paginate
    const total = debtList.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedList = debtList.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      dashboard: {
        totalDebtAmount,
        unpaidOrdersCount,
        debtCustomersCount,
        totalCostOccupied,
        totalExpectedProfit,
        debtOver1DayCount,
        debtOver7DaysCount,
        topDebtors,
      },
      buckets,
      debts: paginatedList.map((d) => ({
        customerId: d.customer.id,
        customerName: d.customer.name,
        customerPhone: d.customer.phone,
        orderCount: d.orderCount,
        totalDebt: d.totalDebt,
        maxDebtDays: d.maxDebtDays,
        oldestOrderDate: d.oldestOrderDate.toISOString(),
      })),
      total,
      totalPages,
      page,
    });
  } catch (error: any) {
    console.error('Debts API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
