import { MotorcyclesTable } from "@/components/motorcycles-table"

export default async function MotorcyclesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params

  return <MotorcyclesTable />
}

