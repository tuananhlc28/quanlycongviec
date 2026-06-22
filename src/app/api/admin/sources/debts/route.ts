import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { computeSourceDebtSummaries } from '@/lib/financials';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    // Fetch all refund histories with their supplier source cache
    const refundHistories = await prisma.refundHistory.findMany({
      select: {
        sourceStatus: true,
        sourceRefundExpected: true,
        sourceRefundActual: true,
        order: {
          select: {
            supplierSourceId: true,
            supplierSourceName: true,
          },
        },
      },
    });

    const summaries = computeSourceDebtSummaries(refundHistories as any);

    return NextResponse.json({ summaries });
  } catch (error: any) {
    console.error('Source debts API error:', error);
    return NextResponse.json({ error: error.message || 'Đã xảy ra lỗi' }, { status: 500 });
  }
}
