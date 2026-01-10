import { ProductsTable } from "@/components/products-table"

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params

  return <ProductsTable />
}




