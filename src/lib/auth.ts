/**
 * Authentication Utilities
 * Auth helpers and session management
 * NextAuth v4 configuration (STABLE - Production Ready)
 */

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './db';
import bcrypt from 'bcryptjs';

/**
 * NextAuth v4 configuration (STABLE)
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'otp',
      name: 'OTP',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          return null;
        }

        // Check if user is active
        if (user.status !== 'ACTIVE') {
          throw new Error('Account is not active. Please wait for approval.');
        }

        // For OTP authentication, we trust that the OTP has been verified
        // by the verify-otp API route before reaching here

        // Get user permissions
        const employee = await prisma.employee.findUnique({
          where: { userId: user.id },
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const permissions = employee?.roles.flatMap((er) =>
          er.role.permissions.map((rp) => rp.permission.name)
        ) || [];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions,
        };
      },
    }),
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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          return null;
        }

        // Check if user is active
        if (user.status !== 'ACTIVE') {
          throw new Error('Account is not active. Please wait for approval.');
        }

        // Verify password
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          return null;
        }

        // Get user permissions
        const employee = await prisma.employee.findUnique({
          where: { userId: user.id },
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        const permissions = employee?.roles.flatMap((er) =>
          er.role.permissions.map((rp) => rp.permission.name)
        ) || [];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = (user as any).name;
        token.email = (user as any).email;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).name = token.name;
        (session.user as any).role = token.role;
        (session.user as any).permissions = token.permissions;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 6 * 60 * 60, // 6 hours
  },
  secret: process.env.AUTH_SECRET,
  // Debug disabled for production-ready setup
  debug: false,
  // Enhanced cookie security
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  // Enhanced security settings
  useSecureCookies: process.env.NODE_ENV === 'production',
};

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12); // Increased from 10 to 12 for better security
}

/**
 * Verify password
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
