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
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Chỉ có Admin mới có quyền thực hiện hoàn tiền' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { errorDate, reason, overrideAmount, targetStatus, sourceAmount, sourceStatus } = body;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    const isLocked = ['COMPLETED', 'SOURCE_REJECTED'].includes(order.status) && !order.isUnlocked;
    if (isLocked) {
      return NextResponse.json({ error: 'Đơn hàng đã hoàn tất hoặc bị từ chối và đang bị khóa. Vui lòng mở khóa đơn trước khi hoàn tiền.' }, { status: 400 });
    }

    // Determine status: default to COMPLETED
    const finalStatus = targetStatus === 'WAIT_CUSTOMER_REFUND' || targetStatus === 'PENDING_REFUND' ? 'WAIT_CUSTOMER_REFUND' : 'COMPLETED';

    if (order.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Đơn hàng này đã hoàn tất trước đó' }, { status: 400 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';

    // Special case: Transitioning WAIT_CUSTOMER_REFUND -> COMPLETED
    if (order.status === 'WAIT_CUSTOMER_REFUND' && finalStatus === 'COMPLETED') {
      await prisma.$transaction(async (tx: any) => {
        await tx.order.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            note: reason ? `${order.note || ''}\n[Đã hoàn tiền khách]: ${reason}`.trim() : order.note,
            isUnlocked: false,
          },
        });

        // Update existing refund history details if available
        const refundHist = await tx.refundHistory.findFirst({
          where: { orderId: id },
          orderBy: { createdAt: 'desc' }
        });
        if (refundHist) {
          const finalNote = reason ? `${refundHist.note || ''}\n[Xác nhận chuyển tiền]: ${reason}`.trim() : refundHist.note;
          await tx.refundHistory.update({
            where: { id: refundHist.id },
            data: {
              operatorName: session.user.name || 'Hệ thống',
              note: finalNote
            }
          });
        }

        // Log action
        await tx.activityLog.create({
          data: {
            userId: session.user.id,
            action: 'REFUND_ORDER',
            target: `Order:${id}`,
            details: `Đã hoàn tất thanh toán tiền hoàn trả cho khách. Trạng thái chuyển thành Hoàn tất.`,
            ipAddress,
          },
        });
      });

      return NextResponse.json({
        success: true,
        status: 'COMPLETED',
      });
    }

    // Normal case: original refund calculation (Transitions ACTIVE/REPORTED -> WAIT_CUSTOMER_REFUND or COMPLETED)
    const { overrideSourceRefundActual, overrideSourceRefundExpected } = body;
    const finalSourceStatus = sourceStatus || 'PENDING';

    const faultDate = errorDate ? new Date(errorDate) : new Date();
    const start = new Date(order.startDate);
    
    const totalDays = order.durationDays || 30;
    const salePrice = order.salePrice;
    const costPerDay = salePrice / totalDays;

    // Calculate days used
    const diffTime = faultDate.getTime() - start.getTime();
    let daysUsed = Math.floor(diffTime / (24 * 60 * 60 * 1000));
    if (daysUsed < 0) daysUsed = 0;
    if (daysUsed > totalDays) daysUsed = totalDays;

    const daysRemaining = totalDays - daysUsed;
    const computedRefund = parseFloat((daysRemaining * costPerDay).toFixed(0));

    const finalRefundAmount = overrideAmount !== undefined && overrideAmount !== '' 
      ? parseFloat(overrideAmount) 
      : computedRefund;

    // Supplier pro-rata refund calculations
    const supplierCostPerDay = order.costPrice / totalDays;
    const expectedSourceRefund = overrideSourceRefundExpected !== undefined && overrideSourceRefundExpected !== ''
      ? parseFloat(overrideSourceRefundExpected)
      : parseFloat((daysRemaining * supplierCostPerDay).toFixed(0));
    
    const finalSourceRefundActual = overrideSourceRefundActual !== undefined && overrideSourceRefundActual !== ''
      ? parseFloat(overrideSourceRefundActual)
      : sourceAmount !== undefined && sourceAmount !== ''
      ? parseFloat(sourceAmount)
      : expectedSourceRefund;

    // Actual profit = salePrice - costPrice - finalRefundAmount + finalSourceRefundActual
    const newProfit = (order.salePrice - order.costPrice) - finalRefundAmount + finalSourceRefundActual;

    const statusLabel = finalStatus === 'WAIT_CUSTOMER_REFUND' ? 'Chờ hoàn tiền khách' : 'Hoàn tất';

    await prisma.$transaction(async (tx: any) => {
      // Update order status and profit
      await tx.order.update({
        where: { id },
        data: {
          status: finalStatus,
          profit: newProfit,
          note: reason ? `${order.note || ''}\n[${statusLabel} ${finalRefundAmount}đ]: ${reason}`.trim() : order.note,
          isUnlocked: false,
        },
      });

      // Create refund history record
      await tx.refundHistory.create({
        data: {
          orderId: id,
          amount: finalRefundAmount,
          daysUsed,
          daysRemaining,
          costPerDay,
          errorDate: faultDate,
          operatorName: session.user.name || 'Hệ thống',
          note: reason || null,
          sourceAmount: finalSourceRefundActual,
          sourceRefundExpected: expectedSourceRefund,
          sourceRefundActual: finalSourceRefundActual,
          sourceStatus: finalSourceStatus,
          netProfitAfterRefund: newProfit,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: finalStatus === 'WAIT_CUSTOMER_REFUND' ? 'PENDING_REFUND_ORDER' : 'REFUND_ORDER',
          target: `Order:${id}`,
          details: `Ghi nhận ${statusLabel.toLowerCase()} đơn hàng ${order.orderCode}. Tiền hoàn khách: ${finalRefundAmount}đ. Nguồn phải hoàn: ${expectedSourceRefund}đ. Nguồn thực tế hoàn: ${finalSourceRefundActual}đ. Lý do: ${reason || 'Không ghi chú'}`,
          ipAddress,
        },
      });
    });

    return NextResponse.json({
      success: true,
      amount: finalRefundAmount,
      daysUsed,
      daysRemaining,
      status: finalStatus,
      sourceRefundExpected: expectedSourceRefund,
      sourceRefundActual: finalSourceRefundActual,
    });
  } catch (error: any) {
    console.error('Refund order API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
