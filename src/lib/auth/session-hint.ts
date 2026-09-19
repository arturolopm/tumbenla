import { APP_COOKIE_NAME } from '@/lib/constants'

/**
 * The session hint: a small cookie that JavaScript can read, telling the
 * navbar what to paint before any of the page's JavaScript has loaded.
 *
 * WHY IT EXISTS: the public pages are static (decision 23), so the server
 * cannot render the session into them, and `useSession()` only asks for it
 * after hydration — measured at ~2.6 s after first paint on a phone, with the
 * server answering in 7 ms. An inline <head> script reads this cookie and
 * marks <html> before the first paint; CSS then shows the right control. The
 * real session is still fetched and still decides; this only removes the wait.
 *
 * IT IS NOT A CREDENTIAL. It holds what the person already sees on screen —
 * their name, or their venue's — the server never reads it to decide anything,
 * and forging it only changes what your own navbar paints for a moment.
 *
 * THIS FILE STAYS DEPENDENCY-FREE (only constants): it runs on the server, in
 * the browser, and in unit tests, and pulling React or the env schema in here
 * would drag them into every page that reads the hint.
 */

export const SESSION_HINT_COOKIE = `${APP_COOKIE_NAME}.session_hint`

/** The trigger truncates visually long before this; the cap keeps the cookie small. */
export const SESSION_HINT_MAX_LABEL = 60

export type SessionHint = {
  kind: 'person' | 'venue'
  label: string
  venueSlug?: string
}

/**
 * Raw JSON, NOT URI-encoded: better-call's `setCookie` and Next's
 * `response.cookies.set` both run `encodeURIComponent` on the value, so the
 * readers decode exactly once.
 */
export const serializeSessionHint = (hint: SessionHint): string =>
  JSON.stringify({
    v: 1,
    k: hint.kind,
    l: hint.label.slice(0, SESSION_HINT_MAX_LABEL),
    ...(hint.venueSlug ? { s: hint.venueSlug } : {}),
  })

/** Reads the hint out of a `Cookie` header or `document.cookie`. Never throws. */
export const parseSessionHint = (cookies: string | null | undefined): SessionHint | null => {
  if (!cookies) return null
  const prefix = `${SESSION_HINT_COOKIE}=`
  const entry = cookies.split(/;\s*/).find((part) => part.startsWith(prefix))
  if (!entry) return null

  try {
    const wire = JSON.parse(decodeURIComponent(entry.slice(prefix.length)))
    if (
      !wire ||
      wire.v !== 1 ||
      (wire.k !== 'person' && wire.k !== 'venue') ||
      typeof wire.l !== 'string' ||
      !wire.l
    ) {
      return null
    }
    return {
      kind: wire.k,
      label: wire.l.slice(0, SESSION_HINT_MAX_LABEL),
      ...(typeof wire.s === 'string' && wire.s ? { venueSlug: wire.s } : {}),
    }
  } catch {
    return null
  }
}

/**
 * A CSS string literal for `content: var(--session-label)`. Quotes and
 * backslashes are escaped and line breaks become spaces, so no label can end
 * the string early; `setProperty` rejects anything else as one invalid value.
 */
export const toCssString = (label: string): string =>
  `"${label.replace(/[\\"]/g, '\\$&').replace(/[\n\r\f]/g, ' ')}"`

/** The subset of an element the hint writes to, so tests can pass a plain object. */
export type HintTarget = {
  dataset: Record<string, string | undefined>
  style: {
    setProperty: (name: string, value: string) => void
    removeProperty: (name: string) => unknown
  }
}

/** Marks <html> for the CSS in the navbar: `data-session` plus `--session-label`. */
export const applySessionHint = (root: HintTarget, hint: SessionHint | null): void => {
  if (!hint) {
    delete root.dataset.session
    root.style.removeProperty('--session-label')
    return
  }
  root.dataset.session = hint.kind
  root.style.setProperty('--session-label', toCssString(hint.label))
}

/** The hint as the browser currently has it; `null` on the server. */
export const readSessionHint = (): SessionHint | null =>
  typeof document === 'undefined' ? null : parseSessionHint(document.cookie)

/**
 * What the navbar will end up showing, decided the same way `AccountMenu`
 * decides it: the first venue the person works at (callers pass them in the
 * order `/api/mi-acceso` returns them), otherwise their name, otherwise their
 * email.
 */
export const buildSessionHint = (
  user: { name?: string | null; email: string },
  venues: readonly { slug: string; name: string }[]
): SessionHint => {
  const [mainVenue] = venues
  if (mainVenue) return { kind: 'venue', label: mainVenue.name, venueSlug: mainVenue.slug }
  return { kind: 'person', label: user.name?.trim() || user.email }
}

/**
 * `parseSessionHint` + `applySessionHint` on `document`, as a string for an
 * inline <head> script: it has to run before the first paint, which is before
 * any bundle has loaded. Hand-written rather than generated from the functions
 * above with `toString()`, because minification makes that fragile;
 * `tests/auth/session-hint.test.ts` checks that both give the same result for
 * every case.
 */
export const SESSION_HINT_SCRIPT = String.raw`(function(){try{var n=${JSON.stringify(
  `${SESSION_HINT_COOKIE}=`
)},p=document.cookie.split(/;\s*/);for(var i=0;i<p.length;i++){if(p[i].indexOf(n)!==0)continue;var w=JSON.parse(decodeURIComponent(p[i].slice(n.length)));if(!w||w.v!==1||(w.k!=='person'&&w.k!=='venue')||typeof w.l!=='string'||!w.l)return;var r=document.documentElement;r.dataset.session=w.k;r.style.setProperty('--session-label','"'+w.l.slice(0,${SESSION_HINT_MAX_LABEL}).replace(/[\\"]/g,'\\$&').replace(/[\n\r\f]/g,' ')+'"');return}}catch(e){}})()`
