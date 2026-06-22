import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
      return new Response('Không có quyền truy cập', { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const serviceId = searchParams.get('serviceId') || '';
    const supplierSourceId = searchParams.get('supplierSourceId') || '';
    const status = searchParams.get('status') || '';
    const dateStart = searchParams.get('dateStart') || '';
    const dateEnd = searchParams.get('dateEnd') || '';

    const where: any = {};

    if (serviceId) {
      where.serviceId = serviceId;
    }
    if (supplierSourceId) {
      where.supplierSourceId = supplierSourceId;
    }
    if (status) {
      where.status = status;
    }
    if (dateStart || dateEnd) {
      where.startDate = {};
      if (dateStart) {
        where.startDate.gte = new Date(dateStart);
      }
      if (dateEnd) {
        where.startDate.lte = new Date(dateEnd);
      }
    }
    if (search) {
      where.OR = [
        { orderCode: { contains: search } },
        { accountEmail: { contains: search } },
        { supplierSourceName: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
        { customer: { facebook: { contains: search } } },
        { customer: { telegram: { contains: search } } },
        { service: { name: { contains: search } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        service: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Tạo nội dung CSV với UTF-8 BOM
    const headers = [
      'Mã Đơn',
      'Khách Hàng',
      'Số Điện Thoại',
      'Facebook',
      'Telegram',
      'Dịch Vụ',
      'Tên Gói',
      'Số Ngày Gói',
      'Email Tài Khoản',
      'Mật Khẩu',
      'Nguồn Hàng',
      'Giá Bán (VNĐ)',
      'Giá Vốn (VNĐ)',
      'Lợi Nhuận (VNĐ)',
      'Ngày Bắt Đầu',
      'Ngày Hết Hạn',
      'Trạng Thái',
      'Ghi Chú'
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      // Thay thế dấu kép bằng dấu kép kép
      str = str.replace(/"/g, '""');
      // Bọc lại bằng dấu kép nếu chứa dấu phẩy, dấu kép hoặc xuống dòng
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str}"`;
      }
      return str;
    };

    const csvRows = [headers.join(',')];

    orders.forEach((o: any) => {
      const row = [
        escapeCSV(o.orderCode),
        escapeCSV(o.customer?.name),
        escapeCSV(o.customer?.phone),
        escapeCSV(o.customer?.facebook),
        escapeCSV(o.customer?.telegram),
        escapeCSV(o.service?.name),
        escapeCSV(o.packageName),
        o.durationDays,
        escapeCSV(o.accountEmail),
        escapeCSV(o.accountPassword),
        escapeCSV(o.supplierSourceName),
        o.salePrice,
        o.costPrice,
        o.profit,
        escapeCSV(new Date(o.startDate).toLocaleDateString('vi-VN')),
        escapeCSV(new Date(o.endDate).toLocaleDateString('vi-VN')),
        escapeCSV(o.status),
        escapeCSV(o.note)
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\r\n');

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="don_hang.csv"',
      },
    });
  } catch (error: any) {
    console.error('Export orders error:', error);
    return new Response(error.message || 'Đã xảy ra lỗi', { status: 500 });
  }
}
