import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Auto-update UNPAID orders past 1 day since startDate to OVERDUE status
    await prisma.order.updateMany({
      where: {
        paymentStatus: 'UNPAID',
        startDate: { lte: oneDayAgo },
      },
      data: {
        paymentStatus: 'OVERDUE',
      },
    });

    // 2. Count unique customers with at least one OVERDUE order
    const overdueCustomers = await prisma.order.groupBy({
      by: ['customerId'],
      where: {
        paymentStatus: 'OVERDUE',
      },
    });

    return NextResponse.json({ count: overdueCustomers.length });
  } catch (error: any) {
    console.error('Debts count API error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi' }, { status: 500 });
  }
}
