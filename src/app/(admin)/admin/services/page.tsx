import prisma from '@/lib/prisma';
import ServicesList from './ServicesList';
import { Package } from 'lucide-react';

export const revalidate = 0; // Disable cache for fresh admin data

export default async function AdminServicesPage() {
  const services = await prisma.service.findMany({
    where: { isDeleted: false },
    include: {
      orders: {
        include: {
          refundHistories: true
        }
      }
    },
    orderBy: { sortOrder: 'asc' }
  });

  // Calculate stats on server
  const processedServices = services.map((s: any) => {
    let totalOrders = s.orders.length;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalRefund = 0;

    s.orders.forEach((o: any) => {
      totalRevenue += o.salePrice;
      totalCost += o.costPrice;
      totalProfit += o.profit;
      
      if (o.refundHistories) {
        o.refundHistories.forEach((r: any) => {
          totalRefund += r.amount;
        });
      }
    });

    const avgCostPrice = totalOrders > 0 ? Math.round(totalCost / totalOrders) : 0;
    const avgSalePrice = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      logo: s.logo,
      description: s.description,
      serviceType: s.serviceType,
      defaultSalePrice: s.defaultSalePrice,
      defaultCostPrice: s.defaultCostPrice,
      defaultDurationDays: s.defaultDurationDays,
      isActive: s.isActive,
      sortOrder: s.sortOrder,
      createdAt: s.createdAt,
      stats: {
        totalOrders,
        totalRevenue,
        totalCost,
        totalProfit,
        totalRefund,
        avgCostPrice,
        avgSalePrice,
      }
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Package className="w-7 h-7 text-indigo-400" />
            🛍️ Dịch vụ
          </h1>
          <p className="text-sm text-slate-400 mt-1">Cấu hình các gói tài khoản số, theo dõi doanh thu và hiệu quả của từng loại dịch vụ.</p>
        </div>
      </div>

      <ServicesList initialServices={processedServices} />
    </div>
  );
}
