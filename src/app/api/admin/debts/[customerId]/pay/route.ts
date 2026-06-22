import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST: Confirm payment for customer (#73)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { customerId } = await params;
    const body = await request.json();
    const { mode, orderIds, amount, method, note } = body;
    // mode: 'all' | 'partial_orders' | 'partial_amount'

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: 'Khách hàng không tồn tại' }, { status: 404 });
    }

    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: session.user.id },
          { email: session.user.email || undefined }
        ]
      }
    });
    const logUserId = dbUser ? dbUser.id : null;
    const now = new Date();

    if (mode === 'all') {
      // Pay all unpaid orders
      const unpaidOrders = await prisma.order.findMany({
        where: { customerId, paymentStatus: { in: ['UNPAID', 'OVERDUE'] } },
      });

      let totalPaid = 0;
      await prisma.$transaction(async (tx: any) => {
        for (const order of unpaidOrders) {
          const remaining = order.salePrice - order.paidAmount;
          totalPaid += remaining;

          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: 'PAID',
              paidAmount: order.salePrice,
              paidAt: now,
            },
          });

          await tx.paymentRecord.create({
            data: {
              customerId,
              orderId: order.id,
              amount: remaining,
              method: method || null,
              note: note || 'Thanh toán toàn bộ',
              paidAt: now,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: logUserId,
            action: 'PAYMENT_ALL',
            target: `Customer:${customerId}`,
            details: `Xác nhận thanh toán toàn bộ ${unpaidOrders.length} đơn. Tổng: ${totalPaid}đ`,
          },
        });
      });

      return NextResponse.json({ success: true, totalPaid, orderCount: unpaidOrders.length });
    }

    if (mode === 'partial_orders' && orderIds && Array.isArray(orderIds)) {
      // Pay selected orders
      let totalPaid = 0;
      await prisma.$transaction(async (tx: any) => {
        for (const orderId of orderIds) {
          const order = await tx.order.findUnique({ where: { id: orderId } });
          if (!order || order.customerId !== customerId) continue;

          const remaining = order.salePrice - order.paidAmount;
          totalPaid += remaining;

          await tx.order.update({
            where: { id: orderId },
            data: {
              paymentStatus: 'PAID',
              paidAmount: order.salePrice,
              paidAt: now,
            },
          });

          await tx.paymentRecord.create({
            data: {
              customerId,
              orderId,
              amount: remaining,
              method: method || null,
              note: note || 'Thanh toán từng đơn',
              paidAt: now,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: logUserId,
            action: 'PAYMENT_PARTIAL',
            target: `Customer:${customerId}`,
            details: `Xác nhận thanh toán ${orderIds.length} đơn. Tổng: ${totalPaid}đ`,
          },
        });
      });

      return NextResponse.json({ success: true, totalPaid, orderCount: orderIds.length });
    }

    if (mode === 'partial_amount' && amount) {
      // Pay a specific amount, distribute across oldest orders first
      let remainingAmount = parseFloat(amount);
      let paidOrderCount = 0;

      const unpaidOrders = await prisma.order.findMany({
        where: { customerId, paymentStatus: { in: ['UNPAID', 'OVERDUE'] } },
        orderBy: { createdAt: 'asc' },
      });

      await prisma.$transaction(async (tx: any) => {
        for (const order of unpaidOrders) {
          if (remainingAmount <= 0) break;

          const orderRemaining = order.salePrice - order.paidAmount;
          const payAmount = Math.min(remainingAmount, orderRemaining);

          const newPaidAmount = order.paidAmount + payAmount;
          const isPaidFull = newPaidAmount >= order.salePrice;

          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: isPaidFull ? 'PAID' : 'UNPAID',
              paidAmount: newPaidAmount,
              ...(isPaidFull ? { paidAt: now } : {}),
            },
          });

          await tx.paymentRecord.create({
            data: {
              customerId,
              orderId: order.id,
              amount: payAmount,
              method: method || null,
              note: note || `Thanh toán một phần (${payAmount}đ)`,
              paidAt: now,
            },
          });

          remainingAmount -= payAmount;
          paidOrderCount++;
        }

        await tx.activityLog.create({
          data: {
            userId: logUserId,
            action: 'PAYMENT_AMOUNT',
            target: `Customer:${customerId}`,
            details: `Xác nhận thanh toán ${parseFloat(amount)}đ cho ${paidOrderCount} đơn.`,
          },
        });
      });

      return NextResponse.json({
        success: true,
        totalPaid: parseFloat(amount) - remainingAmount,
        orderCount: paidOrderCount,
      });
    }

    return NextResponse.json({ error: 'Mode thanh toán không hợp lệ' }, { status: 400 });
  } catch (error: any) {
    console.error('Payment API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
