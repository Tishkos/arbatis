"use client"

import * as React from "react"
import { SalesInvoiceTabs } from "@/components/sales-invoice-tabs"

interface SalesInvoicePageProps {
  locale: string
  saleType: "wholesale-product" | "retail-product" | "wholesale-motorcycle" | "retail-motorcycle"
  title: string
}

export function SalesInvoicePage({ locale, saleType, title }: SalesInvoicePageProps) {
  return (
    <SalesInvoiceTabs
      locale={locale}
      saleType={saleType}
      title={title}
    />
  )
}

