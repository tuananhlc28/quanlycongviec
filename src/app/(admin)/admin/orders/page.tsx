import prisma from '@/lib/prisma';
import OrdersList from './OrdersList';
import { ShoppingCart } from 'lucide-react';
import { auth } from '@/lib/auth';

export const revalidate = 0; // Disable cache for fresh admin data

export default async function AdminOrdersPage() {
  const session = await auth();
  const [orders, customers, services, supplierSources] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        service: true,
        supplierSource: true,
        refundHistories: true,
      },
    }),
    prisma.customer.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
      include: {
        orders: {
          select: {
            paymentStatus: true,
            paymentDueDate: true,
            salePrice: true,
            paidAmount: true,
          }
        }
      }
    }),
    prisma.service.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        packages: {
          where: { isDeleted: false, isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            supplierSourceProducts: {
              where: {
                supplierSource: {
                  isDeleted: false,
                  isActive: true
                }
              }
            }
          }
        }
      }
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
            <ShoppingCart className="w-7 h-7 text-indigo-400" />
            🛒 Đơn hàng
          </h1>
          <p className="text-sm text-slate-400 mt-1">{orders.length} đơn hàng trên hệ thống CRM</p>
        </div>
      </div>

      <OrdersList
        initialOrders={orders}
        customers={customers}
        services={services}
        supplierSources={supplierSources}
        currentUser={session?.user}
      />
    </div>
  );
}
