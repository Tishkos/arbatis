/**
 * Authentication Server Actions
 * Application layer for auth operations
 */

'use server';

import { z } from 'zod';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Signup action
 */
export async function signupAction(input: SignupInput) {
  try {
    // Validate input
    const validated = signupSchema.parse(input);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return {
        success: false,
        error: 'Email already registered',
      };
    }

    // Hash password
    const passwordHash = await hashPassword(validated.password);

    // Create user with PENDING status
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        passwordHash,
        name: validated.name,
        phone: validated.phone,
        status: 'PENDING',
        role: 'VIEWER',
      },
    });

    logger.info('User signed up', undefined, { userId: user.id, email: user.email });

    // TODO: Send approval email to developer/admin

    return {
      success: true,
      message: 'Signup successful. Please wait for approval.',
    };
  } catch (error) {
    logger.error('Signup error', undefined, { error });
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0]?.message || 'Validation error',
      };
    }

    return {
      success: false,
      error: 'An error occurred during signup',
    };
  }
}


