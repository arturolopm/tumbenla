import { buscarCiudad, COOKIE_CIUDAD, STORAGE_CIUDAD } from '@/config/ciudades'

// Invalid explicit overrides deliberately mean undetected, even with a geo cookie.
export const resolveGateCity = (
  override: string | null,
  readSaved: () => string | null,
  readCookies: () => string
) => {
  if (override !== null) return buscarCiudad(override)

  try {
    const saved = readSaved()
    if (saved !== null) return buscarCiudad(saved)
  } catch {
    // Storage restrictions must not prevent IP detection or access.
  }

  try {
    const cookie = readCookies()
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_CIUDAD}=`))
    if (!cookie) return null
    const geo: unknown = JSON.parse(decodeURIComponent(cookie.slice(COOKIE_CIUDAD.length + 1)))
    if (!geo || typeof geo !== 'object' || !('ciudad' in geo)) return null
    return typeof geo.ciudad === 'string' ? buscarCiudad(geo.ciudad) : null
  } catch {
    return null
  }
}

export const readBrowserGateCity = (override: string | null) => {
  const city = resolveGateCity(
    override,
    () => window.localStorage.getItem(STORAGE_CIUDAD),
    () => document.cookie
  )
  if (override !== null) {
    try {
      window.localStorage.setItem(STORAGE_CIUDAD, city?.slug ?? '')
    } catch {
      // The URL remains usable when persistence is unavailable.
    }
  }
  return city
}
