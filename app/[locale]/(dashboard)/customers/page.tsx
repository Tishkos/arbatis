import { CustomersTable } from "@/components/customers-table"

export default async function CustomersPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params

  return <CustomersTable />
}

