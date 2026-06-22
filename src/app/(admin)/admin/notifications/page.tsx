import prisma from '@/lib/prisma';
import NotificationsView from './NotificationsView';

export const revalidate = 0; // Disable caching

export default async function AdminNotificationsPage() {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    services,
    sources,
    warrantyOrders,
    pendingRefundOrders,
  ] = await Promise.all([
    // 1. Service list
    prisma.service.findMany({ where: { isDeleted: false }, select: { id: true, name: true } }),
    // 2. Source list
    prisma.supplierSource.findMany({ where: { isDeleted: false }, select: { id: true, name: true } }),
    // 3. Đơn đang bảo hành
    prisma.order.findMany({
      where: { status: 'WARRANTY' },
      include: { customer: true, service: true },
      orderBy: { updatedAt: 'desc' },
    }),
    // 4. Đơn chờ hoàn tiền
    prisma.order.findMany({
      where: { status: 'PENDING_REFUND' },
      include: { customer: true, service: true, refundHistories: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  return (
    <NotificationsView
      services={services}
      sources={sources}
      warrantyOrders={warrantyOrders}
      pendingRefundOrders={pendingRefundOrders}
    />
  );
}
