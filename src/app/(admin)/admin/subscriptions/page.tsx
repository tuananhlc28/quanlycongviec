import prisma from '@/lib/prisma';
import SubscriptionsList from './SubscriptionsList';
import { RotateCcw } from 'lucide-react';

export const revalidate = 0; // Disable cache for fresh admin data

export default async function AdminSubscriptionsPage() {
  const [orders, services, supplierSources] = await Promise.all([
    prisma.order.findMany({
      orderBy: { endDate: 'asc' }, // Order by expiration date ascending so closest expirations show up first
      include: {
        customer: true,
        service: true,
        supplierSource: true,
        refundHistories: true,
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <RotateCcw className="w-7 h-7 text-indigo-400" />
            🔄 Quản lý tài khoản
          </h1>
          <p className="text-sm text-slate-400 mt-1">Quản lý gia hạn, thời hạn và trạng thái tài khoản của khách hàng</p>
        </div>
      </div>

      <SubscriptionsList
        initialOrders={orders}
        services={services}
        supplierSources={supplierSources}
      />
    </div>
  );
}
