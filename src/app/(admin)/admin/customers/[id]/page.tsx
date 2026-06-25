import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import CustomerDetailView from './CustomerDetailView';

export const revalidate = 0; // Disable cache for fresh admin data

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch customer details, services, and sources
  const [customer, services, supplierSources] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            service: true,
            refundHistories: {
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        paymentRecords: {
          include: {
            order: { select: { orderCode: true } },
          },
          orderBy: { paidAt: 'desc' },
        },
      },
    }),
    prisma.service.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.supplierSource.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!customer || customer.isDeleted) {
    notFound();
  }

  // Fetch activity logs for this customer and their orders
  const orderIds = customer.orders.map((o: any) => `Order:${o.id}`);
  const activityLogs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { target: `Customer:${id}` },
        { target: { in: orderIds } },
      ],
    },
    include: {
      user: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <CustomerDetailView
      customer={customer}
      services={services}
      supplierSources={supplierSources}
      activityLogs={activityLogs}
    />
  );
}
