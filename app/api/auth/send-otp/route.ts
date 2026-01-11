/**
 * Send OTP API Route
 * Generates a 6-digit OTP, stores it in the database, and sends it via email
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendOTPEmail } from '@/lib/email';
import { randomInt, randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, locale = 'en' } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email is allowed: @arb-groups.com domain OR specific admin email
    const isArbGroupsEmail = email.endsWith('@arb-groups.com');
    const isAdminEmail = email === 'hamajamalsabr@gmail.com';
    
    if (!isArbGroupsEmail && !isAdminEmail) {
      return NextResponse.json(
        { error: 'Only @arb-groups.com emails or authorized admin emails are allowed' },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 999999).toString();

    // Generate access token for OTP page (32 bytes, base64 encoded)
    const accessToken = randomBytes(32).toString('base64url');

    // Calculate expiration time (15 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Delete any existing unused OTPs for this email
    await prisma.otpToken.deleteMany({
      where: {
        email,
        used: false,
      },
    });

    // Store OTP in database with access token
    await prisma.otpToken.create({
      data: {
        email,
        token: otp,
        expiresAt,
        used: false,
        accessToken, // Store access token
      },
    });

    // Send OTP email with locale
    await sendOTPEmail(email, otp, locale as 'en' | 'ar' | 'ku');

    // Return success with access token for URL
    return NextResponse.json(
      { success: true, message: 'OTP sent successfully', token: accessToken },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP. Please try again.' },
      { status: 500 }
    );
  }
}

