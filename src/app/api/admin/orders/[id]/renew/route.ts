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
    const { daysToExtend, additionalSalePrice, additionalCostPrice, note } = body;

    if (!daysToExtend || additionalSalePrice === undefined || additionalCostPrice === undefined) {
      return NextResponse.json({ error: 'Thiếu thông tin gia hạn bắt buộc' }, { status: 400 });
    }

    const parsedDays = parseInt(daysToExtend);
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      return NextResponse.json({ error: 'Thời hạn gia hạn phải từ 1 đến 365 ngày' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json({ error: 'Đơn hàng không tồn tại' }, { status: 404 });
    }

    // 1. Tính toán ngày hết hạn mới
    const now = new Date();
    let currentEndDate = new Date(order.endDate);
    let newEndDate: Date;

    if (currentEndDate.getTime() > now.getTime()) {
      // Nếu chưa hết hạn, cộng tiếp từ ngày hết hạn cũ
      newEndDate = new Date(currentEndDate.getTime() + parseInt(daysToExtend) * 24 * 60 * 60 * 1000);
    } else {
      // Nếu đã hết hạn, cộng từ hôm nay
      newEndDate = new Date(now.getTime() + parseInt(daysToExtend) * 24 * 60 * 60 * 1000);
    }

    // 2. Tích lũy doanh thu, chi phí, lợi nhuận mới
    const parsedAddSale = parseFloat(additionalSalePrice);
    const parsedAddCost = parseFloat(additionalCostPrice);
    
    const newSalePrice = order.salePrice + parsedAddSale;
    const newCostPrice = order.costPrice + parsedAddCost;
    const newProfit = newSalePrice - newCostPrice;

    // 3. Cập nhật đơn hàng
    const updated = await prisma.order.update({
      where: { id },
      data: {
        endDate: newEndDate,
        salePrice: newSalePrice,
        costPrice: newCostPrice,
        profit: newProfit,
        status: 'ACTIVE', // Mở lại trạng thái Đang sử dụng
        durationDays: order.durationDays + parseInt(daysToExtend), // Cộng dồn số ngày gói
        note: note ? `${order.note || ''}\n[Gia hạn ${daysToExtend} ngày]: ${note}`.trim() : order.note,
      },
    });

    // 4. Log Action
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'RENEW_ORDER',
        target: `Order:${id}`,
        details: `Gia hạn đơn hàng ${order.orderCode} thêm ${daysToExtend} ngày. Doanh thu tăng: +${parsedAddSale}đ`,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Renew order API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
