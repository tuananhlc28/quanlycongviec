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
    const { note } = body;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    const isLocked = ['COMPLETED', 'SOURCE_REJECTED'].includes(order.status) && !order.isUnlocked;
    if (isLocked) {
      return NextResponse.json({ error: 'Đơn hàng đã hoàn tất hoặc bị từ chối và đang bị khóa. Vui lòng mở khóa đơn trước.' }, { status: 400 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';

    // Append to note
    const updatedNote = `${order.note || ''}\n[Bảo hành xong]: ${note || 'Đã khắc phục sự cố tài khoản.'}`.trim();

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        note: updatedNote,
      },
    });

    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: session.user.id },
          { email: session.user.email || undefined }
        ]
      }
    });
    const logUserId = dbUser ? dbUser.id : null;

    // Log Action
    await prisma.activityLog.create({
      data: {
        userId: logUserId,
        action: 'RESOLVE_WARRANTY',
        target: `Order:${id}`,
        details: `Đã xử lý bảo hành xong.${note ? ' Ghi chú: ' + note : ''}`,
        ipAddress,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Resolve warranty API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
