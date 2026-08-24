'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { db } from '@/database'
import { partyPhoto, photoClaim } from '@/database/schema'
import { auth } from '@/lib/auth/auth'

/**
 * Reclamar una foto, soltarla, y decidir si sale en el perfil publico.
 *
 * Igual que las acciones de admin: cada una verifica la sesion por su cuenta.
 * Un layout no protege una server action, que es un endpoint POST con su propio
 * identificador.
 *
 * Y ademas de "hay sesion", cada mutacion verifica PROPIEDAD: que el reclamo
 * que se esta tocando sea de quien lo pide. Sin eso, cualquiera con sesion
 * podria mandar el id del reclamo de otra persona y publicar su foto.
 */

export type FiestaResult = { ok: true } | { ok: false; error: string }

const requireUser = async () => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null
  return session.user
}

export const claimPhotoAction = async (photoId: string): Promise<FiestaResult> => {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'Inicia sesión para guardar tus fotos.' }

  // Solo se pueden reclamar fotos habilitadas. Sin esta comprobacion se podria
  // reclamar una foto 'pending' que nadie ha revisado todavia, o una 'hidden'
  // que alguien pidio retirar, adivinando el id.
  const [photo] = await db
    .select({ id: partyPhoto.id, status: partyPhoto.status })
    .from(partyPhoto)
    .where(eq(partyPhoto.id, photoId))
    .limit(1)

  if (!photo || photo.status !== 'available') {
    return { ok: false, error: 'Esa foto ya no esta disponible.' }
  }

  try {
    await db
      .insert(photoClaim)
      .values({ photoId, userId: user.id })
      // El indice unico (photo_id, user_id) es lo que impide inflar el
      // historial reclamando la misma foto varias veces. onConflictDoNothing
      // convierte el segundo intento en algo inofensivo en vez de un error.
      .onConflictDoNothing()

    revalidatePath('/mi-historia')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se pudo guardar la foto. Intenta de nuevo.' }
  }
}

export const unclaimPhotoAction = async (photoId: string): Promise<FiestaResult> => {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'Inicia sesión primero.' }

  try {
    // El userId va en el WHERE, no solo en una comprobacion previa: asi la
    // condicion de propiedad la impone la base y no queda margen entre leer y
    // borrar.
    await db
      .delete(photoClaim)
      .where(and(eq(photoClaim.photoId, photoId), eq(photoClaim.userId, user.id)))

    revalidatePath('/mi-historia')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se pudo quitar la foto.' }
  }
}

/**
 * Mostrar u ocultar una foto en el perfil publico.
 *
 * Esta es la segunda puerta del modelo de privacidad. Que el operador habilite
 * una foto solo permite que la persona se reconozca en ella; que esa foto se
 * vea fuera de su cuenta lo decide aca, foto por foto, y arranca en false.
 */
export const setPhotoVisibilityAction = async (
  photoId: string,
  showPublicly: boolean
): Promise<FiestaResult> => {
  const user = await requireUser()
  if (!user) return { ok: false, error: 'Inicia sesión primero.' }

  try {
    await db
      .update(photoClaim)
      .set({ showPublicly, updatedAt: new Date() })
      .where(and(eq(photoClaim.photoId, photoId), eq(photoClaim.userId, user.id)))

    revalidatePath('/mi-historia')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No se pudo cambiar la visibilidad.' }
  }
}
