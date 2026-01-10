import { ActivitiesTable } from "@/components/activities-table"

export default async function ActivitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params

  return <ActivitiesTable />
}

