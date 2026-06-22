import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { calcExpectedClientRefund, calcExpectedSourceRefund } from '@/lib/financials';

/**
 * Batch Orders API — Per-row error handling
 * 
 * Trả về { success: N, failed: M, errors: [{orderId, orderCode, customerName, reason}] }
 * Mỗi đơn xử lý độc lập — đơn lỗi không ảnh hưởng đơn khác.
 * Mọi thao tác đều dựa trên Order ID (UUID) — không bao giờ dùng index hay vị trí.
 */

interface BatchError {
  orderId: string;
  orderCode: string;
  customerName: string;
  reason: string;
  action: string;
}

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

    const successIds: string[] = [];
    const errors: BatchError[] = [];
    const now = new Date();

    // ==========================================
    // Batch STATUS updates (WARRANTY flow)
    // ==========================================
    const statusActionMap: Record<string, string> = {
      STATUS_WARRANTY: 'WARRANTY',
      STATUS_PENDING_SOURCE: 'WARRANTY_PENDING_SOURCE',
      STATUS_PENDING_REFUND: 'WARRANTY_PENDING_REFUND',
      STATUS_DONE: 'WARRANTY_DONE',
      STATUS_REJECTED: 'WARRANTY_REJECTED',
      STATUS_ACTIVE: 'ACTIVE',
    };

    if (statusActionMap[action]) {
      const newStatus = statusActionMap[action];

      // Fetch all orders by ID (not index)
      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: { customer: { select: { name: true } } },
      });

      for (const order of orders) {
        try {
          await prisma.order.update({
            where: { id: order.id }, // Always use ID
            data: { status: newStatus },
          });
          successIds.push(order.id);
        } catch (err: any) {
          errors.push({
            orderId: order.id,
            orderCode: order.orderCode,
            customerName: order.customer?.name || 'N/A',
            reason: err.message || 'Lỗi cập nhật trạng thái',
            action,
          });
        }
      }

      await prisma.activityLog.create({
        data: {
          userId: dbUser?.id || null,
          action: `BATCH_${action}`,
          details: `Cập nhật ${successIds.length}/${orderIds.length} đơn sang "${newStatus}". Lỗi: ${errors.length}`,
        },
      });

      return NextResponse.json({
        success: successIds.length,
        failed: errors.length,
        total: orderIds.length,
        errors,
      });
    }

    // ==========================================
    // CHANGE_SOURCE
    // ==========================================
    if (action === 'CHANGE_SOURCE') {
      const { supplierSourceId } = payload || {};
      if (!supplierSourceId) {
        return NextResponse.json({ error: 'Thiếu thông tin nguồn hàng mới' }, { status: 400 });
      }

      const source = await prisma.supplierSource.findUnique({ where: { id: supplierSourceId } });
      if (!source) {
        return NextResponse.json({ error: 'Nguồn hàng không tồn tại' }, { status: 404 });
      }

      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: { customer: { select: { name: true } } },
      });

      for (const order of orders) {
        try {
          await prisma.order.update({
            where: { id: order.id },
            data: { supplierSourceId, supplierSourceName: source.name },
          });
          successIds.push(order.id);
        } catch (err: any) {
          errors.push({
            orderId: order.id,
            orderCode: order.orderCode,
            customerName: order.customer?.name || 'N/A',
            reason: err.message || 'Lỗi đổi nguồn',
            action,
          });
        }
      }

      await prisma.activityLog.create({
        data: {
          userId: dbUser?.id || null,
          action: 'BATCH_CHANGE_SOURCE',
          details: `Đổi nguồn sang "${source.name}" cho ${successIds.length}/${orderIds.length} đơn`,
        },
      });

      return NextResponse.json({ success: successIds.length, failed: errors.length, total: orderIds.length, errors });
    }

    // ==========================================
    // RENEW — gia hạn hàng loạt
    // ==========================================
    if (action === 'RENEW') {
      const { daysToExtend, additionalSalePrice, additionalCostPrice, note } = payload || {};
      const parsedDays = parseInt(daysToExtend);
      if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
        return NextResponse.json({ error: 'Thời gian gia hạn phải từ 1 đến 365 ngày' }, { status: 400 });
      }

      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: { customer: { select: { name: true } } },
      });

      for (const order of orders) {
        try {
          const currentEnd = new Date(order.endDate);
          const newEnd = currentEnd > now
            ? new Date(currentEnd.getTime() + parsedDays * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + parsedDays * 24 * 60 * 60 * 1000);

          const addSale = parseFloat(additionalSalePrice || 0);
          const addCost = parseFloat(additionalCostPrice || 0);
          const newSalePrice = order.salePrice + addSale;
          const newCostPrice = order.costPrice + addCost;

          await prisma.order.update({
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
          successIds.push(order.id);
        } catch (err: any) {
          errors.push({
            orderId: order.id,
            orderCode: order.orderCode,
            customerName: order.customer?.name || 'N/A',
            reason: err.message || 'Lỗi gia hạn',
            action,
          });
        }
      }

      await prisma.activityLog.create({
        data: {
          userId: dbUser?.id || null,
          action: 'BATCH_RENEW',
          details: `Gia hạn ${parsedDays} ngày cho ${successIds.length}/${orderIds.length} đơn`,
        },
      });

      return NextResponse.json({ success: successIds.length, failed: errors.length, total: orderIds.length, errors });
    }

    // ==========================================
    // PAYMENT_BATCH — thanh toán hàng loạt
    // ==========================================
    if (action === 'PAYMENT_BATCH') {
      const { method, note: payNote } = payload || {};

      // Fetch all orders — validate customer ownership by ID
      const orders = await prisma.order.findMany({
        where: {
          id: { in: orderIds },
          paymentStatus: { in: ['UNPAID', 'OVERDUE'] },
        },
        include: { customer: { select: { id: true, name: true } } },
      });

      for (const order of orders) {
        try {
          const remaining = order.salePrice - order.paidAmount;
          if (remaining <= 0) {
            errors.push({
              orderId: order.id,
              orderCode: order.orderCode,
              customerName: order.customer?.name || 'N/A',
              reason: 'Đơn đã thanh toán đủ',
              action,
            });
            continue;
          }

          await prisma.$transaction(async (tx: any) => {
            await tx.order.update({
              where: { id: order.id }, // Use ID always
              data: { paymentStatus: 'PAID', paidAmount: order.salePrice, paidAt: now },
            });
            await tx.paymentRecord.create({
              data: {
                customerId: order.customer.id, // Use customer ID not index
                orderId: order.id,
                amount: remaining,
                method: method || 'bank',
                note: payNote || 'Thanh toán hàng loạt',
                paidAt: now,
              },
            });
          });
          successIds.push(order.id);
        } catch (err: any) {
          errors.push({
            orderId: order.id,
            orderCode: order.orderCode,
            customerName: order.customer?.name || 'N/A',
            reason: err.message || 'Lỗi thanh toán',
            action,
          });
        }
      }

      await prisma.activityLog.create({
        data: {
          userId: dbUser?.id || null,
          action: 'BATCH_PAYMENT',
          details: `Thanh toán ${successIds.length}/${orderIds.length} đơn`,
        },
      });

      return NextResponse.json({ success: successIds.length, failed: errors.length, total: orderIds.length, errors });
    }

    // ==========================================
    // CREATE_REFUND_REQUEST — Tạo yêu cầu hoàn tiền hàng loạt
    // ==========================================
    if (action === 'CREATE_REFUND_REQUEST') {
      const { note } = payload || {};

      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: {
          customer: { select: { name: true } }
        },
      });

      for (const order of orders) {
        try {
          if (order.status === 'REFUNDED') {
            throw new Error('Đơn hàng này đã được hoàn tiền trước đó');
          }

          const start = new Date(order.startDate);
          const nowTime = new Date();
          const totalDays = order.durationDays || 30;
          const diffTime = nowTime.getTime() - start.getTime();
          let daysUsed = Math.floor(diffTime / (24 * 60 * 60 * 1000));
          if (daysUsed < 0) daysUsed = 0;
          if (daysUsed > totalDays) daysUsed = totalDays;
          
          const daysRemaining = totalDays - daysUsed;
          const costPerDay = order.salePrice / totalDays;
          const refundAmount = Math.round(daysRemaining * costPerDay);
          const supplierCostPerDay = order.costPrice / totalDays;
          const sourceRefundExpected = Math.round(daysRemaining * supplierCostPerDay);
          const sourceRefundActual = 0; // initially zero since it's just a request

          const netProfit = order.salePrice - order.costPrice - refundAmount + sourceRefundActual;

          await prisma.$transaction(async (tx: any) => {
            // Create refund history record
            await tx.refundHistory.create({
              data: {
                orderId: order.id,
                amount: refundAmount,
                autoRefundAmount: refundAmount,
                daysUsed,
                daysRemaining,
                costPerDay,
                errorDate: nowTime,
                operatorName: session.user.name || 'Hệ thống',
                note: note || 'Yêu cầu hoàn tiền hàng loạt',
                sourceRefundExpected,
                sourceRefundActual,
                sourceStatus: 'PENDING',
                netProfitAfterRefund: netProfit,
              },
            });

            // Update order status and profit
            const noteAppend = note ? `\n[Yêu cầu hoàn tiền]: ${note}` : '';
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: 'WARRANTY_PENDING_SOURCE',
                profit: netProfit,
                note: `${order.note || ''}${noteAppend}`.trim(),
              },
            });
          });

          successIds.push(order.id);
        } catch (err: any) {
          errors.push({
            orderId: order.id,
            orderCode: order.orderCode,
            customerName: order.customer?.name || 'N/A',
            reason: err.message || 'Lỗi tạo yêu cầu hoàn tiền',
            action,
          });
        }
      }

      await prisma.activityLog.create({
        data: {
          userId: dbUser?.id || null,
          action: 'BATCH_CREATE_REFUND_REQUEST',
          details: `Tạo yêu cầu hoàn tiền cho ${successIds.length}/${orderIds.length} đơn`,
        },
      });

      return NextResponse.json({ success: successIds.length, failed: errors.length, total: orderIds.length, errors });
    }

    // ==========================================
    // CONFIRM_SOURCE_REFUND — xác nhận nguồn hoàn
    // ==========================================
    if (action === 'CONFIRM_SOURCE_REFUND') {
      const { sourceRefundActual, sourceStatus: newSourceStatus } = payload || {};

      const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: {
          customer: { select: { name: true } },
          refundHistories: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      for (const order of orders) {
        try {
          const latestRefund = order.refundHistories[0];
          if (!latestRefund) {
            errors.push({
              orderId: order.id,
              orderCode: order.orderCode,
              customerName: order.customer?.name || 'N/A',
              reason: 'Chưa tạo yêu cầu hoàn tiền cho đơn hàng này. Vui lòng tạo yêu cầu hoàn tiền trước.',
              action,
            });
            continue;
          }

          const status = newSourceStatus || 'REFUNDED';
          let actualAmount = 0;
          if (status === 'REFUNDED') {
            actualAmount = sourceRefundActual !== undefined && sourceRefundActual !== ''
              ? parseFloat(sourceRefundActual)
              : latestRefund.sourceRefundExpected;
          } else {
            actualAmount = 0;
          }

          const netProfit = order.salePrice - order.costPrice - latestRefund.amount + actualAmount;

          let targetOrderStatus = 'WARRANTY_PENDING_SOURCE';
          if (status === 'REFUNDED') {
            targetOrderStatus = 'WARRANTY_PENDING_REFUND';
          } else if (status === 'REJECTED') {
            targetOrderStatus = 'WARRANTY_REJECTED';
          } else if (status === 'PENDING') {
            targetOrderStatus = 'WARRANTY_PENDING_SOURCE';
          }

          await prisma.$transaction(async (tx: any) => {
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
          });

          successIds.push(order.id);
        } catch (err: any) {
          errors.push({
            orderId: order.id,
            orderCode: order.orderCode,
            customerName: order.customer?.name || 'N/A',
            reason: err.message || 'Lỗi cập nhật nguồn hoàn',
            action,
          });
        }
      }

      await prisma.activityLog.create({
        data: {
          userId: dbUser?.id || null,
          action: 'BATCH_CONFIRM_SOURCE_REFUND',
          details: `Xác nhận nguồn hoàn cho ${successIds.length}/${orderIds.length} đơn`,
        },
      });

      return NextResponse.json({ success: successIds.length, failed: errors.length, total: orderIds.length, errors });
    }

    return NextResponse.json({ error: 'Hành động không được hỗ trợ' }, { status: 400 });
  } catch (error: any) {
    console.error('Batch orders API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
