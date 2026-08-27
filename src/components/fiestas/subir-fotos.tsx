'use client'

import { UploadIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { firmarSubidaAction, registrarFotoAction } from '@/app/actions/noches'
import { toastManager } from '@/components/ui/toast'

/**
 * Subir fotos a una noche.
 *
 * EL ARCHIVO NO PASA POR LA APP. Se pide una URL firmada, el navegador hace PUT
 * directo a R2, y solo despues se escribe la fila. Una noche son decenas de
 * fotos: mandarlas por una funcion las serializa, se paga computo por cada byte
 * y se roza el limite de duracion.
 *
 * DE A POCAS Y NO TODAS A LA VEZ. Subir cuarenta archivos en paralelo satura la
 * conexion de un celular y hace fallar la mitad; de a tres, la barra avanza y
 * los fallos son de a uno y se pueden reintentar.
 *
 * Cada archivo lleva su propio estado: si el numero 12 falla, los otros 39
 * siguen. Un fallo colectivo obligaria a volver a subirlo todo.
 */

const A_LA_VEZ = 3

type Item = {
  nombre: string
  estado: 'esperando' | 'subiendo' | 'listo' | 'error'
  error?: string
}

export function SubirFotos({
  nightId,
  publicarDeUna = false,
  etiqueta = 'Subir fotos',
  ayuda,
}: {
  nightId: string
  /** Solo el sitio puede pedir esto; la accion lo ignora para los demas. */
  publicarDeUna?: boolean
  etiqueta?: string
  ayuda?: string
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [subiendo, setSubiendo] = useState(false)

  const marcar = (i: number, cambio: Partial<Item>) =>
    setItems((prev) => prev.map((item, j) => (j === i ? { ...item, ...cambio } : item)))

  const subirUno = async (file: File, i: number) => {
    marcar(i, { estado: 'subiendo' })

    const firma = await firmarSubidaAction(nightId, file.type, file.size)
    if (!firma.ok) {
      marcar(i, { estado: 'error', error: firma.error })
      return
    }

    const respuesta = await fetch(firma.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    }).catch(() => null)

    // El fallo tipico aca no es de red: es CORS del bucket. Se dice, porque el
    // error del navegador no lo menciona y se pierden horas buscándolo.
    if (!respuesta || !respuesta.ok) {
      marcar(i, {
        estado: 'error',
        error: 'No se pudo subir el archivo (revisa el CORS del bucket).',
      })
      return
    }

    const registro = await registrarFotoAction({
      nightId,
      url: firma.publicUrl,
      storageKey: firma.key,
      publicar: publicarDeUna,
    })

    if (registro.status === 'error') {
      marcar(i, { estado: 'error', error: registro.error })
      return
    }

    marcar(i, { estado: 'listo' })
  }

  const alElegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    setItems(files.map((f) => ({ nombre: f.name, estado: 'esperando' })))
    setSubiendo(true)

    for (let inicio = 0; inicio < files.length; inicio += A_LA_VEZ) {
      const lote = files.slice(inicio, inicio + A_LA_VEZ)
      await Promise.all(lote.map((file, j) => subirUno(file, inicio + j)))
    }

    setSubiendo(false)
    if (input.current) input.current.value = ''
    router.refresh()

    // El recuento se lee del estado ya actualizado, no de un contador aparte
    // que podria discrepar de lo que muestra la lista.
    setItems((prev) => {
      const fallaron = prev.filter((p) => p.estado === 'error').length
      const listas = prev.filter((p) => p.estado === 'listo').length
      if (listas > 0) {
        toastManager.add({
          title: `${listas} ${listas === 1 ? 'foto subida' : 'fotos subidas'}`,
          type: 'success',
        })
      }
      if (fallaron > 0) {
        toastManager.add({
          title: `${fallaron} no se ${fallaron === 1 ? 'pudo' : 'pudieron'} subir`,
          description: 'Mira la lista para ver por qué.',
          type: 'error',
        })
      }
      return prev
    })
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 aria-disabled:opacity-50">
        <UploadIcon className="size-4" />
        {subiendo ? 'Subiendo…' : etiqueta}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={subiendo}
          onChange={alElegir}
          className="sr-only"
        />
      </label>

      {ayuda ? <p className="mt-2 text-body-md text-muted-foreground">{ayuda}</p> : null}

      {items.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1 text-sm">
          {items.map((item, i) => (
            <li key={`${item.nombre}-${i}`} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-muted-foreground">{item.nombre}</span>
              <span
                className={
                  item.estado === 'error'
                    ? 'shrink-0 text-destructive-foreground'
                    : item.estado === 'listo'
                      ? 'shrink-0 text-lime'
                      : 'shrink-0 text-muted-foreground'
                }
              >
                {item.estado === 'error'
                  ? item.error
                  : item.estado === 'listo'
                    ? 'Lista'
                    : item.estado === 'subiendo'
                      ? 'Subiendo…'
                      : 'En cola'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
