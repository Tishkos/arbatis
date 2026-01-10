/**
 * Get Email by Token API Route
 * Returns the email associated with a valid access token
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Find OTP token by access token
    const otpToken = await prisma.otpToken.findUnique({
      where: {
        accessToken: token,
      },
    });

    if (!otpToken) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    if (new Date() > otpToken.expiresAt) {
      return NextResponse.json(
        { error: 'Token has expired' },
        { status: 400 }
      );
    }

    // Check if OTP has been used
    if (otpToken.used) {
      return NextResponse.json(
        { error: 'Token has already been used' },
        { status: 400 }
      );
    }

    // Return email
    return NextResponse.json(
      { email: otpToken.email },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting email:', error);
    return NextResponse.json(
      { error: 'Failed to verify token' },
      { status: 500 }
    );
  }
}

