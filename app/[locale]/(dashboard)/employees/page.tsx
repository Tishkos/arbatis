import { EmployeesTable } from "@/components/employees-table"

export default async function EmployeesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params

  return <EmployeesTable />
}

