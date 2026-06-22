import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const showDeleted = searchParams.get('showDeleted') === 'true';

    const where: any = {
      isDeleted: showDeleted ? undefined : false,
    };

    const services = await prisma.service.findMany({
      where,
      include: {
        orders: {
          include: {
            refundHistories: true
          }
        }
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Tính toán thống kê cho mỗi dịch vụ
    const data = services.map((s: any) => {
      let totalOrders = s.orders.length;
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;
      let totalRefund = 0;

      s.orders.forEach((o: any) => {
        totalRevenue += o.salePrice;
        totalCost += o.costPrice;
        totalProfit += o.profit;

        o.refundHistories.forEach((r: any) => {
          totalRefund += r.amount;
        });
      });

      const avgSalePrice = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const avgCostPrice = totalOrders > 0 ? totalCost / totalOrders : 0;

      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        logo: s.logo,
        description: s.description,
        serviceType: s.serviceType || "",
        defaultSalePrice: s.defaultSalePrice || 0,
        defaultCostPrice: s.defaultCostPrice || 0,
        defaultDurationDays: s.defaultDurationDays || 30,
        isActive: s.isActive,
        sortOrder: s.sortOrder,
        createdAt: s.createdAt,
        stats: {
          totalOrders,
          totalRevenue,
          totalCost,
          totalProfit,
          totalRefund,
          avgSalePrice,
          avgCostPrice,
        }
      };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Fetch services error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

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

    // Check slug unique
    const existing = await prisma.service.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json({ error: 'Slug dịch vụ đã tồn tại' }, { status: 400 });
    }

    const service = await prisma.service.create({
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
        action: 'CREATE_SERVICE',
        target: `Service:${service.id}`,
        details: `Tạo dịch vụ mới: ${service.name}`,
      },
    });

    return NextResponse.json(service);
  } catch (error: any) {
    console.error('Create service error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
