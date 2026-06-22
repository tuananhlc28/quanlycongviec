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
    const serviceId = searchParams.get('serviceId') || '';
    const supplierSourceId = searchParams.get('supplierSourceId') || '';
    const status = searchParams.get('status') || '';
    const dateStart = searchParams.get('dateStart') || '';
    const dateEnd = searchParams.get('dateEnd') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    // 1. Filter by Service
    if (serviceId) {
      where.serviceId = serviceId;
    }

    // 2. Filter by Supplier Source
    if (supplierSourceId) {
      where.supplierSourceId = supplierSourceId;
    }

    // 3. Filter by Status
    if (status) {
      where.status = status;
    }

    // 4. Filter by Date range (startDate)
    if (dateStart || dateEnd) {
      where.startDate = {};
      if (dateStart) {
        where.startDate.gte = new Date(dateStart);
      }
      if (dateEnd) {
        where.startDate.lte = new Date(dateEnd);
      }
    }

    // 5. Search globally
    if (search) {
      where.OR = [
        { orderCode: { contains: search } },
        { accountEmail: { contains: search } },
        { supplierSourceName: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
        { customer: { facebook: { contains: search } } },
        { customer: { telegram: { contains: search } } },
        { service: { name: { contains: search } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: true,
          service: true,
          supplierSource: true,
          refundHistories: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Fetch orders API error:', error);
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
    let {
      customerId,
      newCustomerName,
      newCustomerPhone,
      newCustomerFacebook,
      newCustomerTelegram,
      newCustomerZalo,
      newCustomerNote,
      serviceId,
      packageName,
      durationDays,
      accountEmail,
      accountPassword,
      recoveryCode,
      loginLink,
      accountNote,
      supplierSourceId,
      salePrice,
      costPrice,
      startDate,
      endDate,
      status,
      note,
      paymentStatus,
    } = body;

    // Validate
    if (!serviceId || !packageName || durationDays === undefined || salePrice === undefined || costPrice === undefined) {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc để tạo đơn' }, { status: 400 });
    }

    const parsedDays = parseInt(durationDays || '30');
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      return NextResponse.json({ error: 'Thời hạn dịch vụ phải từ 1 đến 365 ngày' }, { status: 400 });
    }

    // 1. Xử lý khách hàng (tạo mới nếu customerId === 'new')
    if (customerId === 'new') {
      if (!newCustomerName) {
        return NextResponse.json({ error: 'Tên khách hàng mới là bắt buộc' }, { status: 400 });
      }
      const newCustomer = await prisma.customer.create({
        data: {
          name: newCustomerName,
          phone: newCustomerPhone || null,
          facebook: newCustomerFacebook || null,
          telegram: newCustomerTelegram || null,
          zalo: newCustomerZalo || null,
          note: newCustomerNote || null,
        },
      });
      customerId = newCustomer.id;
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Khách hàng là bắt buộc' }, { status: 400 });
    }

    // 2. Lấy tên nguồn hàng để cache
    let supplierSourceName = null;
    if (supplierSourceId) {
      const source = await prisma.supplierSource.findUnique({
        where: { id: supplierSourceId },
      });
      if (source) {
        supplierSourceName = source.name;
      }
    }

    // 3. Tự động sinh mã đơn hàng duy nhất (ví dụ: DH-YYMMDD-XXXX)
    const count = await prisma.order.count();
    const formattedCount = String(count + 1).padStart(4, '0');
    const orderCode = `DH-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${formattedCount}`;

    // 4. Tạo đơn hàng
    const parsedSale = parseFloat(salePrice) || 0;
    const parsedCost = parseFloat(costPrice) || 0;
    const profit = parsedSale - parsedCost;

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + parseInt(durationDays || '30') * 24 * 60 * 60 * 1000);

    const dbUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: session.user.id },
          { email: session.user.email || undefined }
        ]
      }
    });
    const logUserId = dbUser ? dbUser.id : null;
    const operatorName = dbUser ? dbUser.name : (session.user.name || 'Admin');
    const paymentStatusVal = paymentStatus || 'UNPAID';

    const order = await prisma.$transaction(async (tx: any) => {
      const ord = await tx.order.create({
        data: {
          orderCode,
          customerId,
          serviceId,
          packageName,
          durationDays: parseInt(durationDays || '30'),
          accountEmail: accountEmail || null,
          accountPassword: accountPassword || null,
          recoveryCode: recoveryCode || null,
          loginLink: loginLink || null,
          accountNote: accountNote || null,
          supplierSourceId: supplierSourceId || null,
          supplierSourceName,
          salePrice: parsedSale,
          costPrice: parsedCost,
          profit,
          startDate: start,
          endDate: end,
          status: status || 'ACTIVE',
          note: note || null,
          paymentStatus: paymentStatusVal,
          paidAmount: paymentStatusVal === 'PAID' ? parsedSale : 0,
          paidAt: paymentStatusVal === 'PAID' ? start : null,
        },
      });

      if (paymentStatusVal === 'PAID') {
        await tx.paymentRecord.create({
          data: {
            customerId,
            orderId: ord.id,
            amount: parsedSale,
            method: 'bank',
            note: `Thanh toán tự động khi tạo đơn bởi ${operatorName}`,
            paidAt: start,
          },
        });
      }

      // 5. Log Activity
      await tx.activityLog.create({
        data: {
          userId: logUserId,
          action: 'CREATE_ORDER',
          target: `Order:${ord.id}`,
          details: `Tạo đơn hàng mới ${orderCode} cho dịch vụ ${packageName}. Trạng thái thanh toán: ${paymentStatusVal === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}`,
        },
      });

      return ord;
    });

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
