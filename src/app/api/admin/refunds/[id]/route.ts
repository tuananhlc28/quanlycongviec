import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PUT(
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
    const { sourceAmount, sourceRefundActual, sourceStatus, note } = body;

    // Find the refund history record
    const refund = await prisma.refundHistory.findUnique({
      where: { id },
      include: { order: true }
    });

    if (!refund) {
      return NextResponse.json({ error: 'Bản ghi hoàn tiền không tồn tại' }, { status: 404 });
    }

    const parsedSourceRefundActual = sourceRefundActual !== undefined 
      ? parseFloat(sourceRefundActual) 
      : sourceAmount !== undefined 
      ? parseFloat(sourceAmount) 
      : refund.sourceRefundActual || refund.sourceAmount || 0;
      
    const finalSourceStatus = sourceStatus !== undefined ? sourceStatus : refund.sourceStatus;
    const finalNote = note !== undefined ? note : refund.note;

    // Calculate net profit after refund
    const initialProfit = refund.order.salePrice - refund.order.costPrice;
    const netProfitAfterRefund = initialProfit - refund.amount + parsedSourceRefundActual;

    // Update refund and related order profit in transaction
    await prisma.$transaction(async (tx: any) => {
      await tx.refundHistory.update({
        where: { id },
        data: {
          sourceAmount: parsedSourceRefundActual,
          sourceRefundActual: parsedSourceRefundActual,
          sourceStatus: finalSourceStatus,
          note: finalNote,
          netProfitAfterRefund,
        }
      });

      // Update the parent order's profit to match the new net profit
      await tx.order.update({
        where: { id: refund.orderId },
        data: {
          profit: netProfitAfterRefund,
        }
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_REFUND',
          target: `Order:${refund.orderId}`,
          details: `Cập nhật thông tin nguồn hoàn tiền cho đơn ${refund.order.orderCode}. Nguồn thực tế hoàn: ${parsedSourceRefundActual}đ. Trạng thái nguồn: ${finalSourceStatus}`,
        }
      });
    });

    return NextResponse.json({
      success: true,
      sourceAmount: parsedSourceRefundActual,
      sourceRefundActual: parsedSourceRefundActual,
      sourceStatus: finalSourceStatus,
      netProfitAfterRefund,
    });
  } catch (error: any) {
    console.error('Update refund API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
