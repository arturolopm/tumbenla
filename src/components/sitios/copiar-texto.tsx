'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'

/**
 * Copiar el mensaje ya redactado.
 *
 * Existe porque el paso siguiente ocurre en OTRA app: la persona se va a
 * Instagram y ahi ya no tiene esta pantalla para mirar cual era su correo.
 * Dejarlo copiado es la diferencia entre que el DM llegue completo o llegue sin
 * el dato que nos hace falta para aprobar.
 */
export function CopiarTexto({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles no pasa nada: el texto esta a la vista.
    }
  }

  return (
    <div className='rounded-lg border border-border bg-card p-3'>
      <p className='text-body-md text-street-white'>{texto}</p>
      <button
        type='button'
        onClick={copiar}
        className='mt-2 inline-flex items-center gap-1 font-display text-label-lg text-primary-text uppercase hover:underline'
      >
        {copiado ? <CheckIcon className='size-4' /> : <CopyIcon className='size-4' />}
        {copiado ? 'Copiado' : etiqueta}
      </button>
    </div>
  )
}
