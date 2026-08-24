'use client'

import { CopyIcon, MailIcon } from 'lucide-react'
import {
  type ReactElement,
  cloneElement,
  isValidElement,
  useId,
  useMemo,
  useState,
} from 'react'

import { toastManager } from '@/components/ui/toast'
import { PLEDGE_UNITS } from '@/lib/venues/types'

/**
 * El formulario para duenios de sitio.
 *
 * NO MANDA EL CORREO DESDE EL SERVIDOR, A PROPOSITO. Un endpoint publico que
 * envia correo es un formulario de spam esperando a que lo encuentren, y
 * obligaria a montar captcha, limite de tasa y una llave de Resend viva antes
 * de que esto sirva de algo. Lo que hace es redactar el mensaje y abrirlo en el
 * cliente de correo de la persona, con el nombre del sitio ya adentro.
 *
 * El boton de copiar existe porque mailto: no siempre abre algo: hay
 * navegadores y equipos sin cliente de correo configurado, y sin la alternativa
 * ese usuario se queda mirando un boton que no hace nada.
 */

const DESTINO = 'hola@tumbenla.co'

type Forma = 'percentage' | 'fixed_per_unit'

export function QuieroPonerForm() {
  const [nombre, setNombre] = useState('')
  const [ciudad, setCiudad] = useState('Manizales')
  const [contacto, setContacto] = useState('')
  const [forma, setForma] = useState<Forma>('percentage')
  const [porcentaje, setPorcentaje] = useState('')
  const [monto, setMonto] = useState('')
  const [unidad, setUnidad] = useState<string>('cerveza')
  const [nota, setNota] = useState('')

  const asunto = useMemo(
    () => (nombre.trim() ? `Quiero poner: ${nombre.trim()}` : 'Quiero poner'),
    [nombre]
  )

  const cuerpo = useMemo(() => {
    const compromiso =
      forma === 'percentage'
        ? `Ponemos el ${porcentaje || '__'}% de las ventas.`
        : `Ponemos $${monto || '__'} por ${unidad}.`

    return [
      `Sitio: ${nombre.trim() || '__'}`,
      `Ciudad: ${ciudad.trim() || '__'}`,
      `Contacto: ${contacto.trim() || '__'}`,
      '',
      compromiso,
      nota.trim() ? `\n${nota.trim()}` : '',
    ]
      .join('\n')
      .trim()
  }, [nombre, ciudad, contacto, forma, porcentaje, monto, unidad, nota])

  const href = `mailto:${DESTINO}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`Para: ${DESTINO}\nAsunto: ${asunto}\n\n${cuerpo}`)
      toastManager.add({ title: 'Mensaje copiado', type: 'success' })
    } catch {
      toastManager.add({
        title: 'No se pudo copiar',
        description: `Escribenos a ${DESTINO}`,
        type: 'error',
      })
    }
  }

  const listo = nombre.trim() !== '' && contacto.trim() !== ''

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,380px)]">
      <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
        <Campo label="Nombre del sitio" requerido>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Bar La Nona"
            className={input}
          />
        </Campo>

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo label="Ciudad">
            <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={input} />
          </Campo>

          <Campo label="Cómo te contactamos" requerido>
            <input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="WhatsApp o correo"
              className={input}
            />
          </Campo>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-medium text-sm">Cuánto pones</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['percentage', 'Un porcentaje'],
                ['fixed_per_unit', 'Un monto fijo'],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setForma(valor)}
                aria-pressed={forma === valor}
                className={
                  forma === valor
                    ? 'rounded-md border border-primary bg-primary/10 px-3 py-1.5 font-display text-label-sm text-primary-text uppercase'
                    : 'rounded-md border border-secondary px-3 py-1.5 font-display text-label-sm text-muted-foreground uppercase hover:text-foreground'
                }
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {forma === 'percentage' ? (
            <Campo label="Porcentaje de las ventas">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
                placeholder="10"
                className={input}
              />
            </Campo>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <Campo label="Monto en pesos">
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="1000"
                  className={input}
                />
              </Campo>
              <Campo label="Por cada">
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  className={input}
                >
                  {PLEDGE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
          )}
        </fieldset>

        <Campo label="Algo más que debamos saber">
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            className={`${input} h-auto py-2`}
          />
        </Campo>
      </form>

      {/* Vista previa. Que la persona vea exactamente lo que va a mandar antes
          de mandarlo quita la sensacion de estar llenando un formulario que se
          va a un agujero. */}
      <aside className="flex h-fit flex-col gap-4 rounded-xl border-2 border-secondary bg-card p-6 lg:sticky lg:top-28">
        <h2 className="font-display text-label-lg text-lime uppercase tracking-widest">
          Esto es lo que mandas
        </h2>

        <div className="rounded-lg bg-background p-4 font-mono text-muted-foreground text-xs">
          <p className="text-street-white">Para: {DESTINO}</p>
          <p className="text-street-white">Asunto: {asunto}</p>
          <pre className="mt-3 whitespace-pre-wrap break-words">{cuerpo}</pre>
        </div>

        <a
          href={listo ? href : undefined}
          aria-disabled={!listo}
          onClick={(e) => {
            if (!listo) e.preventDefault()
          }}
          className={
            listo
              ? 'flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
              : 'flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-primary/40 px-5 py-3 font-display text-label-lg text-primary-foreground uppercase'
          }
        >
          <MailIcon className="size-5" />
          Abrir el correo
        </a>

        <button
          type="button"
          onClick={copiar}
          className="flex items-center justify-center gap-2 rounded-xl border border-secondary px-5 py-3 font-display text-label-lg text-muted-foreground uppercase transition-colors hover:text-foreground"
        >
          <CopyIcon className="size-5" />
          Copiar el mensaje
        </button>

        {!listo ? (
          <p className="text-body-md text-muted-foreground">
            Falta el nombre del sitio y como contactarte.
          </p>
        ) : null}
      </aside>
    </div>
  )
}

const input =
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-body-md text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Misma asociacion explicita que el formulario del admin: el control se clona
 *  para inyectarle el id, y la etiqueta lo apunta con htmlFor. Anidar el input
 *  es HTML valido pero el linter no puede verificarlo, y la version explicita
 *  es de todos modos la que mejor se lleva con un lector de pantalla. */
function Campo({
  label,
  requerido,
  children,
}: {
  label: string
  requerido?: boolean
  children: React.ReactNode
}) {
  const id = useId()

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-required': requerido ? true : undefined,
      })
    : children

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium text-sm">
        {label}
        {requerido ? <span className="ml-1 text-primary-text">*</span> : null}
      </label>
      {control}
    </div>
  )
}
