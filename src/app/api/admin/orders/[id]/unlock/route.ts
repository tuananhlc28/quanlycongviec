import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    // Only Admin can unlock orders
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Chỉ có Admin mới có quyền mở khóa đơn hàng' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp lý do mở khóa đơn hàng' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
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

    await prisma.$transaction(async (tx: any) => {
      // Update order state
      await tx.order.update({
        where: { id },
        data: {
          isUnlocked: true,
          unlockReason: reason,
        },
      });

      // Create activity log
      await tx.activityLog.create({
        data: {
          userId: logUserId,
          action: 'UNLOCK_ORDER',
          target: `Order:${id}`,
          details: `Đã mở khóa đơn hàng ${order.orderCode}. Lý do: ${reason}`,
          ipAddress,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error unlocking order:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
