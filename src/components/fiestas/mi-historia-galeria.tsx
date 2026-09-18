'use client'

import { EyeIcon, EyeOffIcon, Trash2Icon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { setPhotoVisibilityAction, unclaimPhotoAction } from '@/app/actions/fiestas'
import { toastManager } from '@/components/ui/toast'
import type { ClaimedPhoto } from '@/lib/fiestas/types'
import { cn } from '@/lib/utils/css'
import { formatDate } from '@/lib/utils/format'

/**
 * Las fotos que la persona guardo, agrupadas por noche.
 *
 * Cada foto trae su propio interruptor de visibilidad. Es deliberado que no
 * exista un "hacer publicas todas": el consentimiento sobre una foto en la que
 * sale tu cara se da foto por foto, y un boton que las publica todas de un
 * golpe es exactamente como se cometen esos errores.
 */
export function MiHistoriaGaleria({ fotos }: { fotos: ClaimedPhoto[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const porNoche = new globalThis.Map<string, ClaimedPhoto[]>()
  for (const foto of fotos) {
    const lista = porNoche.get(foto.nightId) ?? []
    lista.push(foto)
    porNoche.set(foto.nightId, lista)
  }

  const correr = (accion: () => Promise<{ ok: boolean; error?: string }>, exito: string) => {
    startTransition(async () => {
      const resultado = await accion()
      if (resultado.ok) {
        router.refresh()
        toastManager.add({ title: exito, type: 'success' })
        return
      }
      toastManager.add({
        title: 'No se pudo',
        description: resultado.error,
        type: 'error',
      })
    })
  }

  return (
    <section className="mx-auto mt-12 flex max-w-5xl flex-col gap-10">
      <h2 className="font-display font-extrabold text-headline-md uppercase">Tus noches</h2>

      {[...porNoche.entries()].map(([nightId, delaNoche]) => {
        const primera = delaNoche[0]
        return (
          <div key={nightId} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-secondary border-b pb-2">
              <h3 className="font-display font-bold text-xl uppercase tracking-tight">
                <Link
                  href={`/sitios/${primera.venueSlug}`}
                  className="transition-colors hover:text-party"
                >
                  {primera.venueName}
                </Link>
              </h3>
              <p className="font-display text-label-sm text-muted-foreground uppercase">
                {formatDate(primera.happenedAt)}
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {delaNoche.map((foto) => (
                <li
                  key={foto.photoId}
                  className="overflow-hidden rounded-xl border-2 border-border bg-card"
                >
                  <Image
                    src={foto.url}
                    alt={foto.caption ?? `Foto en ${primera.venueName}`}
                    width={400}
                    height={176}
                    className="h-44 w-full object-cover"
                    loading="lazy"
                  />

                  {foto.soloMia ? (
                    <p className="border-border border-b bg-surface-container-lowest px-3 py-2 text-muted-foreground text-xs">
                      El sitio la quitó de su noche. Sigue acá, solo para ti.
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between gap-2 p-3">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        correr(
                          () => setPhotoVisibilityAction(foto.photoId, !foto.showPublicly),
                          foto.showPublicly ? 'Foto ocultada' : 'Foto visible en tu perfil'
                        )
                      }
                      aria-pressed={foto.showPublicly}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-2 py-1 font-display text-label-sm uppercase transition-colors disabled:opacity-50',
                        foto.showPublicly
                          ? 'border-lime bg-lime/10 text-lime'
                          : 'border-secondary text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {foto.showPublicly ? (
                        <EyeIcon className="size-4" />
                      ) : (
                        <EyeOffIcon className="size-4" />
                      )}
                      {foto.showPublicly ? 'Publica' : 'Privada'}
                    </button>

                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        correr(() => unclaimPhotoAction(foto.photoId), 'Foto quitada')
                      }
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2Icon className="size-4" />
                      <span className="sr-only">Quitar de mi historia</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
