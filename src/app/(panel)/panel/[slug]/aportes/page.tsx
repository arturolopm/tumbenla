import { redirect } from 'next/navigation'

/** El auto-reporte se retiro. Conservamos la URL para enlaces antiguos. */
export default async function AportesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/panel/${slug}/cuenta`)
}
