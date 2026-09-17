'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import { type LiquidacionState, liquidarAction } from '@/app/actions/liquidar'
import { toastManager } from '@/components/ui/toast'
import { formatCOP } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

type Saldo = {
  venueId: string
  slug: string
  nombre: string
  saldo: number
  movimientos: number
}

export function CuentasCola({ saldos }: { saldos: Saldo[] }) {
  const conSaldo = saldos.filter((s) => s.saldo !== 0)
  const alDia = saldos.filter((s) => s.saldo === 0)

  return (
    <div className='flex flex-col gap-10'>
      <section>
        <h2 className='font-display text-label-lg uppercase'>
          Con saldo abierto ({conSaldo.length})
        </h2>
        {conSaldo.length === 0 ? (
          <p className='mt-3 rounded-xl border border-border border-dashed p-6 text-center text-body-md text-muted-foreground'>
            Todos cuadrados. Es lo que se espera cuando se vende parejo por los dos lados.
          </p>
        ) : (
          <ul className='mt-3 flex flex-col gap-4'>
            {conSaldo.map((s) => (
              <Fila key={s.venueId} saldo={s} />
            ))}
          </ul>
        )}
      </section>

      {alDia.length > 0 ? (
        <section>
          <h2 className='font-display text-label-lg uppercase text-muted-foreground'>
            Al día ({alDia.length})
          </h2>
          <ul className='mt-3 flex flex-col divide-y divide-border rounded-xl border border-border'>
            {alDia.map((s) => (
              <li key={s.venueId} className='flex justify-between p-4'>
                <Link href={`/sitios/${s.slug}`} className='text-body-md hover:underline'>
                  {s.nombre}
                </Link>
                <span className='text-muted-foreground text-sm'>
                  {s.movimientos} movimiento{s.movimientos === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Fila({ saldo }: { saldo: Saldo }) {
  const router = useRouter()
  const [estado, liquidar, enviando] = useActionState<LiquidacionState, FormData>(liquidarAction, {
    status: 'idle',
  })
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (estado.status === 'success') {
      toastManager.add({ title: estado.mensaje, type: 'success' })
      setAbierto(false)
      router.refresh()
    }
    if (estado.status === 'error') {
      toastManager.add({ title: 'No se pudo', description: estado.error, type: 'error' })
    }
  }, [estado, router])

  const nosDebe = saldo.saldo > 0
  const monto = Math.abs(saldo.saldo)

  return (
    <li className='rounded-xl border border-border bg-card p-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <Link
            href={`/sitios/${saldo.slug}`}
            className='font-display font-bold text-lg hover:underline'
          >
            {saldo.nombre}
          </Link>
          <p className='mt-0.5 text-muted-foreground text-sm'>
            {saldo.movimientos} movimiento{saldo.movimientos === 1 ? '' : 's'}
          </p>
        </div>
        <div className='text-right'>
          <p className='font-display text-label-lg uppercase text-muted-foreground'>
            {nosDebe ? 'Nos debe' : 'Le debemos'}
          </p>
          <p
            className={cn('font-display font-black text-2xl', nosDebe ? 'text-party' : 'text-lime')}
          >
            {formatCOP(monto)}
          </p>
        </div>
      </div>

      {abierto ? (
        <form action={liquidar} className='mt-4 flex flex-col gap-3 border-border border-t pt-4'>
          <input type='hidden' name='venueId' value={saldo.venueId} />
          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='flex flex-col gap-1'>
              <span className='font-display text-label-lg uppercase'>Cuánto se movió</span>
              {/* Se rellena con el saldo entero porque es lo que se hace el 95%
                  de las veces, pero se deja editar: a veces se abona a medias. */}
              <input
                name='monto'
                type='number'
                min={1}
                step={1}
                required
                defaultValue={monto}
                className='rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none'
              />
            </label>
            <label className='flex flex-col gap-1'>
              <span className='font-display text-label-lg uppercase'>Cómo</span>
              <select
                name='metodo'
                defaultValue='transferencia'
                className='rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none'
              >
                <option value='transferencia'>Transferencia</option>
                <option value='efectivo'>Efectivo</option>
                <option value='otro'>Otro</option>
              </select>
            </label>
          </div>
          <label className='flex flex-col gap-1'>
            <span className='font-display text-label-lg uppercase'>Referencia</span>
            <input
              name='referencia'
              placeholder='Número del comprobante'
              className='rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none'
            />
          </label>

          {nosDebe ? (
            <p className='rounded-lg border border-lime bg-lime/5 p-3 text-body-md'>
              Al registrarlo se crea un aporte verificado del sitio y entra a lo que se ve en
              /transparencia.
            </p>
          ) : null}

          <div className='flex gap-2'>
            <button
              type='submit'
              disabled={enviando}
              className='rounded-lg bg-primary px-5 py-2 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-50'
            >
              {enviando ? 'Guardando…' : 'Registrar'}
            </button>
            <button
              type='button'
              onClick={() => setAbierto(false)}
              className='rounded-lg border border-border px-5 py-2 font-display text-label-lg uppercase'
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type='button'
          onClick={() => setAbierto(true)}
          className='mt-4 rounded-lg border border-border px-4 py-2 font-display text-label-lg uppercase transition-colors hover:border-primary'
        >
          {nosDebe ? 'Ya nos pagó' : 'Ya le pagamos'}
        </button>
      )}
    </li>
  )
}
