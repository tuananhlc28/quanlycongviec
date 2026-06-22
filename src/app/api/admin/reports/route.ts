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
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');

    const where: any = {};
    if (dateStart || dateEnd) {
      where.createdAt = {};
      if (dateStart) {
        where.createdAt.gte = new Date(dateStart);
      }
      if (dateEnd) {
        where.createdAt.lte = new Date(dateEnd);
      }
    }

    // Load orders
    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        service: true,
        refundHistories: true,
      },
    });

    // 1. Thống kê theo Khách hàng
    const customerMap = new Map<string, { id: string; name: string; spent: number; profit: number; ordersCount: number }>();
    
    // 2. Thống kê theo Dịch vụ
    const serviceMap = new Map<string, { id: string; name: string; logo: string | null; revenue: number; profit: number; ordersCount: number }>();

    // 3. Thống kê theo Nguồn hàng
    const sourceMap = new Map<string, { name: string; revenue: number; cost: number; profit: number; ordersCount: number; refundCount: number }>();

    // 4. Thống kê theo Tháng (vẽ biểu đồ)
    // Map key: YYYY-MM
    const monthlyMap = new Map<string, { month: string; revenue: number; profit: number; refund: number }>();

    orders.forEach((o: any) => {
      // Calculate dynamic profit for this order
      const orderRefunds = o.refundHistories ? o.refundHistories.reduce((sum: number, r: any) => sum + r.amount, 0) : 0;
      const orderSourceRefunds = o.refundHistories ? o.refundHistories.reduce((sum: number, r: any) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0) : 0;
      const actualProfit = (o.salePrice - o.costPrice) - orderRefunds + orderSourceRefunds;

      // Thống kê Khách hàng
      if (o.customer) {
        const cId = o.customer.id;
        const existing = customerMap.get(cId) || { id: cId, name: o.customer.name, spent: 0, profit: 0, ordersCount: 0 };
        existing.spent += o.salePrice;
        existing.profit += actualProfit;
        existing.ordersCount += 1;
        customerMap.set(cId, existing);
      }

      // Thống kê Dịch vụ
      if (o.service) {
        const sId = o.service.id;
        const existing = serviceMap.get(sId) || { id: sId, name: o.service.name, logo: o.service.logo, revenue: 0, profit: 0, ordersCount: 0 };
        existing.revenue += o.salePrice;
        existing.profit += actualProfit;
        existing.ordersCount += 1;
        serviceMap.set(sId, existing);
      }

      // Thống kê Nguồn hàng
      if (o.supplierSourceName) {
        const sName = o.supplierSourceName;
        const existing = sourceMap.get(sName) || { name: sName, revenue: 0, cost: 0, profit: 0, ordersCount: 0, refundCount: 0 };
        existing.revenue += o.salePrice;
        existing.cost += o.costPrice;
        existing.profit += actualProfit;
        existing.ordersCount += 1;
        if (o.status === 'REFUNDED') {
          existing.refundCount += 1;
        }
        sourceMap.set(sName, existing);
      }

      // Thống kê Tháng
      const dateObj = new Date(o.createdAt);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`; // YYYY-MM
      const label = `Tháng ${month}/${year}`;

      const existingMonth = monthlyMap.get(monthKey) || { month: label, revenue: 0, profit: 0, refund: 0 };
      existingMonth.revenue += o.salePrice;
      existingMonth.profit += actualProfit;
      
      existingMonth.refund += orderRefunds;

      monthlyMap.set(monthKey, existingMonth);
    });

    // Sắp xếp và lấy Top 5
    const topCustomersSpent = Array.from(customerMap.values())
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);

    const topCustomersProfit = Array.from(customerMap.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    const topServicesVolume = Array.from(serviceMap.values())
      .sort((a, b) => b.ordersCount - a.ordersCount)
      .slice(0, 5);

    const topServicesProfit = Array.from(serviceMap.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    const topSources = Array.from(sourceMap.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // Chuyển monthlyMap thành mảng và sắp xếp theo YYYY-MM
    const monthlyStats = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(entry => entry[1]);

    return NextResponse.json({
      topCustomersSpent,
      topCustomersProfit,
      topServicesVolume,
      topServicesProfit,
      topSources,
      monthlyStats,
    });
  } catch (error: any) {
    console.error('Fetch reports error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
