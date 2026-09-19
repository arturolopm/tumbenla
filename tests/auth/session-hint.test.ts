import { describe, expect, test } from 'bun:test'

import {
  SESSION_HINT_COOKIE,
  SESSION_HINT_MAX_LABEL,
  SESSION_HINT_SCRIPT,
  type SessionHint,
  applySessionHint,
  buildSessionHint,
  parseSessionHint,
  serializeSessionHint,
  toCssString,
} from '@/lib/auth/session-hint'

/** What a cookie setter puts on the wire: both of ours URI-encode the value. */
const cookieFor = (hint: SessionHint) =>
  `${SESSION_HINT_COOKIE}=${encodeURIComponent(serializeSessionHint(hint))}`

const rawCookie = (value: string) => `${SESSION_HINT_COOKIE}=${value}`

/** A stand-in for <html>: records what the hint writes. */
const makeRoot = () => {
  const properties = new Map<string, string>()
  const root = {
    dataset: {} as Record<string, string | undefined>,
    style: {
      setProperty: (name: string, value: string) => void properties.set(name, value),
      removeProperty: (name: string) => properties.delete(name),
    },
  }
  return { root, properties }
}

/** The observable result of either implementation on a fresh document. */
const viaFunction = (cookie: string) => {
  const { root, properties } = makeRoot()
  applySessionHint(root, parseSessionHint(cookie))
  return { session: root.dataset.session, label: properties.get('--session-label') }
}

const viaInlineScript = (cookie: string) => {
  const { root, properties } = makeRoot()
  new Function('document', SESSION_HINT_SCRIPT)({ cookie, documentElement: root })
  return { session: root.dataset.session, label: properties.get('--session-label') }
}

const tricky: SessionHint[] = [
  { kind: 'person', label: 'Dueño A' },
  { kind: 'venue', label: 'Bar "La" Ñoña \\', venueSlug: 'bar-la-nona' },
  { kind: 'person', label: 'Operación 🍹 nocturna' },
  { kind: 'person', label: 'line one\nline two\r\f' },
  { kind: 'venue', label: 'x'.repeat(SESSION_HINT_MAX_LABEL + 15), venueSlug: 'largo' },
  { kind: 'person', label: 'semi; colon, comma = equals' },
]

describe('session hint wire format', () => {
  test('round-trips through a cookie, truncating long labels', () => {
    for (const hint of tricky) {
      expect(parseSessionHint(cookieFor(hint))).toEqual({
        ...hint,
        label: hint.label.slice(0, SESSION_HINT_MAX_LABEL),
      })
    }
  })

  test('finds the hint among other cookies, in header and document.cookie shapes', () => {
    const hint: SessionHint = { kind: 'venue', label: 'Bar La Nona', venueSlug: 'bar-la-nona' }
    expect(parseSessionHint(`a=1; ${cookieFor(hint)}; b=2`)).toEqual(hint)
    expect(parseSessionHint(`a=1;${cookieFor(hint)};b=2`)).toEqual(hint)
  })

  test('ignores anything that is not a valid hint, without throwing', () => {
    const bad = [
      undefined,
      '',
      'other=1',
      rawCookie(''),
      rawCookie('not-json'),
      rawCookie('%E0%A4%A'),
      rawCookie(encodeURIComponent('null')),
      rawCookie(encodeURIComponent(JSON.stringify({ v: 2, k: 'person', l: 'A' }))),
      rawCookie(encodeURIComponent(JSON.stringify({ v: 1, k: 'admin', l: 'A' }))),
      rawCookie(encodeURIComponent(JSON.stringify({ v: 1, k: 'person' }))),
      rawCookie(encodeURIComponent(JSON.stringify({ v: 1, k: 'person', l: '' }))),
      `x${cookieFor({ kind: 'person', label: 'Prefix collision' })}`,
    ]
    for (const cookie of bad) expect(parseSessionHint(cookie)).toBeNull()
  })
})

describe('applying the hint to <html>', () => {
  test('marks the kind and a CSS-safe label, and clears both without a hint', () => {
    const { root, properties } = makeRoot()
    applySessionHint(root, { kind: 'venue', label: 'Bar "La" Nona', venueSlug: 'bar-la-nona' })
    expect(root.dataset.session).toBe('venue')
    expect(properties.get('--session-label')).toBe('"Bar \\"La\\" Nona"')

    applySessionHint(root, null)
    expect(root.dataset.session).toBeUndefined()
    expect(properties.has('--session-label')).toBe(false)
  })

  test('escapes backslashes and removes line breaks from CSS strings', () => {
    expect(toCssString('a\\b')).toBe('"a\\\\b"')
    expect(toCssString('a\nb\rc\fd')).toBe('"a b c d"')
  })

  test('the inline <head> script does exactly what the functions do', () => {
    const cookies = [
      ...tricky.map(cookieFor),
      ...tricky.map((hint) => `theme=dark; ${cookieFor(hint)}; other=1`),
      '',
      'other=1',
      rawCookie('not-json'),
      rawCookie('%E0%A4%A'),
      rawCookie(encodeURIComponent(JSON.stringify({ v: 2, k: 'person', l: 'A' }))),
      `x${cookieFor({ kind: 'person', label: 'Prefix collision' })}`,
    ]
    for (const cookie of cookies) expect(viaInlineScript(cookie)).toEqual(viaFunction(cookie))
  })
})

describe('what the hint says', () => {
  const user = { name: '  Dueño A  ', email: 'duenoa@prueba.local' }

  test('names the first venue when the person works at one', () => {
    const venues = [
      { slug: 'bar-la-nona', name: 'Bar La Nona' },
      { slug: 'billar-la-enea', name: 'Billar La Enea' },
    ]
    expect(buildSessionHint(user, venues)).toEqual({
      kind: 'venue',
      label: 'Bar La Nona',
      venueSlug: 'bar-la-nona',
    })
  })

  test('falls back to the trimmed name, then to the email', () => {
    expect(buildSessionHint(user, [])).toEqual({ kind: 'person', label: 'Dueño A' })
    expect(buildSessionHint({ name: '   ', email: 'x@y.z' }, [])).toEqual({
      kind: 'person',
      label: 'x@y.z',
    })
    expect(buildSessionHint({ name: null, email: 'x@y.z' }, [])).toEqual({
      kind: 'person',
      label: 'x@y.z',
    })
  })
})
