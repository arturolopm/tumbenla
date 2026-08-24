import { type NextRequest, NextResponse } from 'next/server'

import { COOKIE_CIUDAD } from '@/config/ciudades'

/**
 * Geolocalizacion por IP, escrita en una cookie.
 *
 * POR QUE POR IP Y NO CON navigator.geolocation: la API del navegador dispara
 * un permiso del sistema en la primera visita. Pedirle a alguien que entrega su
 * ubicacion exacta antes de haberle mostrado nada es la forma mas rapida de que
 * le de "bloquear" y de que no vuelva. Para decidir si alguien esta en Manizales
 * o no, la ciudad por IP alcanza y no cuesta un permiso.
 *
 * POR QUE UNA COOKIE Y NO LEER LA CABECERA EN LA PAGINA: leer cabeceras dentro
 * de un Server Component vuelve la ruta dinamica y /sitios pierde el ISR. La
 * cookie la escribe este proxy, que corre en el borde en cada peticion, y la
 * lee un componente de cliente. Las paginas siguen siendo estaticas.
 *
 * Las cabeceras son las que pone Vercel. En local no existen, la cookie no se
 * escribe, y el gate falla hacia el lado bueno: muestra el contenido.
 */

type Geo = {
  ciudad: string | null
  pais: string | null
  lat: number | null
  lng: number | null
}

const leerGeo = (request: NextRequest): Geo => {
  const h = request.headers
  // Vercel percent-encodea el nombre porque puede traer tildes y espacios.
  const crudo = h.get('x-vercel-ip-city')
  let ciudad: string | null = null
  if (crudo) {
    try {
      ciudad = decodeURIComponent(crudo)
    } catch {
      // Un valor mal codificado no puede tumbar la peticion entera.
      ciudad = crudo
    }
  }

  const num = (valor: string | null) => {
    if (!valor) return null
    const n = Number.parseFloat(valor)
    return Number.isFinite(n) ? n : null
  }

  return {
    ciudad,
    pais: h.get('x-vercel-ip-country'),
    lat: num(h.get('x-vercel-ip-latitude')),
    lng: num(h.get('x-vercel-ip-longitude')),
  }
}

export default function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const geo = leerGeo(request)

  // Sin ciudad no se escribe nada. Una cookie vacia obligaria al cliente a
  // distinguir "no se pudo detectar" de "se detecto y no hay dato", que son la
  // misma cosa para lo que hay que decidir.
  if (!geo.ciudad) return response

  response.cookies.set({
    name: COOKIE_CIUDAD,
    value: JSON.stringify(geo),
    // Legible por JS a proposito: quien decide que mostrar es un componente de
    // cliente. No hay nada sensible aca; es la ciudad, no la direccion.
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })

  return response
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
