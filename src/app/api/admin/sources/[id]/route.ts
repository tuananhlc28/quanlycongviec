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
    const source = await prisma.supplierSource.findUnique({
      where: { id, isDeleted: false },
    });

    if (!source) {
      return NextResponse.json({ error: 'Nguồn hàng không tồn tại' }, { status: 404 });
    }

    return NextResponse.json(source);
  } catch (error: any) {
    console.error('Fetch source detail error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi máy chủ' }, { status: 500 });
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
    const { name, telegram, zalo, email, note, isActive } = body;

    const source = await prisma.supplierSource.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: 'Nguồn hàng không tồn tại' }, { status: 404 });
    }

    const updatedSource = await prisma.supplierSource.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        telegram: telegram !== undefined ? (telegram || null) : undefined,
        zalo: zalo !== undefined ? (zalo || null) : undefined,
        email: email !== undefined ? (email || null) : undefined,
        note: note !== undefined ? (note || null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_SOURCE',
        target: `SupplierSource:${id}`,
        details: `Cập nhật nguồn hàng: ${updatedSource.name}`,
      },
    });

    return NextResponse.json({ source: updatedSource });
  } catch (error: any) {
    console.error('Update supplier source error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi máy chủ' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return PUT(request, { params });
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

    const source = await prisma.supplierSource.findUnique({ where: { id } });
    if (!source) {
      return NextResponse.json({ error: 'Nguồn hàng không tồn tại' }, { status: 404 });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.supplierSource.update({
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
          action: 'SOFT_DELETE_SOURCE',
          target: `SupplierSource:${id}`,
          details: `Xóa nguồn hàng: ${source.name}`,
        },
      });
    });

    return NextResponse.json({ success: true, message: 'Đã xóa nguồn hàng thành công' });
  } catch (error: any) {
    console.error('Delete supplier source error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi máy chủ' }, { status: 500 });
  }
}
