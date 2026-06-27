import prisma from '@/lib/prisma';
import WarrantyList from './WarrantyList';

async function getWarrantyData() {
  // Get all orders in warranty statuses with relations
  const warrantyOrders = await prisma.order.findMany({
    where: {
      status: {
        in: ['REPORTED', 'WAIT_SOURCE', 'WAIT_CUSTOMER_REFUND', 'SOURCE_REJECTED', 'COMPLETED'],
      },
    },
    include: {
      customer: true,
      service: true,
      supplierSource: true,
      refundHistories: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Get supplier sources for filter
  const supplierSources = await prisma.supplierSource.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // Get services for filter
  const services = await prisma.service.findMany({
    where: { isDeleted: false },
    select: { id: true, name: true, logo: true },
    orderBy: { name: 'asc' },
  });

  // Collect unique customer IDs from warranty orders
  const customerIds = Array.from(new Set(warrantyOrders.map((o: any) => o.customerId).filter(Boolean))) as string[];

  // Fetch lifetime stats for each customer involved in warranty
  const customerLifetimeStats: Record<string, {
    totalOrders: number;
    totalSpend: number;
    lastOrderDate: string | null;
    totalRefundAmount: number;
  }> = {};

  if (customerIds.length > 0) {
    const allCustomerOrders = await prisma.order.findMany({
      where: {
        customerId: { in: customerIds },
      },
      select: {
        customerId: true,
        salePrice: true,
        createdAt: true,
        refundHistories: {
          select: { amount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const id of customerIds) {
      const cOrders = allCustomerOrders.filter((o: any) => o.customerId === id);
      const totalOrders = cOrders.length;
      const totalSpend = cOrders.reduce((sum: number, o: any) => sum + o.salePrice, 0);
      const lastOrderDate = cOrders.length > 0 ? cOrders[0].createdAt?.toISOString() ?? null : null;
      const totalRefundAmount = cOrders.reduce((sum: number, o: any) =>
        sum + (o.refundHistories?.reduce((s: number, r: any) => s + r.amount, 0) || 0), 0);

      customerLifetimeStats[id] = { totalOrders, totalSpend, lastOrderDate, totalRefundAmount };
    }
  }

  // Dashboard stats
  const stats = {
    total: warrantyOrders.length,
    warranty: warrantyOrders.filter((o: any) => o.status === 'REPORTED').length,
    pendingSource: warrantyOrders.filter((o: any) => o.status === 'WAIT_SOURCE').length,
    pendingRefund: warrantyOrders.filter((o: any) => o.status === 'WAIT_CUSTOMER_REFUND').length,
    done: warrantyOrders.filter((o: any) => o.status === 'COMPLETED').length,
    rejected: warrantyOrders.filter((o: any) => o.status === 'SOURCE_REJECTED').length,
    totalRefundAmount: warrantyOrders.reduce((sum: number, o: any) =>
      sum + o.refundHistories.reduce((s: number, r: any) => s + r.amount, 0), 0),
    totalSourceRefund: warrantyOrders.reduce((sum: number, o: any) =>
      sum + o.refundHistories.reduce((s: number, r: any) => s + (r.sourceRefundActual || 0), 0), 0),
  };

  return {
    warrantyOrders: JSON.parse(JSON.stringify(warrantyOrders)),
    supplierSources,
    services,
    stats,
    customerLifetimeStats,
  };
}

export default async function WarrantyPage() {
  const { warrantyOrders, supplierSources, services, stats, customerLifetimeStats } = await getWarrantyData();

  return (
    <WarrantyList
      initialOrders={warrantyOrders}
      supplierSources={supplierSources}
      services={services}
      stats={stats}
      customerLifetimeStats={customerLifetimeStats}
    />
  );
}
