/**
 * Verify OTP API Route
 * Verifies the OTP code and creates/updates user if needed
 * Returns success - client will use NextAuth to sign in
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, accessToken } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!otp || typeof otp !== 'string' || otp.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid OTP format. Must be 6 digits' },
        { status: 400 }
      );
    }

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      );
    }

    // Find the OTP token by access token and verify email matches
    const otpToken = await prisma.otpToken.findUnique({
      where: {
        accessToken: accessToken,
      },
    });

    if (!otpToken || otpToken.email !== email) {
      return NextResponse.json(
        { error: 'Invalid token or email mismatch' },
        { status: 400 }
      );
    }

    // Verify OTP matches
    if (otpToken.token !== otp) {
      return NextResponse.json(
        { error: 'Invalid OTP' },
        { status: 400 }
      );
    }

    if (!otpToken) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    if (new Date() > otpToken.expiresAt) {
      // Mark as used (cleanup)
      await prisma.otpToken.update({
        where: { id: otpToken.id },
        data: { used: true },
      });

      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await prisma.otpToken.update({
      where: { id: otpToken.id },
      data: { used: true },
    });

    // Check if user exists in database
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // If user doesn't exist, create a new user
    if (!user) {
      // Generate a random password hash (user won't use password login, only OTP)
      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: email.split('@')[0], // Use email prefix as name
          status: 'ACTIVE', // Auto-activate for @arb-groups.com emails
          role: 'EMPLOYEE',
        },
      });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Your account is not active. Please contact an administrator.' },
        { status: 403 }
      );
    }

    // Return success - client will handle authentication via NextAuth
    return NextResponse.json(
      {
        success: true,
        email: user.email,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP. Please try again.' },
      { status: 500 }
    );
  }
}

