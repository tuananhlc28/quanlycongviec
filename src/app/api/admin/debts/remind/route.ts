import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = await request.json();
    const { customerIds } = body;

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: 'Danh sách khách hàng không hợp lệ' }, { status: 400 });
    }

    const customers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
        isDeleted: false,
      },
    });

    if (customers.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy khách hàng hợp lệ' }, { status: 404 });
    }

    // Log Activity for each customer
    const logPromises = customers.map((customer: any) => {
      return prisma.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'REMIND_DEBT',
          target: `Customer:${customer.id}`,
          details: `Gửi nhắc nhở thanh toán công nợ cho khách hàng: ${customer.name}`,
        },
      });
    });

    await Promise.all(logPromises);

    return NextResponse.json({
      success: true,
      message: `Đã gửi nhắc nhở thanh toán cho ${customers.length} khách hàng`,
    });
  } catch (error: any) {
    console.error('Debts Remind API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
