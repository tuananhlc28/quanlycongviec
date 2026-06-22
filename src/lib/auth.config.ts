import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  providers: [], // To be filled in auth.ts (Node.js runtime)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role as string;
        token.theme = (user as any).theme as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).theme = token.theme as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
