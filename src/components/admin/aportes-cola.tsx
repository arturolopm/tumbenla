'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { type AporteState, verificarAporteAction } from '@/app/actions/aportes'
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
  verifiedNote: string | null
  purchaseId: string | null
  createdAt: string
  venueSlug: string
  venueNombre: string
  quienMando: string | null
}

type Compra = { id: string; title: string; purchasedAt: string }

export function AportesCola({ aportes, compras }: { aportes: Aporte[]; compras: Compra[] }) {
  const router = useRouter()
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [compra, setCompra] = useState<Record<string, string>>({})
  const [pendiente, startTransition] = useTransition()

  const pendientes = aportes.filter((a) => a.status === 'submitted')
  const resueltos = aportes.filter((a) => a.status !== 'submitted')

  const resolver = (id: string, decision: 'verified' | 'rejected') => {
    startTransition(async () => {
      const r: AporteState = await verificarAporteAction(
        id,
        decision,
        notas[id],
        decision === 'verified' ? compra[id] : undefined
      )
      if (r.status === 'success') {
        toastManager.add({ title: r.mensaje, type: 'success' })
        router.refresh()
      } else if (r.status === 'error') {
        toastManager.add({ title: 'No se pudo', description: r.error, type: 'error' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-display font-bold text-headline-md uppercase">
          Por verificar ({pendientes.length})
        </h2>

        {pendientes.length === 0 ? (
          <p className="mt-3 text-body-md text-muted-foreground">Nada por revisar.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pendientes.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/panel/${a.venueSlug}/aportes`}
                      className="font-display font-bold uppercase hover:text-primary-text"
                    >
                      {a.venueNombre}
                    </Link>
                    <p className="text-muted-foreground text-sm">
                      {formatDate(new Date(a.periodStart))} –{' '}
                      {formatDate(new Date(a.periodEnd))}
                      {a.quienMando ? ` · lo mandó ${a.quienMando}` : ''}
                    </p>
                  </div>
                  <p className="font-display font-black text-2xl tabular-nums">
                    {formatCOP(Number.parseFloat(a.amount), a.currency)}
                  </p>
                </div>

                {a.note ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border p-3 text-body-md">
                    {a.note}
                  </p>
                ) : null}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-muted-foreground text-sm">
                    Qué compra financió (opcional)
                    <select
                      value={compra[a.id] ?? ''}
                      onChange={(e) => setCompra((c) => ({ ...c, [a.id]: e.target.value }))}
                      className="rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none"
                    >
                      <option value="">Todavía no se gastó</option>
                      {compras.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} · {formatDate(new Date(c.purchasedAt))}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-muted-foreground text-sm">
                    Cómo lo confirmaste
                    <input
                      value={notas[a.id] ?? ''}
                      onChange={(e) => setNotas((n) => ({ ...n, [a.id]: e.target.value }))}
                      placeholder="Transferencia vista el 3 de septiembre"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none"
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => resolver(a.id, 'verified')}
                    className="rounded-lg bg-primary px-4 py-2 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-50"
                  >
                    Verificar y publicar
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => resolver(a.id, 'rejected')}
                    className="rounded-lg border border-border px-4 py-2 font-display text-label-lg uppercase text-muted-foreground transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resueltos.length > 0 ? (
        <section>
          <h2 className="font-display font-bold text-headline-md uppercase">Ya resueltos</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {resueltos.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border border-dashed p-4"
              >
                <span>
                  <span className="font-medium">{a.venueNombre}</span>{' '}
                  <span className="text-muted-foreground text-sm">
                    · {formatCOP(Number.parseFloat(a.amount), a.currency)}
                  </span>
                </span>
                <span
                  className={
                    a.status === 'verified'
                      ? 'text-lime text-xs uppercase'
                      : 'text-muted-foreground text-xs uppercase'
                  }
                >
                  {a.status === 'verified' ? 'Verificado' : 'Rechazado'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
