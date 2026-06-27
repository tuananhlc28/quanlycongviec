import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const revalidate = 0; // Disable caching

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const now = new Date();

    // Find all active/expiring soon orders that have reached their end date
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'EXPIRING'],
        },
        endDate: {
          lte: now,
        },
      },
      select: {
        id: true,
        orderCode: true,
        customerId: true,
      },
    });

    if (expiredOrders.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
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
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';

    // Update orders status to EXPIRED in a transaction
    await prisma.$transaction(async (tx: any) => {
      // Batch update statuses
      await tx.order.updateMany({
        where: {
          id: {
            in: expiredOrders.map((o: { id: string }) => o.id),
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      // Create activity logs for each expired order
      for (const order of expiredOrders) {
        await tx.activityLog.create({
          data: {
            userId: logUserId,
            action: 'EXPIRE_ORDER',
            target: `Order:${order.id}`,
            details: `Hệ thống tự động chuyển trạng thái đơn ${order.orderCode} sang ĐÃ HẾT HẠN do hết hạn sử dụng.`,
            ipAddress,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      count: expiredOrders.length,
      orders: expiredOrders.map((o: { orderCode: string }) => o.orderCode),
    });
  } catch (error: any) {
    console.error('Error checking order expiry:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
