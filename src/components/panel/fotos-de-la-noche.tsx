'use client'

import { EyeOffIcon, Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { type NocheState, borrarFotoAction, moderarFotoAction } from '@/app/actions/noches'
import { SubirFotos } from '@/components/fiestas/subir-fotos'
import { toastManager } from '@/components/ui/toast'

type Foto = {
  id: string
  url: string
  caption: string | null
  status: string
  source: string
  createdAt: string
  reclamos: number
}

const ESTADO: Record<string, string> = {
  pending: 'Sin habilitar',
  available: 'Visible',
  hidden: 'Retirada',
}

export function FotosDeLaNoche({ nightId, fotos }: { nightId: string; fotos: Foto[] }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()

  const correr = (accion: () => Promise<NocheState>) => {
    startTransition(async () => {
      const r = await accion()
      if (r.status === 'success') {
        toastManager.add({ title: r.mensaje, type: 'success' })
        router.refresh()
      } else if (r.status === 'error') {
        toastManager.add({ title: 'No se pudo', description: r.error, type: 'error' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <SubirFotos
        nightId={nightId}
        publicarDeUna
        ayuda="Las que subas tú quedan visibles de una. Máximo 15 MB cada una."
      />

      {fotos.length === 0 ? (
        <p className="text-body-md text-muted-foreground">Todavía no hay fotos en esta noche.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {fotos.map((foto) => (
            <li key={foto.id} className="overflow-hidden rounded-xl border border-border bg-card">
              {/* <img> plano y no next/image: el host de R2 solo entra en
                  remotePatterns cuando la variable existe en el build, y en un
                  entorno sin R2 next/image romperia la pagina entera. */}
              <img
                src={foto.url}
                alt={foto.caption ?? ''}
                className="aspect-square w-full object-cover"
              />
              <div className="flex flex-col gap-2 p-3">
                <p className="text-muted-foreground text-xs uppercase">
                  {ESTADO[foto.status] ?? foto.status}
                  {foto.source === 'guest' ? ' · la subió alguien' : ''}
                  {foto.reclamos > 0 ? ` · ${foto.reclamos} la guardaron` : ''}
                </p>
                <div className="flex flex-wrap gap-1">
                  {foto.status !== 'available' ? (
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => correr(() => moderarFotoAction(foto.id, 'available'))}
                      className="rounded-lg bg-primary px-3 py-1 font-display text-primary-foreground text-xs uppercase disabled:opacity-50"
                    >
                      Habilitar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => correr(() => moderarFotoAction(foto.id, 'hidden'))}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-50"
                    >
                      <EyeOffIcon className="size-3" />
                      Retirar
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => correr(() => borrarFotoAction(foto.id))}
                    aria-label="Borrar la foto"
                    title="Borrar de verdad: el archivo también se va"
                    className="rounded-lg border border-border p-1 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50"
                  >
                    <Trash2Icon className="size-3" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
