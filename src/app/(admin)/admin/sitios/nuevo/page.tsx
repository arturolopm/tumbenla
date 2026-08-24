import { VenueForm } from '@/components/admin/venue-form'

export default function NuevoSitioPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display font-extrabold text-3xl">Agregar un sitio</h1>
        <p className="text-muted-foreground text-sm">
          Queda en borrador hasta que lo pongas en publicado.
        </p>
      </div>

      <VenueForm />
    </div>
  )
}
