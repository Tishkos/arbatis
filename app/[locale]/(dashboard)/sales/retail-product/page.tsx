import { SalesInvoicePage } from "@/components/sales-invoice-page"
import { getTranslations } from "next-intl/server"

export default async function RetailProductPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'navigation.salesOptions' })

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SalesInvoicePage 
        locale={locale} 
        saleType="retail-product" 
        title={t('retailProduct.title')}
      />
    </div>
  )
}

