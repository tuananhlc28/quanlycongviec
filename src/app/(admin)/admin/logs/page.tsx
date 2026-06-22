import prisma from '@/lib/prisma';
import LogsView from './LogsView';

export const revalidate = 0;

export default async function AdminLogsPage() {
  const [services, sources] = await Promise.all([
    prisma.service.findMany({ where: { isDeleted: false }, select: { id: true, name: true } }),
    prisma.supplierSource.findMany({ where: { isDeleted: false }, select: { id: true, name: true } }),
  ]);

  return (
    <LogsView services={services} sources={sources} />
  );
}
