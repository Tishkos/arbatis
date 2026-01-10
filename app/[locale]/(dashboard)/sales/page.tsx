import { SalesPage } from "@/components/sales-page"

export default async function SalesRoute({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!locale) {
    return <div>Invalid locale</div>
  }

  return <SalesPage locale={locale} />
}

