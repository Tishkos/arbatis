import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { StatisticsCharts } from "@/components/statistics-charts"
import { DashboardInvoicesTable } from "@/components/dashboard-invoices-table"
import { SectionCards } from "@/components/section-cards"
import { ApplicationsGrid } from "@/components/applications-grid"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params; // Ensure params is awaited (required in Next.js 16)

  return (
    <>
      <ApplicationsGrid />
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <StatisticsCharts locale={locale} />
    </>
  )
}
