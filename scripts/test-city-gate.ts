import assert from 'node:assert/strict'

import { CIUDADES, ciudadActivaMasCercana, COOKIE_CIUDAD } from '../src/config/ciudades'
import { resolveGateCity } from '../src/lib/cities/gate'

const cookie = (value: unknown) => `${COOKIE_CIUDAD}=${encodeURIComponent(JSON.stringify(value))}`
const blocked = () => {
  throw new Error('Browser access denied')
}
const resolve = (override: string | null, saved: string | null = null, cookies = '') =>
  resolveGateCity(
    override,
    () => saved,
    () => cookies
  )

assert.equal(resolve(null), null)
assert.equal(resolve('Manizales')?.estado, 'activa')
for (const city of CIUDADES.filter((city) => city.estado === 'en_camino')) {
  assert.equal(resolve(city.slug)?.estado, 'en_camino')
  assert.equal(resolve(null, null, cookie({ ciudad: city.nombre }))?.slug, city.slug)
  assert.equal(ciudadActivaMasCercana(city)?.slug, 'manizales')
}
assert.equal(resolve('BOGOTÁ')?.slug, 'bogota')
assert.equal(resolve('Medellín')?.slug, 'medellin')
assert.equal(resolve('manizales', 'pereira', cookie({ ciudad: 'Cali' }))?.slug, 'manizales')
assert.equal(resolve(null, 'manizales', cookie({ ciudad: 'Pereira' }))?.slug, 'manizales')
for (const value of ['', 'unknown', '%E0%A4%A']) {
  assert.equal(resolve(value, 'pereira', cookie({ ciudad: 'Cali' })), null)
}
for (const value of [null, [], 42, 'Pereira', { ciudad: 42 }, { ciudad: 'unknown' }]) {
  assert.equal(resolve(null, null, cookie(value)), null)
}
assert.equal(resolve(null, null, `${COOKIE_CIUDAD}=%broken`), null)
assert.equal(resolve(null, null, `${COOKIE_CIUDAD}={broken`), null)
assert.equal(
  resolve(null, null, `other=1; ${cookie({ ciudad: 'Pereira' })}; last=2`)?.slug,
  'pereira'
)
assert.equal(resolveGateCity(null, blocked, blocked), null)
assert.equal(resolveGateCity('manizales', blocked, blocked)?.slug, 'manizales')
assert.equal(resolveGateCity(null, blocked, () => cookie({ ciudad: 'Pereira' }))?.slug, 'pereira')
console.log(
  'City gate checks passed: overrides, persistence precedence, all configured cities, fail-open detection.'
)
