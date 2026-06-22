import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';
    const orderCode = searchParams.get('orderCode') || '';
    const customerName = searchParams.get('customerName') || '';
    const serviceId = searchParams.get('serviceId') || '';
    const supplierId = searchParams.get('supplierId') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Sub-queries to find matching orders
    const orderWhere: any = {};
    if (orderCode) {
      orderWhere.orderCode = { contains: orderCode };
    }
    if (customerName) {
      orderWhere.customer = { name: { contains: customerName } };
    }
    if (serviceId) {
      orderWhere.serviceId = serviceId;
    }
    if (supplierId) {
      orderWhere.supplierSourceId = supplierId;
    }

    const hasOrderFilters = orderCode || customerName || serviceId || supplierId;
    let orderIds: string[] = [];
    if (hasOrderFilters) {
      const orders = await prisma.order.findMany({
        where: orderWhere,
        select: { id: true }
      });
      orderIds = orders.map((o: { id: string }) => o.id);
    }

    const where: any = {};

    if (action) {
      where.action = action;
    }

    if (hasOrderFilters) {
      const targetOr: any[] = [
        { target: { in: orderIds.map(id => `Order:${id}`) } }
      ];
      
      if (customerName) {
        // Also match Customer target directly
        const customers = await prisma.customer.findMany({
          where: { name: { contains: customerName } },
          select: { id: true }
        });
        const customerIds = customers.map((c: { id: string }) => c.id);
        targetOr.push({ target: { in: customerIds.map((id: string) => `Customer:${id}`) } });
        targetOr.push({ details: { contains: customerName } });
      }

      if (orderCode) {
        targetOr.push({ details: { contains: orderCode } });
      }

      where.OR = targetOr;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const endLimit = new Date(endDate);
        endLimit.setHours(23, 59, 59, 999);
        where.createdAt.lte = endLimit;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get admin activity logs error:', error);
    return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
