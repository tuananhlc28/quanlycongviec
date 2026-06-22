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

    const customer = await prisma.customer.findUnique({
      where: { id, isDeleted: false },
      include: {
        orders: {
          include: {
            service: true,
            refundHistories: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Khách hàng không tồn tại' }, { status: 404 });
    }

    const orderIds = customer.orders.map((o: any) => `Order:${o.id}`);
    const logs = await prisma.activityLog.findMany({
      where: {
        OR: [
          { target: `Customer:${id}` },
          { target: { in: orderIds } },
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      ...customer,
      activityLogs: logs,
    });
  } catch (error: any) {
    console.error('Fetch customer detail error:', error);
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
    const body = await request.json();
    const { name, phone, facebook, telegram, zalo, note } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tên khách hàng là bắt buộc' }, { status: 400 });
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        facebook: facebook || null,
        telegram: telegram || null,
        zalo: zalo || null,
        note: note || null,
      },
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_CUSTOMER',
        target: `Customer:${id}`,
        details: `Cập nhật thông tin khách hàng: ${name}`,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update customer error:', error);
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

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Khách hàng không tồn tại' }, { status: 404 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.customer.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'SOFT_DELETE_CUSTOMER',
          target: `Customer:${id}`,
          details: `Xóa khách hàng: ${customer.name}`,
        },
      });
    });

    return NextResponse.json({ success: true, message: 'Đã lưu trữ khách hàng thành công' });
  } catch (error: any) {
    console.error('Delete customer error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
