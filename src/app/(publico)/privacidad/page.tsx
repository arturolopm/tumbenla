import type { Metadata } from 'next'

import { getBrandConfig } from '@/config/branding'
import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Privacidad',
  description: 'Que datos recogemos y cuales no.',
  canonical: '/privacidad',
})

export default function PrivacidadPage() {
  const brand = getBrandConfig()

  return (
    <div className="mx-auto w-full max-w-3xl px-margin-mobile py-section-gap lg:px-margin-desktop">
      <h1 className="text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-5xl">Privacidad</h1>

      <div className="mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
        Esta politica todavia no ha pasado por revision legal. Describe lo que hacemos hoy,
        de forma honesta, pero no reemplaza un documento redactado por un abogado ni sustituye
        lo que exige la Ley 1581 de 2012.
      </div>

      <div className="mt-10 flex flex-col gap-8 leading-relaxed text-muted-foreground">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground text-xl">Para navegar no pedimos nada</h2>
          <p className="max-w-prose text-pretty">
            Ver la lista de sitios, el mapa y las compras no requiere cuenta. No pedimos correo
            ni telefono para nada de eso.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground text-xl">Cuentas</h2>
          <p className="max-w-prose text-pretty">
            Las unicas cuentas que existen son las del equipo que administra el sitio. De esas
            guardamos correo y nombre, y nada mas.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground text-xl">Fotos de las compras</h2>
          <p className="max-w-prose text-pretty">
            En las compras publicamos facturas y fotos del material. No publicamos direcciones
            exactas ni nombres de las personas que reciben la ayuda: la ubicacion se muestra a
            nivel de municipio. Una foto solo se publica si quien aparece en ella dio permiso.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground text-xl">Si quieres que quitemos algo</h2>
          <p className="max-w-prose text-pretty">
            Escribenos y lo quitamos. No hace falta explicar por que.
          </p>
          {brand.supportEmail ? (
            <p>
              <a href={`mailto:${brand.supportEmail}`} className="text-primary-text hover:underline">
                {brand.supportEmail}
              </a>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
