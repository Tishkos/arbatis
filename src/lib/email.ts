/**
 * Email utilities
 * Sends emails using nodemailer
 */

import nodemailer from 'nodemailer';

// Create transporter from environment variables
// Note: EMAIL_PASS might be base64 encoded - nodemailer will handle it
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || process.env.SMTP_HOST,
  port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '465'),
  secure: process.env.EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || process.env.SMTP_USER,
    pass: process.env.EMAIL_PASS || process.env.SMTP_PASSWORD,
  },
});

const fromEmail = process.env.EMAIL_FROM || 'no-reply@arb-groups.com';

/**
 * Email content by locale
 */
const emailContent = {
  en: {
    subject: 'Your Arbati Login Verification Code',
    greeting: 'Hello,',
    body: "You've requested to log in to Arbati. Use the following verification code:",
    expires: 'This code will expire in 15 minutes.',
    ignore: "If you didn't request this code, please ignore this email.",
    regards: 'Best regards,',
    team: 'The Arbati Team',
    fontFamily: 'Arial, sans-serif',
  },
  ar: {
    subject: 'رمز التحقق لتسجيل الدخول إلى عربتي',
    greeting: 'مرحباً،',
    body: 'لقد طلبت تسجيل الدخول إلى عربتي. استخدم رمز التحقق التالي:',
    expires: 'سينتهي صلاحية هذا الرمز خلال 15 دقيقة.',
    ignore: 'إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد الإلكتروني.',
    regards: 'مع أطيب التحيات،',
    team: 'فريق عربتي',
    fontFamily: 'Arial, sans-serif', // Engar font for Arabic
  },
  ku: {
    subject: 'کۆدی پشتڕاستکردنەوەی چوونەژوورەوەی ئەربەتی',
    greeting: 'سڵاو،',
    body: 'تۆ داوات لە چوونەژوورەوەی ئەربەتی کردووە. کۆدی پشتڕاستکردنەوەی خوارەوە بەکاربهێنە:',
    expires: 'ئەم کۆدە لە ماوەی 15 خولەکدا دەبێتە بەکارنەهاتوو.',
    ignore: 'ئەگەر تۆ ئەم کۆدەت داوە نەکردووە، تکایە ئەم ئیمەیڵە پشتگوێ بخە.',
    regards: 'بە باشترین شێوە،',
    team: 'تیمی ئەربەتی',
    fontFamily: 'Arial, sans-serif', // Kurdish font for Kurdish
  },
};

/**
 * Send OTP email with locale support
 */
export async function sendOTPEmail(to: string, otp: string, locale: 'en' | 'ar' | 'ku' = 'en'): Promise<void> {
  try {
    const content = emailContent[locale];
    const isRTL = locale === 'ar' || locale === 'ku';
    
    await transporter.sendMail({
      from: fromEmail,
      to,
      subject: content.subject,
      html: `
        <!DOCTYPE html>
        <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${locale}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: ${content.fontFamily}; max-width: 600px; margin: 0 auto; padding: 20px; direction: ${isRTL ? 'rtl' : 'ltr'};">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">${content.subject}</h1>
          </div>
          <p>${content.greeting}</p>
          <p>${content.body}</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="font-size: 32px; letter-spacing: 8px; margin: 0; color: #000; direction: ltr; text-align: center;">${otp}</h1>
          </div>
          <p>${content.expires}</p>
          <p>${content.ignore}</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">${content.regards}<br>${content.team}</p>
        </body>
        </html>
      `,
      text: `
        ${content.subject}
        
        ${content.greeting}
        
        ${content.body}
        
        ${otp}
        
        ${content.expires}
        
        ${content.ignore}
        
        ${content.regards}
        ${content.team}
      `,
    });
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw new Error('Failed to send verification email');
  }
}
