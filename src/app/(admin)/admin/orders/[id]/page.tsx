import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import OrderDetailView from './OrderDetailView';

export const revalidate = 0; // Disable cache for fresh admin data

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [order, supplierSources, services, activityLogs] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        service: true,
        supplierSource: true,
        refundHistories: {
          orderBy: { createdAt: 'desc' }
        },
      },
    }),
    prisma.supplierSource.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.service.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.activityLog.findMany({
      where: { target: `Order:${id}` },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!order) {
    notFound();
  }

  return (
    <OrderDetailView
      order={order}
      supplierSources={supplierSources}
      services={services}
      activityLogs={activityLogs}
    />
  );
}
