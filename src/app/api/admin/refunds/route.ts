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

    const [refunds, total] = await Promise.all([
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.refundHistory.count({ where }),
    ]);

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
          select: { salePrice: true, costPrice: true },
        },
      },
    });

    let totalClientRefundActual = 0;
    let totalSourceRefundExpected = 0;
    let totalSourceRefundActual = 0;
    let totalProfitAfterRefund = 0;
    let totalPending = 0;

    for (const r of allRefunds) {
      totalClientRefundActual += r.amount || 0;
      totalSourceRefundExpected += r.sourceRefundExpected || 0;
      totalSourceRefundActual += r.sourceRefundActual || 0;

      const profit = (r.order?.salePrice ?? 0) - (r.order?.costPrice ?? 0) - (r.amount || 0) + (r.sourceRefundActual || 0);
      totalProfitAfterRefund += profit;

      if (r.sourceStatus === 'PENDING') {
        totalPending += Math.max(0, (r.sourceRefundExpected || 0) - (r.sourceRefundActual || 0));
      }
    }

    const totalSourceDebt = Math.max(0, totalSourceRefundExpected - totalSourceRefundActual);
    const refundDiff = totalSourceRefundActual - totalSourceRefundExpected;

    const dashboard = {
      totalClientRefundActual,
      totalSourceRefundExpected,
      totalSourceRefundActual,
      totalSourceDebt,
      refundDiff,
      totalProfitAfterRefund,
      totalPending,
      totalRefundCount: allRefunds.length,
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
