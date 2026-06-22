import prisma from '@/lib/prisma';
import WarrantyDetailView from './WarrantyDetailView';
import { notFound } from 'next/navigation';

export default async function WarrantyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      service: true,
      supplierSource: true,
      refundHistories: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) return notFound();

  const activityLogs = await prisma.activityLog.findMany({
    where: { target: `Order:${id}` },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <WarrantyDetailView
      key={new Date(order.updatedAt).getTime()}
      order={JSON.parse(JSON.stringify(order))}
      activityLogs={JSON.parse(JSON.stringify(activityLogs))}
    />
  );
}
