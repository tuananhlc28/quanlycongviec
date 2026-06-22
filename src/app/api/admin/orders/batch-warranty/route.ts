import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST: Batch warranty operations (#44)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = await request.json();
    const { orderIds, action, note, sourceId } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Vui lòng chọn ít nhất một đơn hàng' }, { status: 400 });
    }

    const validActions = [
      'report_error',        // Báo lỗi
      'pending_source',      // Chờ nguồn hoàn tiền
      'pending_refund',      // Chờ hoàn khách
      'done',                // Hoàn tất
      'rejected',            // Từ chối
      'change_source',       // Đổi nguồn
    ];

    if (!validActions.includes(action)) {
      return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
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

    const statusMap: Record<string, string> = {
      'report_error': 'WARRANTY',
      'pending_source': 'WARRANTY_PENDING_SOURCE',
      'pending_refund': 'WARRANTY_PENDING_REFUND',
      'done': 'WARRANTY_DONE',
      'rejected': 'WARRANTY_REJECTED',
    };

    const actionLabels: Record<string, string> = {
      'report_error': 'Báo lỗi',
      'pending_source': 'Chờ nguồn hoàn',
      'pending_refund': 'Chờ hoàn khách',
      'done': 'Hoàn tất BH',
      'rejected': 'Từ chối BH',
      'change_source': 'Đổi nguồn',
    };

    const successIds: string[] = [];
    const errors: { orderId: string; orderCode: string; customerName: string; reason: string; action: string }[] = [];

    for (const orderId of orderIds) {
      let currentOrderCode = 'N/A';
      let currentCustomerName = 'N/A';

      try {
        await prisma.$transaction(async (tx: any) => {
          const order = await tx.order.findUnique({
            where: { id: orderId },
            include: { customer: { select: { name: true } }, refundHistories: true },
          });

          if (!order) {
            throw new Error('Đơn hàng không tồn tại');
          }

          currentOrderCode = order.orderCode;
          currentCustomerName = order.customer?.name || 'N/A';

          if (action === 'change_source' && sourceId) {
            const source = await tx.supplierSource.findUnique({ where: { id: sourceId } });
            if (!source) {
              throw new Error('Nguồn hàng mới không tồn tại');
            }
            await tx.order.update({
              where: { id: orderId },
              data: {
                supplierSourceId: sourceId,
                supplierSourceName: source.name,
              },
            });
          } else if (statusMap[action]) {
            const noteAppend = note ? `\n[Batch ${actionLabels[action]}]: ${note}` : '';

            // Check refund history requirement for status updates
            const isStatusUpdate = ['pending_source', 'pending_refund', 'done', 'rejected'].includes(action);
            const latestRefund = order.refundHistories
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

            if (isStatusUpdate && !latestRefund) {
              throw new Error('Chưa tạo yêu cầu hoàn tiền cho đơn hàng này. Vui lòng tạo yêu cầu hoàn tiền trước.');
            }

            await tx.order.update({
              where: { id: orderId },
              data: {
                status: statusMap[action],
                note: `${order.note || ''}${noteAppend}`.trim(),
              },
            });

            // For report_error, also create a refund history record with auto-calculated amounts
            if (action === 'report_error') {
              const start = new Date(order.startDate);
              const now = new Date();
              const totalDays = order.durationDays || 30;
              const diffTime = now.getTime() - start.getTime();
              let daysUsed = Math.floor(diffTime / (24 * 60 * 60 * 1000));
              if (daysUsed < 0) daysUsed = 0;
              if (daysUsed > totalDays) daysUsed = totalDays;
              const daysRemaining = totalDays - daysUsed;
              const costPerDay = order.salePrice / totalDays;
              const refundAmount = Math.round(daysRemaining * costPerDay);
              const supplierCostPerDay = order.costPrice / totalDays;
              const sourceRefundExpected = Math.round(daysRemaining * supplierCostPerDay);

              await tx.refundHistory.create({
                data: {
                  orderId,
                  amount: refundAmount,
                  autoRefundAmount: refundAmount,
                  daysUsed,
                  daysRemaining,
                  costPerDay,
                  errorDate: now,
                  operatorName: session.user.name || 'Hệ thống',
                  note: note || 'Báo lỗi hàng loạt',
                  sourceRefundExpected,
                  sourceRefundActual: sourceRefundExpected,
                  sourceStatus: 'PENDING',
                  netProfitAfterRefund: order.salePrice - order.costPrice - refundAmount + sourceRefundExpected,
                },
              });
            }

            if (latestRefund) {
              if (action === 'pending_refund') {
                const finalSourceRefund = latestRefund.sourceRefundActual || latestRefund.sourceRefundExpected;
                await tx.refundHistory.update({
                  where: { id: latestRefund.id },
                  data: {
                    sourceStatus: 'REFUNDED',
                    sourceRefundActual: finalSourceRefund,
                  },
                });
              } else if (action === 'done') {
                const finalAmount = latestRefund.amount || latestRefund.autoRefundAmount;
                const finalSourceRefund = latestRefund.sourceRefundActual || latestRefund.sourceRefundExpected;
                const netProfit = order.salePrice - order.costPrice - finalAmount + finalSourceRefund;

                await tx.refundHistory.update({
                  where: { id: latestRefund.id },
                  data: {
                    amount: finalAmount,
                    sourceRefundActual: finalSourceRefund,
                    netProfitAfterRefund: netProfit,
                  },
                });

                await tx.order.update({
                  where: { id: orderId },
                  data: { profit: netProfit },
                });
              } else if (action === 'rejected') {
                const finalAmount = latestRefund.amount || latestRefund.autoRefundAmount;
                const netProfit = order.salePrice - order.costPrice - finalAmount;

                await tx.refundHistory.update({
                  where: { id: latestRefund.id },
                  data: {
                    sourceStatus: 'REJECTED',
                    sourceRefundActual: 0,
                    amount: finalAmount,
                    netProfitAfterRefund: netProfit,
                  },
                });

                await tx.order.update({
                  where: { id: orderId },
                  data: { profit: netProfit },
                });
              }
            }
          }

          await tx.activityLog.create({
            data: {
              userId: logUserId,
              action: `BATCH_${action.toUpperCase()}`,
              target: `Order:${orderId}`,
              details: `Thao tác hàng loạt: ${actionLabels[action]}.${note ? ' Ghi chú: ' + note : ''}`,
            },
          });
        });
        successIds.push(orderId);
      } catch (err: any) {
        errors.push({
          orderId,
          orderCode: currentOrderCode,
          customerName: currentCustomerName,
          reason: err.message || 'Lỗi không xác định',
          action,
        });
      }
    }

    return NextResponse.json({
      success: successIds.length,
      failed: errors.length,
      total: orderIds.length,
      errors,
    });
  } catch (error: any) {
    console.error('Batch warranty API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
