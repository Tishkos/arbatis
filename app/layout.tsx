/**
 * Root Layout
 * REQUIRED: This file MUST import globals.css and include <html> and <body>
 * This is where Tailwind CSS is initialized
 * 
 * This is the ROOT layout - there's also app/[locale]/layout.tsx for i18n
 */

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

// Load custom fonts
// Path is relative to this file (app/layout.tsx), so we go up one level to reach public/
const kurdishFont = localFont({
  src: "../public/assets/fonts/ku.ttf",
  variable: "--font-kurdish",
  display: "swap",
});

const engarFont = localFont({
  src: "../public/assets/fonts/engar.ttf",
  variable: "--font-engar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arbati ERP",
  description: "Production-grade ERP / Sales & Inventory Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className={`${kurdishFont.variable} ${engarFont.variable}`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
