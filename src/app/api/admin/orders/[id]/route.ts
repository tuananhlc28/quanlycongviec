import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        service: true,
        supplierSource: true,
        refundHistories: {
          orderBy: { createdAt: 'desc' }
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    // Fetch activity logs for this order
    const logs = await prisma.activityLog.findMany({
      where: {
        target: `Order:${id}`,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ...order,
      activityLogs: logs,
    });
  } catch (error: any) {
    console.error('Fetch order detail API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}

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
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const body = await request.json();
    const {
      accountEmail,
      accountPassword,
      recoveryCode,
      loginLink,
      accountNote,
      note,
      salePrice,
      costPrice,
      startDate,
      endDate,
      status,
      packageName,
      durationDays,
      supplierSourceId,
      paymentStatus,
      paymentMethod,
      paymentNote,
      paymentDueDate,
      paidAt,
      saveHistory,
      notifyCustomer,
    } = body;

    if (durationDays !== undefined) {
      const parsedDays = parseInt(durationDays);
      if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
        return NextResponse.json({ error: 'Thời hạn dịch vụ phải từ 1 đến 365 ngày' }, { status: 400 });
      }
    }

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    // Check lock status
    const isLocked = ['COMPLETED', 'SOURCE_REJECTED'].includes(order.status) && !order.isUnlocked;
    if (isLocked) {
      return NextResponse.json({
        error: 'Đơn hàng đã hoàn tất hoặc bị từ chối và đang bị khóa. Vui lòng mở khóa đơn trước khi sửa.'
      }, { status: 400 });
    }

    // 1. Get new supplier source name if changed
    let supplierSourceName = order.supplierSourceName;
    if (supplierSourceId !== undefined && supplierSourceId !== order.supplierSourceId) {
      if (supplierSourceId) {
        const source = await prisma.supplierSource.findUnique({
          where: { id: supplierSourceId },
        });
        supplierSourceName = source ? source.name : null;
      } else {
        supplierSourceName = null;
      }
    }

    // 2. Recalculate financials and check for changes
    const parsedSale = salePrice !== undefined ? parseFloat(salePrice) : order.salePrice;
    const parsedCost = costPrice !== undefined ? parseFloat(costPrice) : order.costPrice;
    const profit = parsedSale - parsedCost;

    const changeLogs: { fieldName: string; oldValue: number; newValue: number }[] = [];
    if (parsedSale !== order.salePrice) {
      changeLogs.push({ fieldName: 'salePrice', oldValue: order.salePrice, newValue: parsedSale });
    }
    if (parsedCost !== order.costPrice) {
      changeLogs.push({ fieldName: 'costPrice', oldValue: order.costPrice, newValue: parsedCost });
    }

    if (changeLogs.length > 0 && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Chỉ có Admin mới có quyền thay đổi giá bán, giá vốn đơn hàng' }, { status: 403 });
    }

    const { priceChangeReason } = body;

    // 3. Update order in transaction with log records
    const updated = await prisma.$transaction(async (tx: any) => {
      const updateData: any = {
        accountEmail: accountEmail !== undefined ? accountEmail : undefined,
        accountPassword: accountPassword !== undefined ? accountPassword : undefined,
        recoveryCode: recoveryCode !== undefined ? recoveryCode : undefined,
        loginLink: loginLink !== undefined ? loginLink : undefined,
        accountNote: accountNote !== undefined ? accountNote : undefined,
        note: note !== undefined ? note : undefined,
        salePrice: parsedSale,
        costPrice: parsedCost,
        profit,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status: status !== undefined ? status : undefined,
        packageName: packageName !== undefined ? packageName : undefined,
        durationDays: durationDays !== undefined ? parseInt(durationDays) : undefined,
        supplierSourceId: supplierSourceId !== undefined ? supplierSourceId : undefined,
        supplierSourceName,
        isUnlocked: false,
      };

      if (paymentDueDate !== undefined) {
        updateData.paymentDueDate = paymentDueDate ? new Date(paymentDueDate) : null;
      }

      const dbUser = await tx.user.findFirst({
        where: {
          OR: [
            { id: session.user.id },
            { email: session.user.email || undefined }
          ]
        }
      });
      const logUserId = dbUser ? dbUser.id : null;
      const operatorName = dbUser ? dbUser.name : (session.user.name || 'Admin');

      if (paymentStatus !== undefined && paymentStatus !== order.paymentStatus) {
        updateData.paymentStatus = paymentStatus;
        if (paymentStatus === 'PAID') {
          const finalPaidAt = paidAt ? new Date(paidAt) : new Date();
          updateData.paidAmount = parsedSale;
          updateData.paidAt = finalPaidAt;

          // Create payment record
          await tx.paymentRecord.create({
            data: {
              customerId: order.customerId,
              orderId: id,
              amount: parsedSale,
              method: paymentMethod || 'bank',
              note: paymentNote || `Xác nhận thanh toán bởi ${operatorName}`,
              paidAt: finalPaidAt,
            },
          });
        } else {
          updateData.paidAmount = 0;
          updateData.paidAt = null;

          // Remove payment records associated with this order
          await tx.paymentRecord.deleteMany({
            where: { orderId: id },
          });
        }
      }

      const ord = await tx.order.update({
        where: { id },
        data: updateData,
      });

      for (const log of changeLogs) {
        await tx.financialChangeLog.create({
          data: {
            orderId: id,
            fieldName: log.fieldName,
            oldValue: log.oldValue,
            newValue: log.newValue,
            changedBy: operatorName,
            reason: priceChangeReason || 'Cập nhật giá trị tài chính thủ công',
          },
        });
      }

      // 4. Log Action
      if (saveHistory !== false) {
        const generalChangeDetails: string[] = [];
        if (accountEmail !== undefined && accountEmail !== order.accountEmail) {
          generalChangeDetails.push(`Email: "${order.accountEmail || 'N/A'}" -> "${accountEmail || 'N/A'}"`);
        }
        if (accountPassword !== undefined && accountPassword !== order.accountPassword) {
          generalChangeDetails.push(`Mật khẩu thay đổi`);
        }
        if (status !== undefined && status !== order.status) {
          generalChangeDetails.push(`Trạng thái: "${order.status}" -> "${status}"`);
        }
        if (packageName !== undefined && packageName !== order.packageName) {
          generalChangeDetails.push(`Gói: "${order.packageName}" -> "${packageName}"`);
        }
        if (durationDays !== undefined && parseInt(durationDays) !== order.durationDays) {
          generalChangeDetails.push(`Thời hạn: ${order.durationDays} ngày -> ${durationDays} ngày`);
        }
        if (supplierSourceId !== undefined && supplierSourceId !== order.supplierSourceId) {
          generalChangeDetails.push(`Nguồn: "${order.supplierSourceName || 'Trực tiếp'}" -> "${supplierSourceName || 'Trực tiếp'}"`);
        }
        if (paymentStatus !== undefined && paymentStatus !== order.paymentStatus) {
          generalChangeDetails.push(`Thanh toán: "${order.paymentStatus}" -> "${paymentStatus}"`);
        }

        let details = `Cập nhật đơn hàng ${order.orderCode}.`;
        if (generalChangeDetails.length > 0) {
          details += ` Chi tiết: ${generalChangeDetails.join(', ')}.`;
        }
        if (changeLogs.length > 0) {
          details += ' Có thay đổi giá trị tài chính.';
        }
        if (notifyCustomer) {
          details += ' Đã gửi thông báo cho khách hàng.';
        }
        await tx.activityLog.create({
          data: {
            userId: logUserId,
            action: 'UPDATE_ORDER',
            target: `Order:${id}`,
            details,
            ipAddress,
          },
        });
      }

      return ord;
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update order API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    await prisma.$transaction(async (tx: any) => {
      // 1. Delete order (Cascade deletes RefundHistory entries)
      await tx.order.delete({
        where: { id },
      });

      // 2. Create activity log
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'DELETE_ORDER',
          target: `Order:${id}`,
          details: `Đã xóa đơn hàng ${order.orderCode} (Khách hàng: ${order.customerId})`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete order API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
