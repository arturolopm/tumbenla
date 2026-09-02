import { PAY_METHOD_LABEL, type PayMethod } from '@/lib/comercio/types'
import { formatCOP, formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

/**
 * La cuenta de un sitio con nosotros.
 *
 * COMPONENTE DE SERVIDOR: no hay nada que tocar aca, solo que leer.
 *
 * EL SIGNO SE EXPLICA EN PALABRAS, NO CON UN MENOS. Un saldo de "-15.000" en
 * pantalla no le dice a nadie quien le debe a quien, y esta es justamente la
 * pantalla donde una duda de esas termina en una llamada. Se escribe de frente:
 * "te debemos" o "nos debes".
 */

type Movimiento = {
  id: string
  fecha: string
  tipo: string
  monto: number
  producto: string | null
  payMethod: PayMethod | null
  liquidado: boolean
}

type Liquidacion = {
  id: string
  fecha: string
  monto: number
  direccion: 'to_venue' | 'from_venue'
  metodo: string | null
  referencia: string | null
  nota: string | null
}

export function CuentaDelSitio({
  saldo,
  movimientos,
  liquidaciones,
}: {
  saldo: number
  movimientos: Movimiento[]
  liquidaciones: Liquidacion[]
}) {
  const nosDebe = saldo > 0
  const alDia = saldo === 0

  return (
    <div className='flex max-w-3xl flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          La cuenta
        </h1>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Lo que se pagó en la app y lo que se pagó en tu barra se cruzan solos. Aquí queda la
          diferencia, y es lo único que se transfiere.
        </p>
      </header>

      <div
        className={cn(
          'rounded-xl border-2 p-6',
          alDia ? 'border-border' : nosDebe ? 'border-party bg-party/5' : 'border-lime bg-lime/5'
        )}
      >
        {alDia ? (
          <>
            <p className='font-display font-black text-2xl uppercase'>Al día</p>
            <p className='mt-1 text-body-md text-muted-foreground'>
              Ni debes ni te debemos. Es lo normal cuando se vende parejo por los dos lados.
            </p>
          </>
        ) : (
          <>
            <p className='font-display text-label-lg uppercase text-muted-foreground'>
              {nosDebe ? 'Nos debes' : 'Te debemos'}
            </p>
            <p
              className={cn(
                'font-display font-black text-4xl',
                nosDebe ? 'text-party' : 'text-lime'
              )}
            >
              {formatCOP(Math.abs(saldo))}
            </p>
            <p className='mt-2 text-body-md text-muted-foreground'>
              {nosDebe
                ? 'Es la parte de material de lo que cobraste en la barra. Te escribimos para cuadrar.'
                : 'Es tu parte de lo que se pagó en la app. Te la transferimos.'}
            </p>
          </>
        )}
      </div>

      <section>
        <h2 className='font-display text-label-lg uppercase'>De dónde sale</h2>
        {movimientos.length === 0 ? (
          <p className='mt-3 rounded-xl border border-border border-dashed p-6 text-center text-body-md text-muted-foreground'>
            Todavía no se ha vendido nada de la carta.
          </p>
        ) : (
          <ul className='mt-3 flex flex-col divide-y divide-border rounded-xl border border-border'>
            {movimientos.map((m) => (
              <li key={m.id} className='flex items-center justify-between gap-4 p-4'>
                <div className='min-w-0'>
                  <p className='truncate text-body-md'>
                    {m.producto ?? (m.tipo === 'settlement' ? 'Liquidación' : 'Ajuste')}
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    {formatDate(new Date(m.fecha))}
                    {m.payMethod ? ` · ${PAY_METHOD_LABEL[m.payMethod]}` : null}
                    {m.liquidado ? ' · ya cuadrado' : null}
                  </p>
                </div>
                <p
                  className={cn(
                    'whitespace-nowrap font-display font-bold',
                    m.monto > 0 ? 'text-party' : 'text-lime'
                  )}
                >
                  {m.monto > 0 ? 'debes ' : 'te toca '}
                  {formatCOP(Math.abs(m.monto))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {liquidaciones.length > 0 ? (
        <section>
          <h2 className='font-display text-label-lg uppercase'>Lo que ya se movió</h2>
          <ul className='mt-3 flex flex-col divide-y divide-border rounded-xl border border-border'>
            {liquidaciones.map((l) => (
              <li key={l.id} className='flex items-center justify-between gap-4 p-4'>
                <div>
                  <p className='text-body-md'>
                    {l.direccion === 'to_venue' ? 'Te transferimos' : 'Nos transferiste'}
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    {formatDate(new Date(l.fecha))}
                    {l.referencia ? ` · ${l.referencia}` : null}
                  </p>
                </div>
                <p className='whitespace-nowrap font-display font-bold'>{formatCOP(l.monto)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
