import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PATCH: Update warranty status flow (#35)
// WARRANTY → WARRANTY_PENDING_SOURCE → WARRANTY_PENDING_REFUND → WARRANTY_DONE
// or WARRANTY → WARRANTY_PENDING_SOURCE → WARRANTY_REJECTED
export async function PATCH(
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
    const { status, amount, sourceRefundActual, note } = body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { refundHistories: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    const isEditingOnly = status === order.status;

    if (!isEditingOnly) {
      const validStatuses = [
        'WARRANTY_PENDING_SOURCE',
        'WARRANTY_PENDING_REFUND',
        'WARRANTY_DONE',
        'WARRANTY_REJECTED',
      ];

      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Trạng thái bảo hành không hợp lệ' }, { status: 400 });
      }

      // Validate transitions
      const allowedTransitions: Record<string, string[]> = {
        'WARRANTY': ['WARRANTY_PENDING_SOURCE'],
        'WARRANTY_PENDING_SOURCE': ['WARRANTY_PENDING_REFUND', 'WARRANTY_REJECTED'],
        'WARRANTY_PENDING_REFUND': ['WARRANTY_DONE'],
      };

      const allowed = allowedTransitions[order.status];
      if (!allowed || !allowed.includes(status)) {
        return NextResponse.json({
          error: `Không thể chuyển từ "${order.status}" sang "${status}"`,
        }, { status: 400 });
      }
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

    const statusLabels: Record<string, string> = {
      WARRANTY: 'Khách báo lỗi',
      WARRANTY_PENDING_SOURCE: 'Chờ nguồn hoàn tiền',
      WARRANTY_PENDING_REFUND: 'Chờ hoàn khách',
      WARRANTY_DONE: 'Hoàn tất bảo hành',
      WARRANTY_REJECTED: 'Nguồn từ chối bảo hành',
    };

    await prisma.$transaction(async (tx: any) => {
      // Update order status if not just editing
      if (!isEditingOnly) {
        const noteAppend = note ? `\n[${statusLabels[status]}]: ${note}` : `\n[${statusLabels[status]}]`;
        await tx.order.update({
          where: { id },
          data: {
            status,
            note: `${order.note || ''}${noteAppend}`.trim(),
          },
        });
      } else if (note) {
        // Just append note if editing
        await tx.order.update({
          where: { id },
          data: {
            note: `${order.note || ''}\n[Cập nhật tài chính]: ${note}`.trim(),
          },
        });
      }

      // Update refund history
      const latestRefund = order.refundHistories
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      if (latestRefund) {
        const updateData: any = {};
        let finalAmount = latestRefund.amount;
        if (amount !== undefined && amount !== null && amount !== '') {
          finalAmount = parseFloat(amount);
        } else if (!latestRefund.amount || latestRefund.amount === 0) {
          finalAmount = latestRefund.autoRefundAmount;
        }
        updateData.amount = finalAmount;

        let finalSourceRefund = latestRefund.sourceRefundActual;
        if (sourceRefundActual !== undefined && sourceRefundActual !== null && sourceRefundActual !== '') {
          finalSourceRefund = parseFloat(sourceRefundActual);
        } else if (!latestRefund.sourceRefundActual || latestRefund.sourceRefundActual === 0) {
          finalSourceRefund = latestRefund.sourceRefundExpected;
        }

        if (status === 'WARRANTY_PENDING_REFUND') {
          updateData.sourceStatus = 'REFUNDED';
          if (!finalSourceRefund || finalSourceRefund === 0) {
            finalSourceRefund = latestRefund.sourceRefundExpected;
          }
        }
        if (status === 'WARRANTY_REJECTED') {
          updateData.sourceStatus = 'REJECTED';
          finalSourceRefund = 0;
        }

        updateData.sourceRefundActual = finalSourceRefund;

        // Save
        const updatedRefund = await tx.refundHistory.update({
          where: { id: latestRefund.id },
          data: updateData,
        });

        // Recalculate profit if transitioning to DONE, REJECTED, or if just editing
        if (status === 'WARRANTY_DONE' || status === 'WARRANTY_REJECTED' || isEditingOnly) {
          const finalRefundAmount = updatedRefund.amount;
          const finalSourceRefundActual = updatedRefund.sourceRefundActual;
          const netProfit = order.salePrice - order.costPrice - finalRefundAmount + finalSourceRefundActual;
          
          await tx.refundHistory.update({
            where: { id: latestRefund.id },
            data: { netProfitAfterRefund: netProfit },
          });
          await tx.order.update({
            where: { id },
            data: { profit: netProfit },
          });
        }
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: logUserId,
          action: isEditingOnly ? `WARRANTY_FINANCIAL_UPDATE` : `WARRANTY_STATUS_${status}`,
          target: `Order:${id}`,
          details: isEditingOnly 
            ? `Cập nhật số tiền bảo hành. Hoàn khách: ${amount}đ, Nguồn hoàn: ${sourceRefundActual}đ.${note ? ' Ghi chú: ' + note : ''}`
            : `Chuyển trạng thái bảo hành sang: ${statusLabels[status]}.${note ? ' Ghi chú: ' + note : ''}`,
        },
      });
    });

    return NextResponse.json({ success: true, status: isEditingOnly ? order.status : status });
  } catch (error: any) {
    console.error('Warranty status API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
