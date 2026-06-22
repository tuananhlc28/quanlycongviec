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

    const service = await prisma.service.findUnique({
      where: { id, isDeleted: false },
    });

    if (!service) {
      return NextResponse.json({ error: 'Dịch vụ không tồn tại' }, { status: 404 });
    }

    return NextResponse.json(service);
  } catch (error: any) {
    console.error('Fetch service detail error:', error);
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
    const { name, slug, logo, description, sortOrder, isActive, serviceType, defaultSalePrice, defaultCostPrice, defaultDurationDays } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Tên và Slug dịch vụ là bắt buộc' }, { status: 400 });
    }

    if (defaultDurationDays !== undefined) {
      const parsedDays = parseInt(defaultDurationDays);
      if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
        return NextResponse.json({ error: 'Thời hạn mặc định phải từ 1 đến 365 ngày' }, { status: 400 });
      }
    }

    // Check slug unique excluding current service
    const existing = await prisma.service.findFirst({
      where: {
        slug,
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Slug dịch vụ đã tồn tại' }, { status: 400 });
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name,
        slug,
        logo: logo || null,
        description: description || null,
        serviceType: serviceType || "",
        defaultSalePrice: defaultSalePrice !== undefined ? parseFloat(defaultSalePrice) : 0,
        defaultCostPrice: defaultCostPrice !== undefined ? parseFloat(defaultCostPrice) : 0,
        defaultDurationDays: defaultDurationDays !== undefined ? parseInt(defaultDurationDays) : 30,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_SERVICE',
        target: `Service:${id}`,
        details: `Cập nhật dịch vụ: ${name}`,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update service error:', error);
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

    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      return NextResponse.json({ error: 'Dịch vụ không tồn tại' }, { status: 404 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.service.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'SOFT_DELETE_SERVICE',
          target: `Service:${id}`,
          details: `Xóa dịch vụ: ${service.name}`,
        },
      });
    });

    return NextResponse.json({ success: true, message: 'Đã xóa dịch vụ thành công' });
  } catch (error: any) {
    console.error('Delete service error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
