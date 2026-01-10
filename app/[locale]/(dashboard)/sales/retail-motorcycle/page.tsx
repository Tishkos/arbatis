import { SalesInvoicePage } from "@/components/sales-invoice-page"
import { getTranslations } from "next-intl/server"

export default async function RetailMotorcyclePage({
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
        saleType="retail-motorcycle" 
        title={t('retailMotorcycle.title')}
      />
    </div>
  )
}

