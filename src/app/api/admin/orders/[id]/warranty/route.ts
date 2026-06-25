import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { errorDate, reason, note } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Lý do lỗi là bắt buộc' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    const faultDate = errorDate ? new Date(errorDate) : new Date();
    const formattedDate = faultDate.toLocaleDateString('vi-VN');

    // Append to note
    const updatedNote = `${order.note || ''}\n[Báo lỗi ${formattedDate}]: ${reason}.${note ? ' Ghi chú: ' + note : ''}`.trim();

    // Pro-rata calculations
    const start = new Date(order.startDate);
    const totalDays = order.durationDays || 30;
    const diffTime = faultDate.getTime() - start.getTime();
    let daysUsed = Math.floor(diffTime / (24 * 60 * 60 * 1000));
    if (daysUsed < 0) daysUsed = 0;
    if (daysUsed > totalDays) daysUsed = totalDays;
    const daysRemaining = totalDays - daysUsed;
    const costPerDay = order.salePrice / totalDays;
    const refundAmount = Math.round(daysRemaining * costPerDay);
    const supplierCostPerDay = order.costPrice / totalDays;
    const sourceRefundExpected = Math.round(daysRemaining * supplierCostPerDay);

    const updatedProfit = order.salePrice - order.costPrice - refundAmount + sourceRefundExpected;

    const updated = await prisma.$transaction(async (tx: any) => {
      const ord = await tx.order.update({
        where: { id },
        data: {
          status: 'WARRANTY',
          profit: updatedProfit,
          note: updatedNote,
        },
      });

      await tx.refundHistory.create({
        data: {
          orderId: id,
          amount: refundAmount,
          autoRefundAmount: refundAmount,
          daysUsed,
          daysRemaining,
          costPerDay,
          errorDate: faultDate,
          operatorName: session.user.name || 'Hệ thống',
          note: reason,
          sourceRefundExpected,
          sourceRefundActual: sourceRefundExpected,
          sourceStatus: 'PENDING',
          netProfitAfterRefund: order.salePrice - order.costPrice - refundAmount + sourceRefundExpected,
        },
      });

      return ord;
    });

    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: session.user.id },
          { email: session.user.email || undefined }
        ]
      }
    });
    const logUserId = dbUser ? dbUser.id : null;

    // Log Action
    await prisma.activityLog.create({
      data: {
        userId: logUserId,
        action: 'WARRANTY_ORDER',
        target: `Order:${id}`,
        details: `Khách báo lỗi: ${reason}.${note ? ' Ghi chú: ' + note : ''}`,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Report error API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
