'use client'

import { CheckIcon, FlagIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { claimPhotoAction, unclaimPhotoAction } from '@/app/actions/fiestas'
import { reportarFotoAction } from '@/app/actions/noches'
import { SubirFotos } from '@/components/fiestas/subir-fotos'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { toastManager } from '@/components/ui/toast'
import { cn } from '@/lib/utils/css'

type Foto = {
  id: string
  url: string
  caption: string | null
  reclamada: boolean
}

/**
 * "Esa soy yo."
 *
 * UNA SOLA ACCION, y guardar una foto es lo que hace que la noche cuente. No
 * hay un "me gusta" que tambien sume: si guardar cualquier foto que te parezca
 * bonita contara como una visita, el aporte estimado de /mi-historia se podria
 * inflar a punta de clics y dejaria de significar lo que dice.
 *
 * El boton de reportar esta al lado del de guardar, no escondido en un menu.
 * Quien sale en una foto que subio otro es justamente quien no tiene ninguna
 * otra forma de pedir que la bajen, y hacerla dificil de encontrar seria
 * decidir por esa persona.
 */
export function GaleriaDeLaNoche({ nightId, fotos }: { nightId: string; fotos: Foto[] }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [reportando, setReportando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const correr = (accion: () => Promise<{ ok?: boolean; status?: string; error?: string }>) => {
    startTransition(async () => {
      const r = await accion()
      const bien = r.ok === true || r.status === 'success'
      if (bien) {
        router.refresh()
        return
      }
      toastManager.add({
        title: 'No se pudo',
        description: r.error,
        type: 'error',
      })
    })
  }

  const enviarReporte = () => {
    if (!reportando) return
    const id = reportando
    startTransition(async () => {
      const r = await reportarFotoAction(id, motivo)
      setReportando(null)
      setMotivo('')
      if (r.status === 'success') {
        toastManager.add({ title: r.mensaje, type: 'success' })
        return
      }
      toastManager.add({
        title: 'No se pudo',
        description: r.status === 'error' ? r.error : undefined,
        type: 'error',
      })
    })
  }

  return (
    <div className="mt-10 flex flex-col gap-10">
      {fotos.length === 0 ? (
        <p className="text-body-md text-muted-foreground">
          Todavía no hay fotos habilitadas de esta noche. Si tienes tuyas, súbelas: el sitio las
          revisa antes de que salgan.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((foto) => (
            <li
              key={foto.id}
              className={cn(
                'overflow-hidden rounded-xl border bg-card',
                foto.reclamada ? 'border-lime' : 'border-border'
              )}
            >
              <img
                src={foto.url}
                alt={foto.caption ?? ''}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />

              <div className="flex items-center gap-1 p-2">
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() =>
                    correr(() =>
                      foto.reclamada ? unclaimPhotoAction(foto.id) : claimPhotoAction(foto.id)
                    )
                  }
                  className={cn(
                    'flex-1 rounded-lg px-2 py-1 font-display text-xs uppercase transition-colors disabled:opacity-50',
                    foto.reclamada
                      ? 'border border-lime text-lime'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  {foto.reclamada ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckIcon className="size-3" />
                      Guardada
                    </span>
                  ) : (
                    'Esa soy yo'
                  )}
                </button>

                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => setReportando(foto.id)}
                  aria-label="Reportar esta foto"
                  title="Salgo yo y no quiero que esté"
                  className="rounded-lg border border-border p-1 text-muted-foreground transition-colors hover:border-primary hover:text-primary-text disabled:opacity-50"
                >
                  <FlagIcon className="size-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-xl border border-border border-dashed p-6">
        <p className="font-display font-bold text-headline-md uppercase">
          ¿Tienes fotos de esa noche?
        </p>
        <div className="mt-3">
          <SubirFotos
            nightId={nightId}
            etiqueta="Subir mis fotos"
            ayuda="El sitio las revisa antes de que salgan. Sube solo fotos tuyas o de gente que esté de acuerdo."
          />
        </div>
      </section>

      <Dialog open={reportando !== null} onOpenChange={(o) => !o && setReportando(null)}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-headline-md uppercase">
              Bajar esta foto
            </DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <p className="text-body-md text-muted-foreground">
              Cuéntale al sitio por qué. Si sales tú y no quieres que esté, con decirlo basta:
              no tienes que demostrar nada.
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none"
            />
          </DialogPanel>
          <DialogFooter>
            <button
              type="button"
              disabled={pendiente}
              onClick={enviarReporte}
              className="rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-50"
            >
              Enviar
            </button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
