import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const serviceId = searchParams.get('serviceId') || '';
    const sourceId = searchParams.get('sourceId') || '';
    const sourceStatus = searchParams.get('sourceStatus') || '';
    const dateStart = searchParams.get('dateStart') || '';
    const dateEnd = searchParams.get('dateEnd') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by Date range
    if (dateStart || dateEnd) {
      where.createdAt = {};
      if (dateStart) where.createdAt.gte = new Date(dateStart + 'T00:00:00');
      if (dateEnd) where.createdAt.lte = new Date(dateEnd + 'T23:59:59');
    }

    // Filter by source status
    if (sourceStatus) {
      where.sourceStatus = sourceStatus;
    }

    // Build order filter
    const orderFilter: any = {};
    if (serviceId) orderFilter.serviceId = serviceId;
    if (sourceId) orderFilter.supplierSourceId = sourceId;
    if (search) {
      orderFilter.OR = [
        { orderCode: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    if (Object.keys(orderFilter).length > 0) {
      where.order = orderFilter;
    }

    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const [allFilteredRefunds, total] = await Promise.all([
      prisma.refundHistory.findMany({
        where,
        include: {
          order: {
            include: {
              customer: { select: { name: true, phone: true } },
              service: { select: { name: true, logo: true } },
            },
          },
        },
      }),
      prisma.refundHistory.count({ where }),
    ]);

    allFilteredRefunds.sort((a: any, b: any) => {
      let valA: any;
      let valB: any;

      if (sortBy === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      } else if (sortBy === 'amount') {
        valA = a.amount;
        valB = b.amount;
      } else if (sortBy === 'sourceRefundActual') {
        valA = a.sourceRefundActual ?? a.sourceAmount ?? 0;
        valB = b.sourceRefundActual ?? b.sourceAmount ?? 0;
      } else if (sortBy === 'salePrice') {
        valA = a.order?.salePrice ?? 0;
        valB = b.order?.salePrice ?? 0;
      } else if (sortBy === 'costPrice') {
        valA = a.order?.costPrice ?? 0;
        valB = b.order?.costPrice ?? 0;
      } else if (sortBy === 'netProfitAfterRefund') {
        valA = a.netProfitAfterRefund ?? 0;
        valB = b.netProfitAfterRefund ?? 0;
      } else if (sortBy === 'sourceStatus') {
        const workflowOrder = (status: string) => {
          const s = status || '';
          if (s === 'PENDING' || s === 'NOT_REQUESTED') return 1;
          if (s === 'REQUESTED' || s === 'APPROVED') return 2;
          if (s === 'REFUNDED') return 3;
          if (s === 'REJECTED') return 4;
          return 5;
        };
        valA = workflowOrder(a.sourceStatus);
        valB = workflowOrder(b.sourceStatus);
      } else {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const refunds = allFilteredRefunds.slice(skip, skip + limit);

    // ==========================================
    // Dashboard stats — computed from ALL refunds (no filter for global stats)
    // ==========================================
    const allRefunds = await prisma.refundHistory.findMany({
      select: {
        amount: true,
        sourceRefundExpected: true,
        sourceRefundActual: true,
        sourceStatus: true,
        order: {
          select: { salePrice: true, costPrice: true, status: true },
        },
      },
    });

    let totalClientRefundActual = 0;
    let totalSourceRefundExpected = 0;
    let totalSourceRefundActual = 0;
    let totalProfitAfterRefund = 0;
    let totalSourceDebt = 0;

    let totalClientRefundedCount = 0;
    let totalPendingSourceCount = 0;
    let totalPendingClientCount = 0;
    let totalRejectedSourceCount = 0;

    for (const r of allRefunds) {
      totalClientRefundActual += r.amount || 0;
      totalSourceRefundExpected += r.sourceRefundExpected || 0;
      totalSourceRefundActual += r.sourceRefundActual || 0;

      const profit = (r.order?.salePrice ?? 0) - (r.order?.costPrice ?? 0) - (r.amount || 0) + (r.sourceRefundActual || 0);
      totalProfitAfterRefund += profit;

      const isRejected = r.order?.status === 'SOURCE_REJECTED' || r.sourceStatus === 'REJECTED';
      const isRefunded = r.order?.status === 'COMPLETED' || r.sourceStatus === 'REFUNDED';
      const isPendingClient = r.order?.status === 'WAIT_CUSTOMER_REFUND';

      if (isRejected) {
        totalRejectedSourceCount++;
      } else if (isRefunded) {
        totalClientRefundedCount++;
      } else if (isPendingClient) {
        totalPendingClientCount++;
      } else {
        totalPendingSourceCount++;
      }

      const isWaiting = ['PENDING', 'NOT_REQUESTED', 'REQUESTED', 'APPROVED'].includes(r.sourceStatus) && !isRejected;
      if (isWaiting) {
        totalSourceDebt += Math.max(0, (r.sourceRefundExpected || 0) - (r.sourceRefundActual || 0));
      }
    }

    const refundDiff = totalSourceRefundActual - totalSourceRefundExpected;

    const dashboard = {
      totalClientRefundActual,
      totalSourceRefundExpected,
      totalSourceRefundActual,
      totalSourceDebt,
      refundDiff,
      totalProfitAfterRefund,
      totalPending: totalSourceDebt,
      totalRefundCount: allRefunds.length,
      totalClientRefundedCount,
      totalPendingSourceCount,
      totalPendingClientCount,
      totalRejectedSourceCount,
    };

    return NextResponse.json({
      dashboard,
      refunds,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Fetch refund histories API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
