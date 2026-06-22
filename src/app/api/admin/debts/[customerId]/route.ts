import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET: Customer debt detail (#65)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { customerId } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Khách hàng không tồn tại' }, { status: 404 });
    }

    // Get all unpaid orders
    const unpaidOrders = await prisma.order.findMany({
      where: {
        customerId,
        paymentStatus: { in: ['UNPAID', 'OVERDUE'] },
      },
      include: { service: true },
      orderBy: { startDate: 'asc' },
    });

    // Payment history (#66)
    const paymentRecords = await prisma.paymentRecord.findMany({
      where: { customerId },
      include: { order: { select: { orderCode: true } } },
      orderBy: { paidAt: 'desc' },
      take: 50,
    });

    // Payment stats (#66)
    const allOrders = await prisma.order.findMany({
      where: { customerId },
      select: { paymentStatus: true, paymentDueDate: true, paidAt: true },
    });

    const now = new Date();
    let paidOnTimeCount = 0;
    let latePaymentCount = 0;
    let currentDebtCount = 0;

    for (const order of allOrders) {
      if (order.paymentStatus === 'PAID') {
        if (order.paymentDueDate && order.paidAt) {
          if (new Date(order.paidAt) <= new Date(order.paymentDueDate)) {
            paidOnTimeCount++;
          } else {
            latePaymentCount++;
          }
        } else {
          paidOnTimeCount++; // Assume on-time if no due date
        }
      } else {
        currentDebtCount++;
      }
    }

    const totalDebt = unpaidOrders.reduce((sum: number, o: any) => sum + (o.salePrice - o.paidAmount), 0);

    return NextResponse.json({
      customer,
      unpaidOrders: unpaidOrders.map((o: any) => {
        const startDateObj = new Date(o.startDate);
        const daysInDebt = Math.max(0, Math.floor((now.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000)));
        return {
          ...o,
          remainingAmount: o.salePrice - o.paidAmount,
          daysInDebt,
        };
      }),
      paymentRecords,
      stats: {
        totalOrders: allOrders.length,
        paidOnTimeCount,
        latePaymentCount,
        currentDebtCount,
        totalDebt,
      },
    });
  } catch (error: any) {
    console.error('Customer debt detail API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
