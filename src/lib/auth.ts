import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authConfig } from '@/auth.config';
import { isLockedOut, recordFailedAttempt, clearRateLimit } from '@/lib/rate-limit';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;

        // Check if account is locked out
        const lockoutStatus = isLockedOut(email);
        if (lockoutStatus.locked) {
          console.warn(`Login attempt for locked account: ${email}`);
          return null;
        }

        // Import these only in the API route context, not in middleware
        const { prisma } = await import('./db');
        const bcrypt = await import('bcryptjs');

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          // Record failed attempt (account doesn't exist)
          recordFailedAttempt(email, {
            maxRequests: 10,
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxFailures: 5,
            lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
          });
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash
        );

        if (!isPasswordValid) {
          // Record failed attempt (wrong password)
          recordFailedAttempt(email, {
            maxRequests: 10,
            windowMs: 15 * 60 * 1000,
            maxFailures: 5,
            lockoutDurationMs: 15 * 60 * 1000,
          });
          return null;
        }

        // Clear rate limit on successful login
        clearRateLimit(email);

        return {
          id: user.id,
          email: user.email,
          subdomain: user.subdomain,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.subdomain = (user as { subdomain?: string }).subdomain;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { subdomain?: string }).subdomain = token.subdomain as
          | string
          | undefined;
      }
      return session;
    },
  },
});

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 10);
}
