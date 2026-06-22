import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      accountTier: string;
      image?: string | null;
    };
  }

  interface User {
    role?: string;
    accountTier?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    accountTier: string;
  }
}
