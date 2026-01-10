'use client';

import { useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getTextDirection } from '@/lib/i18n';
import { GalleryVerticalEnd } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldError,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import 'flag-icons/css/flag-icons.min.css';

interface LoginFormProps extends React.ComponentProps<'div'> {
  className?: string;
}

export function LoginForm({ className, ...props }: LoginFormProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || 'ku';
  const t = useTranslations('auth');
  const tLang = useTranslations('language');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleLocaleChange = (newLocale: string) => {
    // Replace the locale in the current pathname
    const pathWithoutLocale = pathname.replace(/^\/(ku|en|ar)/, '') || '/login';
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  const validateEmail = (emailValue: string) => {
    if (!emailValue || !emailValue.trim()) {
      return false;
    }
    if (!emailValue.endsWith('@arb-groups.com')) {
      return false;
    }
    return true;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setEmailError(null); // Clear previous error

 
  
    // Validate email - only show error on submit
    if (!validateEmail(email)) {
      setEmailError(t('invalidEmail'));
      setIsLoading(false);
      return;
    }

    try {
      // Send OTP email
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, locale }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('otp.failed'));
        setIsLoading(false);
        return;
      }

      // Redirect to OTP page with token
      if (data.token) {
        router.push(`/${locale}/otp?token=${data.token}`);
      } else {
        setError(t('otp.failed'));
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError(t('otp.failed'));
      setIsLoading(false);
    }
  };

  // Get font class based on current locale
  const fontClass = locale === 'ku' ? 'font-kurdish' : 'font-engar';
  // Get text direction based on current locale
  const direction = getTextDirection(locale as 'ku' | 'en' | 'ar');

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      {/* Language Dropdown - Top Right */}
      <div className={cn("flex", direction === 'rtl' ? 'justify-start' : 'justify-end')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={fontClass}>{tLang('label')}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className={cn("w-56", fontClass)} 
            style={{ direction } as React.CSSProperties}
          >
            <DropdownMenuLabel>{tLang('title')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={locale} onValueChange={handleLocaleChange}>
              <DropdownMenuRadioItem value="ku" className="font-kurdish">
                <div className="flex items-center gap-2">
                  <span className="fi fi-tj"></span>
                  <span>{tLang('kurdish')}</span>
                </div>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="ar" className="font-engar">
                <div className="flex items-center gap-2">
                  <span className="fi fi-iq"></span>
                  <span>{tLang('arabic')}</span>
                </div>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="en" className="font-engar">
                <div className="flex items-center gap-2">
                  <span className="fi fi-gb"></span>
                  <span>{tLang('english')}</span>
                </div>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
              onClick={(e) => {
                e.preventDefault();
                router.push(`/${locale}`);
              }}
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
            <h1 className="text-xl font-bold">{t('welcome')}</h1>
          </div>

          {error && <FieldError>{error}</FieldError>}

          <Field>
            <FieldLabel htmlFor="email">{t('email')}</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Clear error when user starts typing
                if (emailError) {
                  setEmailError(null);
                }
              }}
              disabled={isLoading}
              className={cn(
                "h-12 text-base",
                emailError && "border-destructive focus-visible:ring-destructive"
              )}
              aria-invalid={emailError ? true : undefined}
            />
            {emailError && (
              <FieldError>{emailError}</FieldError>
            )}
          </Field>

          <Field>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner className="size-4" />
                  {t('signingIn')}
                </>
              ) : (
                t('login')
              )}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}

