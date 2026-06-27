import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = await request.json();
    const { orderIds, action, payload } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Không có đơn hàng nào được chọn' }, { status: 400 });
    }
    if (!action) {
      return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
    }

    const dbUser = await prisma.user.findFirst({
      where: { OR: [{ id: session.user.id }, { email: session.user.email || '' }] },
    });
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const now = new Date();

    const statusActionMap: Record<string, string> = {
      STATUS_WARRANTY: 'REPORTED',
      STATUS_PENDING_SOURCE: 'WAIT_SOURCE',
      STATUS_PENDING_REFUND: 'WAIT_CUSTOMER_REFUND',
      STATUS_DONE: 'COMPLETED',
      STATUS_REJECTED: 'SOURCE_REJECTED',
      STATUS_ACTIVE: 'ACTIVE',
    };

    // Execute everything in a single transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Status Change Action
      if (statusActionMap[action]) {
        const newStatus = statusActionMap[action];
        const orders = await tx.order.findMany({
          where: { id: { in: orderIds } },
        });

        if (orders.length !== orderIds.length) {
          throw new Error('Một số đơn hàng được chọn không tồn tại.');
        }

        for (const order of orders) {
          const isLocked = ['COMPLETED', 'SOURCE_REJECTED'].includes(order.status) && !order.isUnlocked;
          if (isLocked) {
            throw new Error(`Đơn hàng ${order.orderCode} đã hoàn tất hoặc bị từ chối và đang bị khóa. Vui lòng mở khóa trước.`);
          }

          await tx.order.update({
            where: { id: order.id },
            data: { status: newStatus },
          });

          await tx.activityLog.create({
            data: {
              userId: dbUser?.id || null,
              action: 'UPDATE_ORDER_STATUS',
              target: `Order:${order.id}`,
              details: `Thay đổi trạng thái hàng loạt sang "${newStatus}"`,
              ipAddress,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: dbUser?.id || null,
            action: `BATCH_${action}`,
            details: `Cập nhật trạng thái hàng loạt ${orderIds.length} đơn sang "${newStatus}"`,
            ipAddress,
          },
        });

        return { success: orderIds.length };
      }

      // 2. Change Source Action
      if (action === 'CHANGE_SOURCE') {
        const { supplierSourceId } = payload || {};
        if (!supplierSourceId) {
          throw new Error('Thiếu thông tin nguồn hàng mới');
        }

        const source = await tx.supplierSource.findUnique({ where: { id: supplierSourceId } });
        if (!source) {
          throw new Error('Nguồn hàng mới không tồn tại');
        }

        const orders = await tx.order.findMany({
          where: { id: { in: orderIds } },
        });

        if (orders.length !== orderIds.length) {
          throw new Error('Một số đơn hàng được chọn không tồn tại.');
        }

        for (const order of orders) {
          const isLocked = ['COMPLETED', 'SOURCE_REJECTED'].includes(order.status) && !order.isUnlocked;
          if (isLocked) {
            throw new Error(`Đơn hàng ${order.orderCode} đã hoàn tất hoặc bị từ chối và đang bị khóa. Vui lòng mở khóa trước.`);
          }

          await tx.order.update({
            where: { id: order.id },
            data: { supplierSourceId, supplierSourceName: source.name },
          });

          await tx.activityLog.create({
            data: {
              userId: dbUser?.id || null,
              action: 'UPDATE_ORDER_SOURCE',
              target: `Order:${order.id}`,
              details: `Thay đổi nguồn hàng hàng loạt sang "${source.name}"`,
              ipAddress,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: dbUser?.id || null,
            action: 'BATCH_CHANGE_SOURCE',
            details: `Đổi nguồn sang "${source.name}" cho ${orderIds.length} đơn`,
            ipAddress,
          },
        });

        return { success: orderIds.length };
      }

      // 3. Renew Action
      if (action === 'RENEW') {
        const { daysToExtend, additionalSalePrice, additionalCostPrice, note } = payload || {};
        const parsedDays = parseInt(daysToExtend);
        if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
          throw new Error('Thời gian gia hạn phải từ 1 đến 365 ngày');
        }

        const addSale = parseFloat(additionalSalePrice || 0);
        const addCost = parseFloat(additionalCostPrice || 0);
        if ((addSale !== 0 || addCost !== 0) && session.user.role !== 'ADMIN') {
          throw new Error('Chỉ có Admin mới có quyền thay đổi giá bán, giá vốn đơn hàng');
        }

        const orders = await tx.order.findMany({
          where: { id: { in: orderIds } },
        });

        if (orders.length !== orderIds.length) {
          throw new Error('Một số đơn hàng được chọn không tồn tại.');
        }

        for (const order of orders) {
          const isLocked = ['COMPLETED', 'SOURCE_REJECTED'].includes(order.status) && !order.isUnlocked;
          if (isLocked) {
            throw new Error(`Đơn hàng ${order.orderCode} đã hoàn tất hoặc bị từ chối và đang bị khóa. Vui lòng mở khóa trước.`);
          }

          const currentEnd = new Date(order.endDate);
          const newEnd = currentEnd > now
            ? new Date(currentEnd.getTime() + parsedDays * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + parsedDays * 24 * 60 * 60 * 1000);

          const newSalePrice = order.salePrice + addSale;
          const newCostPrice = order.costPrice + addCost;

          await tx.order.update({
            where: { id: order.id },
            data: {
              endDate: newEnd,
              salePrice: newSalePrice,
              costPrice: newCostPrice,
              profit: newSalePrice - newCostPrice,
              status: 'ACTIVE',
              durationDays: order.durationDays + parsedDays,
              note: note ? `${order.note || ''}\n[Gia hạn ${parsedDays} ngày]: ${note}`.trim() : order.note,
            },
          });

          await tx.activityLog.create({
            data: {
              userId: dbUser?.id || null,
              action: 'RENEW_ORDER',
              target: `Order:${order.id}`,
              details: `Gia hạn ${parsedDays} ngày. Giá bán mới: ${newSalePrice}, Giá vốn mới: ${newCostPrice}`,
              ipAddress,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: dbUser?.id || null,
            action: 'BATCH_RENEW',
            details: `Gia hạn hàng loạt ${parsedDays} ngày cho ${orderIds.length} đơn`,
            ipAddress,
          },
        });

        return { success: orderIds.length };
      }

      // 4. Payment Batch Action
      if (action === 'PAYMENT_BATCH') {
        const { method, note: payNote } = payload || {};

        const orders = await tx.order.findMany({
          where: {
            id: { in: orderIds },
            paymentStatus: { in: ['UNPAID', 'OVERDUE'] },
          },
          include: { customer: { select: { id: true, name: true } } },
        });

        if (orders.length !== orderIds.length) {
          throw new Error('Một số đơn hàng được chọn không tồn tại hoặc đã được thanh toán trước đó.');
        }

        for (const order of orders) {
          const remaining = order.salePrice - order.paidAmount;
          if (remaining <= 0) {
            throw new Error(`Đơn hàng ${order.orderCode} đã được thanh toán đủ.`);
          }

          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'PAID', paidAmount: order.salePrice, paidAt: now },
          });

          await tx.paymentRecord.create({
            data: {
              customerId: order.customer.id,
              orderId: order.id,
              amount: remaining,
              method: method || 'bank',
              note: payNote || 'Thanh toán hàng loạt',
              paidAt: now,
            },
          });

          await tx.activityLog.create({
            data: {
              userId: dbUser?.id || null,
              action: 'PAY_ORDER',
              target: `Order:${order.id}`,
              details: `Thanh toán số tiền còn thiếu ${remaining}đ bằng ${method || 'bank'}`,
              ipAddress,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: dbUser?.id || null,
            action: 'BATCH_PAYMENT',
            details: `Thanh toán hàng loạt cho ${orderIds.length} đơn`,
            ipAddress,
          },
        });

        return { success: orderIds.length };
      }

      // 5. Confirm Source Refund Action
      if (action === 'CONFIRM_SOURCE_REFUND') {
        const { sourceRefundActual, sourceStatus: newSourceStatus } = payload || {};

        const orders = await tx.order.findMany({
          where: { id: { in: orderIds } },
          include: {
            refundHistories: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        });

        if (orders.length !== orderIds.length) {
          throw new Error('Một số đơn hàng được chọn không tồn tại.');
        }

        for (const order of orders) {
          const latestRefund = order.refundHistories[0];
          if (!latestRefund) {
            throw new Error(`Đơn hàng ${order.orderCode} chưa có yêu cầu bảo hành/hoàn tiền.`);
          }

          const status = newSourceStatus || 'REFUNDED';
          let actualAmount = 0;
          if (status === 'REFUNDED') {
            actualAmount = sourceRefundActual !== undefined && sourceRefundActual !== ''
              ? parseFloat(sourceRefundActual)
              : latestRefund.sourceRefundExpected;
          }

          const netProfit = order.salePrice - order.costPrice - latestRefund.amount + actualAmount;

          let targetOrderStatus = 'WAIT_SOURCE';
          if (status === 'REFUNDED') {
            targetOrderStatus = 'WAIT_CUSTOMER_REFUND';
          } else if (status === 'REJECTED') {
            targetOrderStatus = 'SOURCE_REJECTED';
          }

          await tx.refundHistory.update({
            where: { id: latestRefund.id },
            data: {
              sourceRefundActual: actualAmount,
              sourceStatus: status,
              netProfitAfterRefund: netProfit,
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: targetOrderStatus,
              profit: netProfit,
            },
          });

          await tx.activityLog.create({
            data: {
              userId: dbUser?.id || null,
              action: 'CONFIRM_SOURCE_REFUND',
              target: `Order:${order.id}`,
              details: `Xác nhận nguồn hoàn: ${status}. Số tiền: ${actualAmount}đ. Trạng thái đơn mới: ${targetOrderStatus}`,
              ipAddress,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: dbUser?.id || null,
            action: 'BATCH_CONFIRM_SOURCE_REFUND',
            details: `Xác nhận nguồn hoàn hàng loạt cho ${orderIds.length} đơn`,
            ipAddress,
          },
        });

        return { success: orderIds.length };
      }

      // 6. Bulk Refund Action (BATCH_REFUND)
      if (action === 'BATCH_REFUND') {
        if (session.user.role !== 'ADMIN') {
          throw new Error('Chỉ có Admin mới có quyền thực hiện hoàn tiền hàng loạt');
        }
        const { errorDate, reason } = payload || {};
        const faultDate = errorDate ? new Date(errorDate) : new Date();
        const operatorName = dbUser?.name || 'Hệ thống';

        const orders = await tx.order.findMany({
          where: { id: { in: orderIds } },
        });

        if (orders.length !== orderIds.length) {
          throw new Error('Một số đơn hàng được chọn không tồn tại.');
        }

        for (const order of orders) {
          if (order.status === 'COMPLETED') {
            throw new Error(`Đơn hàng ${order.orderCode} đã hoàn tất bảo hành/hoàn tiền trước đó.`);
          }

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
          
          const profitAfterRefund = order.salePrice - order.costPrice - refundAmount + sourceRefundExpected;

          await tx.refundHistory.create({
            data: {
              orderId: order.id,
              amount: refundAmount,
              autoRefundAmount: refundAmount,
              daysUsed,
              daysRemaining,
              costPerDay,
              errorDate: faultDate,
              operatorName,
              note: reason || 'Hoàn tiền hàng loạt',
              sourceAmount: sourceRefundExpected,
              sourceRefundExpected,
              sourceRefundActual: sourceRefundExpected,
              sourceStatus: 'REFUNDED',
              netProfitAfterRefund: profitAfterRefund,
            },
          });

          const noteAppend = reason ? `\n[Hoàn tiền hàng loạt]: ${reason}` : '';
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              profit: profitAfterRefund,
              note: `${order.note || ''}${noteAppend}`.trim(),
            },
          });

          await tx.activityLog.create({
            data: {
              userId: dbUser?.id || null,
              action: 'REFUND_ORDER',
              target: `Order:${order.id}`,
              details: `Hoàn khách: ${refundAmount}đ, Nguồn hoàn: ${sourceRefundExpected}đ. Trạng thái: COMPLETED`,
              ipAddress,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: dbUser?.id || null,
            action: 'BATCH_REFUND',
            details: `Hoàn tiền hàng loạt thành công cho ${orderIds.length} đơn`,
            ipAddress,
          },
        });

        return { success: orderIds.length };
      }

      throw new Error('Hành động không được hỗ trợ');
    });

    return NextResponse.json({ success: result.success, failed: 0, total: orderIds.length });
  } catch (error: any) {
    console.error('Batch orders transaction error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi khi thực hiện thao tác hàng loạt' }, { status: 400 });
  }
}
