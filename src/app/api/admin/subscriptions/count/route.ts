import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET: Count expiring subscriptions for sidebar badge
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const sevenDaysLater = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
    sevenDaysLater.setHours(23, 59, 59, 999);

    // Count orders expiring within 7 days — uses composite index (endDate, status)
    const expiringCount = await prisma.order.count({
      where: {
        status: { in: ['ACTIVE', 'EXPIRING_SOON'] },
        endDate: { gte: startOfToday, lte: sevenDaysLater },
      },
    });

    return NextResponse.json({ expiringCount });
  } catch (error: any) {
    console.error('Subscription count API error:', error);
    return NextResponse.json({ error: error.message || 'Lỗi' }, { status: 500 });
  }
}
