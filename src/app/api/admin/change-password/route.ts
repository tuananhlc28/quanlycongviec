import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 401 });
    }

    // Only allow admin or staff
    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN' && userRole !== 'STAFF') {
      return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Mật khẩu mới phải từ 6 ký tự trở lên' }, { status: 400 });
    }

    // Fetch user from DB
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'Người dùng không tồn tại' }, { status: 404 });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, dbUser.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Mật khẩu hiện tại không chính xác' }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Save user
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (error: any) {
    console.error('Password change API error:', error);
    return NextResponse.json({ error: 'Lỗi máy chủ nội bộ' }, { status: 500 });
  }
}
