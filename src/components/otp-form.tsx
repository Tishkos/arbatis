'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import { GalleryVerticalEnd } from "lucide-react"

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldError,
} from '@/components/ui/field'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { Spinner } from '@/components/ui/spinner'

export function OTPForm({ className, ...props }: React.ComponentProps<"div">) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'ku';
  const t = useTranslations('auth.otp');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    // Check for token in URL
    const token = searchParams.get('token');
    
    if (!token) {
      // No token, redirect to login
      router.push(`/${locale}/login`);
      return;
    }

    // Fetch email using token
    const fetchEmailWithToken = async () => {
      try {
        const response = await fetch(`/api/auth/get-email?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        
        if (!response.ok || !data.email) {
          router.push(`/${locale}/login`);
          return;
        }
        
        setEmail(data.email);
      } catch (err) {
        console.error('Error fetching email:', err);
        router.push(`/${locale}/login`);
      }
    };

    fetchEmailWithToken();
  }, [searchParams, locale, router]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(resendCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleResend = async () => {
    if (resendCountdown > 0 || !email) return;

    setIsResending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, locale }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('failed'));
        setIsResending(false);
        return;
      }

      // Start countdown
      setResendCountdown(60);
      setIsResending(false);

      // Update token in URL if provided
      if (data.token) {
        router.replace(`/${locale}/otp?token=${data.token}`);
      }
    } catch (err) {
      console.error('Error resending OTP:', err);
      setError(t('failed'));
      setIsResending(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!email) {
      setError(t('emailNotFound'));
      setIsLoading(false);
      return;
    }

    if (otp.length !== 6) {
      setError(t('enterComplete'));
      setIsLoading(false);
      return;
    }

    try {
      // Get token from URL
      const token = searchParams.get('token');
      if (!token) {
        router.push(`/${locale}/login`);
        return;
      }

      // Verify OTP
      const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp, accessToken: token }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setError(verifyData.error || t('invalid'));
        setIsLoading(false);
        return;
      }

      // OTP verified, now sign in with NextAuth
      const signInResult = await signIn('otp', {
        email,
        redirect: false,
      });

      if (signInResult?.error) {
        setError(t('failed'));
        setIsLoading(false);
        return;
      }

      if (signInResult?.ok) {
        // Redirect to dashboard
        router.push(`/${locale}/dashboard`);
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError(t('failed'));
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-12 items-center justify-center rounded-md">
                <img 
                  src="/assets/logo/arbati.png" 
                  alt="Arbati" 
                  className="h-12 w-auto dark:brightness-0 dark:invert"
                />
              </div>
              <span className="sr-only">Arbati</span>
            </a>
            <h1 className="text-xl font-bold">{t('title')}</h1>
            <FieldDescription>
              {t('description', { email: email || 'your email address' })}
            </FieldDescription>
          </div>

          {error && <FieldError>{error}</FieldError>}

          <Field>
            <FieldLabel htmlFor="otp" className="sr-only">
              {t('title')}
            </FieldLabel>
            <div dir="ltr" className="flex justify-center">
              <InputOTP
                maxLength={6}
                id="otp"
                value={otp}
                onChange={(value) => setOtp(value)}
                required
                disabled={isLoading}
                containerClassName="gap-4"
              >
                <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:h-16 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:text-xl">
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:h-16 *:data-[slot=input-otp-slot]:w-12 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:text-xl">
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <FieldDescription className="text-center">
              {t('didntReceive')}{' '}
              {resendCountdown > 0 ? (
                <span className="text-muted-foreground">
                  {t('resendCountdown', { seconds: resendCountdown })}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || !email}
                  className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? t('verifying') : t('resend')}
                </button>
              )}
            </FieldDescription>
          </Field>
          <Field>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner className="size-4" />
                  {t('verifying')}
                </>
              ) : (
                t('verify')
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
