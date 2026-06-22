// Prisma client singleton for Next.js with better-sqlite3 adapter
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

function createPrismaClient() {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  const adapter = new PrismaBetterSqlite3({
    url: `file:${dbPath}`,
  });
  return new PrismaClient({ adapter });
}

const prismaBase = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaBase;

export const prisma = prismaBase.$extends({
  query: {
    activityLog: {
      async create({ args, query }: { args: any; query: any }) {
        try {
          const userId = args.data?.userId;
          if (userId) {
            // Check if user exists in database to prevent foreign key errors
            const user = await prismaBase.user.findUnique({
              where: { id: userId },
            });
            if (!user) {
              console.warn(`User ID ${userId} does not exist. Nullifying userId in ActivityLog.`);
              args.data.userId = null;
            }
          }
          return await query(args);
        } catch (error) {
          console.error("Safe Prisma ActivityLog Intercepted Error:", error);
          // Return a mock ActivityLog object so the parent request does not crash
          return {
            id: 'failed-log-' + Date.now(),
            userId: null,
            action: args.data?.action || 'UNKNOWN',
            target: args.data?.target || null,
            details: args.data?.details || null,
            ipAddress: args.data?.ipAddress || null,
            createdAt: new Date(),
          };
        }
      }
    }
  }
});

export default prisma;
