import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const sources = await prisma.supplierSource.findMany({
      where: { isDeleted: false },
      include: {
        orders: {
          include: {
            refundHistories: true
          }
        },
      },
      orderBy: { name: 'asc' },
    });

    const enrichedSources = sources.map((src: any) => {
      const totalOrders = src.orders.length;
      
      let totalCost = 0;
      let totalRevenue = 0;
      let totalProfit = 0;
      let totalRefund = 0;
      
      const refundedOrdersCount = src.orders.filter((o: any) => o.status === 'REFUNDED').length;
      
      src.orders.forEach((o: any) => {
        totalCost += o.costPrice;
        totalRevenue += o.salePrice;
        totalProfit += o.profit;
        
        o.refundHistories.forEach((r: any) => {
          totalRefund += r.amount;
        });
      });

      // Tỷ lệ lỗi = Số đơn hoàn tiền / Tổng số đơn
      const errorRate = totalOrders > 0 ? parseFloat(((refundedOrdersCount / totalOrders) * 100).toFixed(1)) : 0;

      return {
        id: src.id,
        name: src.name,
        telegram: src.telegram,
        zalo: src.zalo,
        email: src.email,
        note: src.note,
        isActive: src.isActive,
        createdAt: src.createdAt,
        stats: {
          totalCost,
          totalOrders,
          totalRevenue,
          totalProfit,
          totalRefund,
          errorRate,
        }
      };
    });

    return NextResponse.json({ sources: enrichedSources });
  } catch (error: any) {
    console.error('Get supplier sources error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi máy chủ' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = await request.json();
    const { name, telegram, zalo, email, note, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tên nguồn hàng là bắt buộc' }, { status: 400 });
    }

    const source = await prisma.supplierSource.create({
      data: {
        name,
        telegram: telegram || null,
        zalo: zalo || null,
        email: email || null,
        note: note || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_SOURCE',
        target: `SupplierSource:${source.id}`,
        details: `Tạo nguồn hàng mới: ${source.name}`,
      },
    });

    return NextResponse.json({ source });
  } catch (error: any) {
    console.error('Create supplier source error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi máy chủ' }, { status: 500 });
  }
}
