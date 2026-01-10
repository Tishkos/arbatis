/**
 * NextAuth API Route
 * Handles authentication requests
 * NextAuth v4 route handler (STABLE)
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

// NextAuth v4 route handler
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
