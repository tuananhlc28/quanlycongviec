import prisma from '@/lib/prisma';
import WarrantyList from './WarrantyList';

async function getWarrantyData() {
  // Get all orders in warranty statuses with relations
  const warrantyOrders = await prisma.order.findMany({
    where: {
      status: {
        in: ['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND', 'WARRANTY_DONE', 'WARRANTY_REJECTED'],
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

  // Dashboard stats
  const stats = {
    total: warrantyOrders.length,
    warranty: warrantyOrders.filter((o: any) => o.status === 'WARRANTY').length,
    pendingSource: warrantyOrders.filter((o: any) => o.status === 'WARRANTY_PENDING_SOURCE').length,
    pendingRefund: warrantyOrders.filter((o: any) => o.status === 'WARRANTY_PENDING_REFUND').length,
    done: warrantyOrders.filter((o: any) => o.status === 'WARRANTY_DONE').length,
    rejected: warrantyOrders.filter((o: any) => o.status === 'WARRANTY_REJECTED').length,
    totalRefundAmount: warrantyOrders.reduce((sum: number, o: any) =>
      sum + o.refundHistories.reduce((s: number, r: any) => s + r.amount, 0), 0),
    totalSourceRefund: warrantyOrders.reduce((sum: number, o: any) =>
      sum + o.refundHistories.reduce((s: number, r: any) => s + (r.sourceRefundActual || 0), 0), 0),
  };

  return { warrantyOrders: JSON.parse(JSON.stringify(warrantyOrders)), supplierSources, services, stats };
}

export default async function WarrantyPage() {
  const { warrantyOrders, supplierSources, services, stats } = await getWarrantyData();

  return (
    <WarrantyList
      initialOrders={warrantyOrders}
      supplierSources={supplierSources}
      services={services}
      stats={stats}
    />
  );
}
