import prisma from '@/lib/prisma';
import ReportsDashboard from './ReportsDashboard';
import { BarChart3 } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 0; // Disable caching

export default async function AdminReportsPage() {
  // Fetch all orders, refunds, and customer lists
  const [orders, refunds, customers] = await Promise.all([
    prisma.order.findMany({
      include: {
        customer: true,
        service: true,
        refundHistories: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.refundHistory.findMany({
      include: {
        order: {
          include: {
            service: true,
            customer: true,
          }
        }
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.customer.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'asc' },
    })
  ]);

  // Serialize date fields to ISO string to avoid Next.js serialization warnings
  const serializedOrders = orders.map((o: any) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    startDate: o.startDate.toISOString(),
    endDate: o.endDate.toISOString(),
    paymentDueDate: o.paymentDueDate ? o.paymentDueDate.toISOString() : null,
    paidAt: o.paidAt ? o.paidAt.toISOString() : null,
    refundHistories: o.refundHistories.map((r: any) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      errorDate: r.errorDate ? r.errorDate.toISOString() : null,
    })),
  }));

  const serializedRefunds = refunds.map((r: any) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    errorDate: r.errorDate ? r.errorDate.toISOString() : null,
    order: r.order ? {
      ...r.order,
      createdAt: r.order.createdAt.toISOString(),
      startDate: r.order.startDate.toISOString(),
      endDate: r.order.endDate.toISOString(),
    } : null,
  }));

  const serializedCustomers = customers.map((c: any) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-indigo-400" />
            📈 Báo cáo hoàn tiền
          </h1>
          <p className="text-sm text-slate-400 mt-1">Phân tích trực quan doanh số, đơn hàng, khách hàng và sự cố bảo hành</p>
        </div>
      </div>

      <ReportsDashboard 
        orders={serializedOrders} 
        refunds={serializedRefunds} 
        customers={serializedCustomers} 
      />
    </div>
  );
}
