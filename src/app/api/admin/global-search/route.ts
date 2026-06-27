import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Search in parallel
    const [orders, customers, services, sources] = await Promise.all([
      // Orders: search by orderCode, accountEmail
      prisma.order.findMany({
        where: {
          isDeleted: false,
          OR: [
            { orderCode: { contains: q, mode: 'insensitive' } },
            { accountEmail: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          orderCode: true,
          accountEmail: true,
          status: true,
          salePrice: true,
          customer: { select: { id: true, name: true } },
          service: { select: { id: true, name: true, logo: true } },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),

      // Customers: search by name, phone, facebook
      prisma.customer.findMany({
        where: {
          isDeleted: false,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { facebook: { contains: q, mode: 'insensitive' } },
            { telegram: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          phone: true,
          facebook: true,
          tag: true,
          _count: { select: { orders: true } },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),

      // Services
      prisma.service.findMany({
        where: {
          isDeleted: false,
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true, logo: true },
        take: 3,
      }),

      // Sources
      prisma.supplierSource.findMany({
        where: {
          isDeleted: false,
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true },
        take: 3,
      }),
    ]);

    const results = {
      orders: orders.map((o: any) => ({
        id: o.id,
        type: 'order',
        title: o.orderCode,
        subtitle: `${o.customer?.name || 'N/A'} · ${o.service?.name || 'N/A'} · ${o.accountEmail || '–'}`,
        href: `/admin/orders/${o.id}`,
        icon: o.service?.logo || '🔑',
        status: o.status,
      })),
      customers: customers.map((c: any) => ({
        id: c.id,
        type: 'customer',
        title: c.name,
        subtitle: `${c.phone || 'Không có SĐT'} · ${c._count.orders} đơn hàng`,
        href: `/admin/customers/${c.id}`,
        icon: '👤',
        tag: c.tag,
      })),
      services: services.map((s: any) => ({
        id: s.id,
        type: 'service',
        title: s.name,
        subtitle: 'Dịch vụ',
        href: `/admin/services`,
        icon: s.logo || '🔑',
      })),
      sources: sources.map((s: any) => ({
        id: s.id,
        type: 'source',
        title: s.name,
        subtitle: 'Nguồn hàng',
        href: `/admin/sources`,
        icon: '📦',
      })),
    };

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Global search error:', error);
    return NextResponse.json({ error: 'Lỗi tìm kiếm' }, { status: 500 });
  }
}
