import prisma from './prisma';
import { calculateDetailedCreditRating } from './utils';

/**
 * Recalculate customer statistics, credit rating, and tag automatically.
 * This runs after every customer transaction (order creation, payments, warranty claims, refunds).
 */
export async function updateCustomerStats(customerId: string) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId, isDeleted: false },
      include: {
        orders: {
          include: {
            refundHistories: true
          }
        }
      }
    });

    if (!customer) return;

    const orders = customer.orders;
    const totalOrders = orders.length;

    // If a customer has no orders, they are classified as NEW
    if (totalOrders === 0) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          tag: 'NEW',
          creditRating: 'NEW'
        }
      });
      return;
    }

    let totalSpent = 0;
    let totalRefund = 0;
    let paidOnTimeCount = 0;
    let latePaymentCount = 0;
    let overdueCount = 0;
    let warrantyCount = 0;

    orders.forEach((o: any) => {
      // Spent is calculated based on what they were billed for
      totalSpent += o.salePrice;
      
      const orderRefunds = o.refundHistories ? o.refundHistories.reduce((sum: number, r: any) => sum + r.amount, 0) : 0;
      totalRefund += orderRefunds;
      
      // Count warranty/error reports
      warrantyCount += o.refundHistories ? o.refundHistories.length : 0;

      if (o.paymentStatus === 'PAID') {
        if (o.paymentDueDate && o.paidAt) {
          const dueDate = new Date(o.paymentDueDate);
          const paidDate = new Date(o.paidAt);
          if (paidDate <= dueDate) {
            paidOnTimeCount++;
          } else {
            latePaymentCount++;
          }
        } else {
          paidOnTimeCount++; // Assume on time if no due date set
        }
      } else {
        // UNPAID or OVERDUE
        if (o.paymentDueDate && new Date() > new Date(o.paymentDueDate)) {
          overdueCount++;
        }
      }
    });

    // 1. Calculate active loyalty days
    const daysSinceCreated = Math.max(0, Math.floor((new Date().getTime() - new Date(customer.createdAt).getTime()) / (24 * 60 * 60 * 1000)));

    // 2. Count renewal logs for the customer's orders
    const orderIds = orders.map((o: any) => o.id);
    const renewalsCount = await prisma.activityLog.count({
      where: {
        OR: [
          { target: `Customer:${customerId}` },
          { target: { in: orderIds.map((id: string) => `Order:${id}`) } }
        ],
        action: { in: ['RENEW_ORDER', 'BATCH_RENEW', 'RENEW'] }
      }
    });

    const { score, rating } = calculateDetailedCreditRating({
      totalOrders,
      paidOnTimeCount,
      latePaymentCount,
      currentDebtCount: overdueCount,
      totalSpend: totalSpent,
      daysSinceCreated,
      renewalsCount,
      warrantyCount,
      totalRefund,
    });

    // 5. Automatic Segment Tag classification (if not manually set to locked, spam, etc.)
    // We only update segment tag automatically if it was one of the dynamic ones: NEW, REGULAR, VIP, INACTIVE_30, INACTIVE_60, INACTIVE_90
    const dynamicTags = ['NEW', 'REGULAR', 'VIP', 'INACTIVE_30', 'INACTIVE_60', 'INACTIVE_90'];
    const currentTag = customer.tag || 'NEW';

    if (dynamicTags.includes(currentTag)) {
      let tag = 'NEW';
      // Find latest order date
      const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latestOrder = sortedOrders[0];
      const daysSinceLastOrder = latestOrder
        ? Math.max(0, Math.floor((new Date().getTime() - new Date(latestOrder.createdAt).getTime()) / (24 * 60 * 60 * 1000)))
        : null;

      if (daysSinceLastOrder === null) {
        tag = 'NEW';
      } else if (daysSinceLastOrder >= 90) {
        tag = 'INACTIVE_90';
      } else if (daysSinceLastOrder >= 60) {
        tag = 'INACTIVE_60';
      } else if (daysSinceLastOrder >= 30) {
        tag = 'INACTIVE_30';
      } else if (totalSpent >= 5000000 || totalOrders >= 5) {
        tag = 'VIP';
      } else if (totalOrders >= 2) {
        tag = 'REGULAR';
      }

      await prisma.customer.update({
        where: { id: customerId },
        data: {
          creditRating: rating,
          tag
        }
      });
    } else {
      // Keep manual tag (e.g. DAI_LY, SPAM, KHACH_NO, THAN_THIET) but update credit rating
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          creditRating: rating
        }
      });
    }

    console.log(`Updated customer stats for ${customer.name}: score=${score}, rating=${rating}, tag=${customer.tag}`);
  } catch (error) {
    console.error(`Error updating stats for customer ${customerId}:`, error);
  }
}
