import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import SourceDetailView from './SourceDetailView';

export const revalidate = 0; // Disable cache

async function getSourceData(id: string) {
  const source = await prisma.supplierSource.findUnique({
    where: { id },
    include: {
      orders: {
        include: {
          customer: true,
          service: true,
          refundHistories: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!source) return null;

  // Calculate stats
  const totalOrders = source.orders.length;
  let totalCost = 0;
  let totalRevenue = 0;
  let totalErrors = 0;
  let totalSourceRefundExpected = 0;
  let totalSourceRefundActual = 0;
  let totalSourceRefundRejected = 0;
  let totalRefund = 0; // client refund

  source.orders.forEach((o: any) => {
    totalCost += o.costPrice;
    totalRevenue += o.salePrice;

    // Use reported/completed states or general error indicator
    const hasErrors = ['REPORTED', 'WAIT_SOURCE', 'WAIT_CUSTOMER_REFUND', 'SOURCE_REJECTED'].includes(o.status) || (o.refundHistories && o.refundHistories.length > 0);
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
  const netDebt = totalSourceRefundExpected - totalSourceRefundActual;
  const totalProfit = totalRevenue - totalCost - totalRefund + totalSourceRefundActual;

  return {
    source,
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
    },
  };
}

export default async function SupplierSourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSourceData(id);

  if (!data) {
    notFound();
  }

  const { source, stats } = data;

  return <SourceDetailView source={source} stats={stats} />;
}
