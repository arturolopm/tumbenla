'use client'

import { Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState, useTransition } from 'react'

import {
  type AporteState,
  borrarAporteAction,
  firmarReciboAction,
  guardarAporteAction,
  registrarReciboAction,
} from '@/app/actions/aportes'
import { toastManager } from '@/components/ui/toast'
import { formatCOP, formatDate } from '@/lib/utils/format'

type Aporte = {
  id: string
  periodStart: string
  periodEnd: string
  amount: string
  currency: string
  note: string | null
  status: string
  verifiedAt: string | null
  verifiedNote: string | null
  recibos: number
}

const ESTADO: Record<string, string> = {
  submitted: 'Lo estamos revisando',
  verified: 'Verificado y publicado',
  rejected: 'No lo pudimos confirmar',
}

export function AportesPanel({ venueId, aportes }: { venueId: string; aportes: Aporte[] }) {
  const router = useRouter()
  const [estado, guardar, guardando] = useActionState<AporteState, FormData>(
    guardarAporteAction,
    { status: 'idle' }
  )
  const [pendiente, startTransition] = useTransition()
  const [subiendo, setSubiendo] = useState<string | null>(null)

  useEffect(() => {
    if (estado.status === 'success') {
      toastManager.add({ title: estado.mensaje, type: 'success' })
      router.refresh()
    }
    if (estado.status === 'error') {
      toastManager.add({ title: 'No se pudo', description: estado.error, type: 'error' })
    }
  }, [estado, router])

  const adjuntar = async (contributionId: string, file: File) => {
    setSubiendo(contributionId)
    try {
      const firma = await firmarReciboAction(contributionId, file.type, file.size)
      if (!firma.ok) {
        toastManager.add({ title: 'No se pudo', description: firma.error, type: 'error' })
        return
      }
      const r = await fetch(firma.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      }).catch(() => null)

      if (!r || !r.ok) {
        toastManager.add({
          title: 'No se pudo subir',
          description: 'Revisa el CORS del bucket.',
          type: 'error',
        })
        return
      }

      const reg = await registrarReciboAction({
        contributionId,
        url: firma.publicUrl,
        storageKey: firma.key,
      })
      if (reg.status === 'success') {
        toastManager.add({ title: reg.mensaje, type: 'success' })
        router.refresh()
      } else if (reg.status === 'error') {
        toastManager.add({ title: 'No se pudo', description: reg.error, type: 'error' })
      }
    } finally {
      setSubiendo(null)
    }
  }

  const borrar = (id: string) => {
    startTransition(async () => {
      const r = await borrarAporteAction(id)
      if (r.status === 'success') {
        toastManager.add({ title: r.mensaje, type: 'success' })
        router.refresh()
      } else if (r.status === 'error') {
        toastManager.add({ title: 'No se pudo', description: r.error, type: 'error' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display font-bold text-headline-md uppercase">Reportar un aporte</h2>
        <form action={guardar} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="venueId" value={venueId} />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-muted-foreground text-sm">
              Desde
              <input
                type="date"
                name="periodStart"
                required
                className="rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground text-sm">
              Hasta
              <input
                type="date"
                name="periodEnd"
                required
                className="rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-muted-foreground text-sm">
              Cuánto, en pesos
              <input
                type="number"
                name="amount"
                min="1"
                step="1000"
                required
                className="rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <textarea
            name="note"
            rows={2}
            placeholder="Algo que debamos saber (opcional)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={guardando}
            className="self-start rounded-lg bg-primary px-5 py-2 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Reportar'}
          </button>
        </form>
      </section>

      {aportes.length === 0 ? (
        <p className="text-body-md text-muted-foreground">Todavía no has reportado nada.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {aportes.map((aporte) => (
            <li key={aporte.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display font-black text-2xl tabular-nums">
                    {formatCOP(Number.parseFloat(aporte.amount), aporte.currency)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(new Date(aporte.periodStart))} –{' '}
                    {formatDate(new Date(aporte.periodEnd))}
                  </p>
                </div>
                <span
                  className={
                    aporte.status === 'verified'
                      ? 'text-lime text-xs uppercase'
                      : 'text-muted-foreground text-xs uppercase'
                  }
                >
                  {ESTADO[aporte.status] ?? aporte.status}
                </span>
              </div>

              {aporte.verifiedNote ? (
                <p className="mt-2 text-body-md text-muted-foreground">{aporte.verifiedNote}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-lg border border-border px-3 py-1 text-sm transition-colors hover:border-primary">
                  {subiendo === aporte.id ? 'Subiendo…' : 'Adjuntar recibo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                    disabled={subiendo !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) adjuntar(aporte.id, file)
                      e.target.value = ''
                    }}
                    className="sr-only"
                  />
                </label>
                <span className="text-muted-foreground text-xs">
                  {aporte.recibos} {aporte.recibos === 1 ? 'recibo' : 'recibos'}
                </span>

                {/* Lo verificado ya es registro publico: no se borra desde aca. */}
                {aporte.status !== 'verified' ? (
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => borrar(aporte.id)}
                    aria-label="Borrar el aporte"
                    className="rounded-lg border border-border p-1 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
