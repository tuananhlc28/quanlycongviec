import prisma from '@/lib/prisma';
import CustomersTable from './CustomersTable';
import { Users } from 'lucide-react';

export const revalidate = 0; // Disable cache for fresh admin data

export default async function AdminCustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      orders: {
        include: {
          refundHistories: true,
          service: true,
        }
      }
    },
  });

  // Fetch renewals count for each customer to pass to the client table
  const enrichedCustomers = await Promise.all(
    customers.map(async (c: any) => {
      const orderIds = c.orders.map((o: any) => o.id);
      const renewalsCount = await prisma.activityLog.count({
        where: {
          OR: [
            { target: `Customer:${c.id}` },
            { target: { in: orderIds.map((id: string) => `Order:${id}`) } }
          ],
          action: { in: ['RENEW_ORDER', 'BATCH_RENEW', 'RENEW'] }
        }
      });

      return {
        ...c,
        renewalsCount
      };
    })
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-indigo-400" />
            👥 Khách hàng
          </h1>
          <p className="text-sm text-slate-400 mt-1">{customers.filter((c: any) => !c.isDeleted).length} khách hàng trên hệ thống CRM</p>
        </div>
      </div>

      <CustomersTable initialCustomers={enrichedCustomers} />
    </div>
  );
}
