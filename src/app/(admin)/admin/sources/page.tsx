import prisma from '@/lib/prisma';
import SourcesList from './SourcesList';
import { Box } from 'lucide-react';

export const revalidate = 0; // Disable cache for fresh admin data

export default async function AdminSourcesPage() {
  const sources = await prisma.supplierSource.findMany({
    where: { isDeleted: false },
    include: {
      orders: {
        include: {
          refundHistories: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  // Calculate statistics
  const processedSources = sources.map((src: any) => {
    const totalOrders = src.orders.length;
    
    let totalCost = 0;
    let totalRevenue = 0;
    let totalErrors = 0;
    let totalSourceRefundExpected = 0;
    let totalSourceRefundActual = 0;
    let totalSourceRefundRejected = 0;
    let totalRefund = 0; // customer refund
    
    src.orders.forEach((o: any) => {
      totalCost += o.costPrice;
      totalRevenue += o.salePrice;
      
      const hasErrors = ['REPORTED', 'WAIT_SOURCE', 'WAIT_CUSTOMER_REFUND', 'COMPLETED', 'SOURCE_REJECTED'].includes(o.status) || (o.refundHistories && o.refundHistories.length > 0);
      if (hasErrors) {
        totalErrors++;
      }
      
      if (o.refundHistories) {
        o.refundHistories.forEach((r: any) => {
          totalRefund += r.amount;
          totalSourceRefundExpected += r.sourceRefundExpected || 0;
          totalSourceRefundActual += r.sourceRefundActual || 0;
          if (r.sourceStatus === 'REJECTED') {
            totalSourceRefundRejected += r.sourceRefundExpected || 0;
          }
        });
      }
    });

    const errorRate = totalOrders > 0 ? parseFloat(((totalErrors / totalOrders) * 100).toFixed(1)) : 0;
    const netDebt = Math.max(0, (totalSourceRefundExpected - totalSourceRefundRejected) - totalSourceRefundActual);
    const totalProfit = totalRevenue - totalCost - totalRefund + totalSourceRefundActual;

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
        totalErrors,
        totalSourceRefundExpected,
        totalSourceRefundActual,
        totalSourceRefundRejected,
        netDebt,
      }
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Box className="w-7 h-7 text-indigo-400" />
            🔌 Nguồn hàng
          </h1>
          <p className="text-sm text-slate-400 mt-1">Quản lý danh sách nguồn hàng, theo dõi chi phí vốn nhập và đánh giá chất lượng qua tỷ lệ lỗi.</p>
        </div>
      </div>

      <SourcesList initialSources={processedSources} />
    </div>
  );
}
