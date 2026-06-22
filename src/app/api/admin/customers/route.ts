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
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { facebook: { contains: search } },
        { telegram: { contains: search } },
        { zalo: { contains: search } },
      ];
    }

    // Lấy danh sách khách hàng kèm đơn hàng và lịch sử hoàn tiền để tính thống kê
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          orders: {
            include: {
              refundHistories: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    // Tính toán thống kê inline cho mỗi khách hàng
    const data = customers.map((c: any) => {
      let totalOrders = c.orders.length;
      let totalSpent = 0;
      let totalRefund = 0;
      let totalProfit = 0;

      c.orders.forEach((o: any) => {
        totalSpent += o.salePrice;
        totalProfit += o.profit;
        
        o.refundHistories.forEach((r: any) => {
          totalRefund += r.amount;
        });
      });

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        facebook: c.facebook,
        telegram: c.telegram,
        zalo: c.zalo,
        note: c.note,
        createdAt: c.createdAt,
        stats: {
          totalOrders,
          totalSpent,
          totalRefund,
          totalProfit,
        }
      };
    });

    return NextResponse.json({
      customers: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Fetch customers API error:', error);
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
    const { name, phone, facebook, telegram, zalo, note } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tên khách hàng là bắt buộc' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone: phone || null,
        facebook: facebook || null,
        telegram: telegram || null,
        zalo: zalo || null,
        note: note || null,
      },
    });

    // Log hoạt động
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_CUSTOMER',
        target: `Customer:${customer.id}`,
        details: `Tạo khách hàng mới: ${customer.name}`,
      },
    });

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Create customer API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
