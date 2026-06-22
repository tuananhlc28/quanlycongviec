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
    const { errorDate, reason, overrideAmount, targetStatus, sourceAmount, sourceStatus } = body;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    // Determine status: default to REFUNDED
    const finalStatus = targetStatus === 'PENDING_REFUND' ? 'PENDING_REFUND' : 'REFUNDED';

    if (order.status === 'REFUNDED') {
      return NextResponse.json({ error: 'Đơn hàng này đã được hoàn tiền trước đó' }, { status: 400 });
    }

    // Special case: Transitioning PENDING_REFUND -> REFUNDED
    if (order.status === 'PENDING_REFUND' && finalStatus === 'REFUNDED') {
      await prisma.$transaction(async (tx: any) => {
        await tx.order.update({
          where: { id },
          data: {
            status: 'REFUNDED',
            note: reason ? `${order.note || ''}\n[Đã chuyển tiền hoàn]: ${reason}`.trim() : order.note,
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
            details: `Đã hoàn tất thanh toán tiền hoàn trả. Trạng thái chuyển thành Đã hoàn tiền.`,
          },
        });
      });

      return NextResponse.json({
        success: true,
        status: 'REFUNDED',
      });
    }

    // Normal case: original refund calculation (Transitions ACTIVE/WARRANTY -> PENDING_REFUND or REFUNDED)
    const { overrideSourceRefundActual } = body;
    const finalSourceStatus = sourceStatus || 'NOT_REQUESTED';

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
    const sourceRefundExpected = parseFloat((daysRemaining * supplierCostPerDay).toFixed(0));
    
    const finalSourceRefundActual = overrideSourceRefundActual !== undefined && overrideSourceRefundActual !== ''
      ? parseFloat(overrideSourceRefundActual)
      : sourceAmount !== undefined && sourceAmount !== ''
      ? parseFloat(sourceAmount)
      : sourceRefundExpected;

    // Actual profit = salePrice - costPrice - finalRefundAmount + finalSourceRefundActual
    const newProfit = (order.salePrice - order.costPrice) - finalRefundAmount + finalSourceRefundActual;

    const statusLabel = finalStatus === 'PENDING_REFUND' ? 'Chờ hoàn tiền' : 'Đã hoàn tiền';

    await prisma.$transaction(async (tx: any) => {
      // Update order status and profit
      await tx.order.update({
        where: { id },
        data: {
          status: finalStatus,
          profit: newProfit,
          note: reason ? `${order.note || ''}\n[${statusLabel} ${finalRefundAmount}đ]: ${reason}`.trim() : order.note,
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
          sourceRefundExpected,
          sourceRefundActual: finalSourceRefundActual,
          sourceStatus: finalSourceStatus,
          netProfitAfterRefund: newProfit,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: finalStatus === 'PENDING_REFUND' ? 'PENDING_REFUND_ORDER' : 'REFUND_ORDER',
          target: `Order:${id}`,
          details: `Ghi nhận ${statusLabel.toLowerCase()} đơn hàng ${order.orderCode}. Tiền hoàn khách: ${finalRefundAmount}đ. Nguồn phải hoàn: ${sourceRefundExpected}đ. Nguồn thực tế hoàn: ${finalSourceRefundActual}đ. Lý do: ${reason || 'Không ghi chú'}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      amount: finalRefundAmount,
      daysUsed,
      daysRemaining,
      status: finalStatus,
      sourceRefundExpected,
      sourceRefundActual: finalSourceRefundActual,
    });
  } catch (error: any) {
    console.error('Refund order API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
