# Plan: the navbar knows the session at first paint (session-hint cookie)

## Context

Measured on 2026-09-19 (probes against `tumbenla.com` and a local production build, emulated 4G + 4× CPU):
the page paints at ~1.1 s but the nav shows "Entrar"/the name only at ~3.8 s. The server answers
`/api/auth/get-session` in 7 ms warm (~1.05 s extra when cold). The delay is the ordering:
better-auth's `useSession()` requests the session only after the atom mounts
(`node_modules/better-auth/dist/client/query.mjs`: `onMount` + `setTimeout(0)`), i.e. after all
~394 KB gz of JS has been downloaded and hydrated. Counterfactual proof: the same build asking from
`<head>` knows the session at 0.45 s, before first paint.

Measured amplifiers, all in scope (user decision):
- `@/lib/utils` barrel → `urls.ts` → `@/config/env` ships t3-env + all of Zod (+ every server
  variable name) to every page (via `toast.tsx` in the root layout, among others). −390 ms when removed.
- The Sentry SDK is loaded and evaluated before hydration. −740 ms more when removed (Sentry was disabled locally;
  production also runs `init`).
- `auth.ts` loads the whole email stack at boot: cold boot 122 → 101 ms when lazy.
- Signed in: `/api/mi-acceso` starts only after `get-session`, and the label switches name → venue.

**Outcome:** the correct nav state (Entrar / person name / venue name) is visible at first paint, with no
text swap, on static/ISR pages (decision 23 keeps holding: no session read in layouts). Pages also become
interactive ~1.1 s sooner on mobile.

**Decided with the user:** the cookie carries the display name + main venue. Env/Zod removal, Sentry
deferral and lazy email are all in scope.

## Design (read once; every task refers back here)

**Cookie** `tumbenla.session_hint` (`${APP_COOKIE_NAME}.session_hint`, `src/lib/constants.ts`).
Not HttpOnly, `Path=/`, `SameSite=Lax`, `Secure` in prod, domain = `env.COOKIE_DOMAIN` only when
`crossSubDomainCookies` is on (mirror `auth.ts`), `Max-Age` = session `expiresIn` (30 d).
Value = JSON `{"v":1,"k":"person"|"venue","l":"<label ≤60>","s":"<venue slug>"?}`, passed RAW to the
cookie setters: both better-call (`node_modules/better-call/dist/cookies.mjs:74`) and Next's
`ResponseCookies` already `encodeURIComponent` the value, so the reader does one `decodeURIComponent`.
It is a UI hint only. The server never trusts it, and it is never a credential.

**Label rule** (must equal what `AccountMenu` renders): first venue of `listMyVenues(userId)`
(`src/lib/auth/venue-access.ts`, ordered by name, same as `/api/mi-acceso`) → `kind: venue`,
`label: venue.nombre`, `s: venue.slug`. Otherwise `kind: person`, `label: user.name?.trim() || user.email`.

**Writers: server only.** The client never writes the cookie.
1. `auth.ts` `hooks.after` (`createAuthMiddleware` from `better-auth/api`). This user hook runs before plugin
   hooks such as `nextCookies()` (`to-auth-endpoints.mjs` `getHooks`), so server actions get the cookie too:
   - `ctx.path === '/sign-out'` → expire the hint.
   - `ctx.path === '/get-session'` → if `ctx.context.returned === null` and `ctx.getCookie(HINT)` → expire the hint.
     Nothing else happens here, so no DB query is added to get-session.
   - any other path with `ctx.context.newSession` (sign-in email/OTP, OAuth callback, verify-email
     auto sign-in, sign-up) → `await import('./venue-access')` (dynamic import: `venue-access.ts`
     imports `./auth`), query the venues, set the hint. **Wrap it in try/catch**: a hint failure must never fail a sign-in.
2. `/api/mi-acceso` (already called by every nav with a session) sets or refreshes the hint from the same
   `listMyVenues` result it already fetches. If there is no session but a hint came in, it expires the hint.

**Readers.**
- Inline `<head>` script in the root layout (static string, runs before first paint): parse the
  cookie → `documentElement.dataset.session = kind` + CSS custom property `--session-label` (a CSS string:
  `"` + label with `\` and `"` escaped and `\n\r\f` → space + `"`). try/catch, silent on garbage.
  `<html suppressHydrationWarning>` (the next-themes pattern). No CSP exists (checked `next.config.ts`,
  `vercel.json`). Biome `noDangerouslySetInnerHtml` is already off.
- While `useSession().isPending`, the nav renders **both** states and CSS picks one with Tailwind 4.1's
  `in-data-[session=person|venue]:` variants; the label comes from `after:content-(--session-label)`.
  No hint → "Entrar", because a missing hint means anonymous.
- After hydration: `useMyAccess` gets `placeholderData` built from the hint (only when `hasSession`, so the
  hydration render matches SSR). `mainVenue` is then right before `/api/mi-acceso` answers.
- `useSessionHintSync(isPending, session)` effect (called from `AccountMenu`) re-applies the cookie to the
  `<html>` dataset whenever the session changes. This keeps later `isPending` windows (better-auth sets
  `isPending` while refetching with `data === null`) from showing a stale name after sign-out.

**Accepted edges** (write them in PRODUCT.md in T8):
- A session created before deploy has no hint, so the first load shows "Entrar", then the name, once. `mi-acceso` then sets the hint.
- Multi-venue staff on `/panel/<second venue>` see the first venue until `mi-acceso` answers (today they see the person name).
- A session revoked on the server shows the stale label until `get-session` returns null, then the label is cleared.
- Sentry deferral: errors before the SDK loads are buffered and replayed. Router transitions before load aren't traced.

## How to run this plan (multi-session)

- **Branch:** `perf/session-hint` off `origin/preview` (the current branch is already merged into preview).
- **Canonical copy:** T0a copies this file to `docs/plans/session-hint.md` and commits it. From then on, tick
  boxes and fill in Results **there**, in the same commit as the task. Any agent or machine can then resume from
  the repo alone.
- **Source of truth for "done":** one local commit per task, subject prefixed `[Tn]`.
  `git log --oneline origin/preview..perf/session-hint` lists what's done. Tick the box below in the same
  commit. If a box and the log disagree, the log wins.
- **Resuming:** read `docs/plans/session-hint.md` → run the log command above → `git status`. If there are uncommitted
  changes, match them to the first unticked task and finish it. Then continue in order.
- **Authorization:** approving this plan authorizes local commits on `perf/session-hint`. Pushing or opening a PR
  needs a new, explicit OK (CLAUDE.md push gate).
- **Before editing any symbol:** `node .gitnexus/run.cjs impact '<symbol>' --direction upstream --repo tumbenla`,
  and report direct callers and risk. Already known (2026-09-19, stale index): `getBaseUrl` CRITICAL (123 dependents),
  `AccountMenu` HIGH, `useMyAccess` HIGH, `SiteNav` LOW. Re-check after T0's reindex.
- **Heavy commands:** redirect to a file and read only the tail (`> "$TMPDIR/x.log" 2>&1; tail -40`) so logs don't
  pile up in context.
- **Language rule:** identifiers and comments in English. A file this plan touches gets its Spanish names and comments
  translated in the same task (`auth.ts`, `urls.ts`).

### Model routing (Opus vs Sonnet): delegate only where the saving is real

Every Sonnet subagent pays a fixed re-feed: CLAUDE.md (auto-loaded, large) + this plan + the files it reads.
That only pays off when the task's own tool output is large and mechanical: build logs, many probe
runs, e2e fix-and-rerun loops. Otherwise that output would sit in the Opus context and be re-read on every
later turn. Short or subtle edits (auth hooks, hydration-safe markup, Sentry buffering) stay in Opus: re-feeding
context to a subagent would cost more than the edit.

| Task | Runner | Why |
|---|---|---|
| T0a branch, reindex, commit | Opus | a handful of commands |
| T0b measurement harness + baseline | **Sonnet** | writing a script + debug runs + 9 measured runs |
| T1–T5 | Opus | subtle, each diff is short |
| T6 e2e specs | **Sonnet** | a 3-minute build/seed cycle per run, iterative |
| T7 per-stage measurement | **Sonnet** | 3 builds × 9 probe runs + a Sentry check |
| T8 docs | Opus | short, needs the decision context and T7's numbers |
| T9 gate | Opus | judgment on the results |

Subagent call: `Agent({ subagent_type: 'general-purpose', model: 'sonnet', prompt })`. Prompt template:
"Read `docs/plans/session-hint.md`, section `<Tn>`. Do only
that task. Do not edit `src/` (if you find a product bug, stop and report it). Commit as `[Tn] …` on
`perf/session-hint`, never push. Fill in the Results table if the task says so. Reply in ≤20 lines:
what passed, the numbers, and anything unexpected."

## Tasks

### [x] T0a: Branch and reindex (Opus)
- `git fetch origin && git switch -c perf/session-hint origin/preview`. This carries the uncommitted PRODUCT.md
  diagnosis entry ("La barra tarda ~2.6 s…").
- `node .gitnexus/run.cjs analyze` (the index is stale at `2aecae0`).
- `cp /Users/arturolopez/.claude/plans/enter-into-plan-mode-happy-kazoo.md docs/plans/session-hint.md`.
- Commit `[T0a] docs: record the nav auth-latency measurements and the session-hint plan` (PRODUCT.md + the plan).
- **Done when:** the log shows `[T0a]`, and `node .gitnexus/run.cjs status` is not stale.

### [ ] T0b: Measurement harness + baseline (Sonnet)
- Create `scripts/measure-auth-paint.ts` (bun + `@playwright/test`'s `chromium`). Port the method used in the
  diagnosis:
  - Args: `--url` (default `http://localhost:3000/`), `--profile 4g|none` (4g = latency 150 ms, 1.6 Mbps down,
    750 kbps up, CPU ×4 through CDP), `--runs 3`, `--login <email>` (local only: POST
    `/api/auth/sign-in/email` with `Origin: <url origin>` and password `Prueba-2026-tumbenla`, then reuse the
    cookies; cookies named `__Secure-` need `secure: true`).
  - Init script, all times from in-page `performance.now()`: FCP; `hydratedAt` = first `fetch()` of
    `/api/auth/get-session` (wrap `window.fetch`; the URL arg may be a `URL` object, so use
    `String(input instanceof Request ? input.url : input)`); `navCorrectAt` = first rAF where the expected
    control is visible (`checkVisibility()`): the "Entrar" link when anonymous; when signed in,
    `header [data-account-trigger], header nav button[aria-haspopup]`. The second selector matches the baseline,
    which has no `data-account-trigger` until T3;
    `labels` = ordered distinct visible trigger labels (real text, or `getComputedStyle(el,'::after').content`).
  - Output: per-run line + medians.
- Build and start locally: `bun run build > log; bun run start &`. Measure the **baseline** (this commit has no
  product change) for anon, `operador@prueba.local` (person) and `duenoa@prueba.local` (venue), 4g, 3 runs.
  Test accounts: `bun run seed:cuentas` if missing.
- Also record the baseline auth-route cold boot (the `node --env-file=.env -e …require(route.js)…` one-liner in T7, ×5, median).
- Add the script to CLAUDE.md's scripts list. Commit `[T0b] …`. Fill in the Results "baseline" column.
- **Done when:** the baseline anon row shows `navCorrectAt − FCP` ≈ 2.5 s (it matches the diagnosis).

### [ ] T1: Hint core + unit tests (Opus)
- `src/lib/auth/session-hint.ts` (isomorphic and **React-free**: it imports only `@/lib/constants`):
  `SESSION_HINT_COOKIE`, `type SessionHint = { kind: 'person'|'venue'; label: string; venueSlug?: string }`,
  `serializeSessionHint`, `parseSessionHint(cookieString)` (split on `; `, exact name match, decode, validate `v===1`,
  kind, string label, truncate to 60 → else `null`; never throws), `toCssString(label)`,
  `applySessionHint(root, hint)` (sets or removes `data-session` and `--session-label`), `readSessionHint()`
  (`null` on the server), `buildSessionHint(user, venues)` (the label rule, pure), and `SESSION_HINT_SCRIPT`: a
  hand-written ES5 IIFE string doing parse + apply on `document`. No toString of bundled functions: the minifier
  makes that fragile.
- `src/hooks/use-session-hint-sync.ts`: `useSessionHintSync(isPending, session)`, an effect that runs
  `applySessionHint(document.documentElement, readSessionHint())` whenever either argument changes. It's a separate
  file so the hint core stays React-free and unit-testable.
- `src/lib/auth/session-hint-server.ts` (`import 'server-only'`; safe because only `seed:cuentas` imports auth, and
  it runs with `--conditions react-server`): `sessionHintCookieOptions(maxAgeSeconds)` (reads `env.COOKIE_DOMAIN`,
  `isProd`).
- `tests/auth/session-hint.test.ts` (bun test):
  - round trip with `Dueño A`, `Bar "La" Ñoña \`, emoji, newline, and 61+ chars;
  - garbage (bad JSON, bad `%`, `v:2`, unknown kind, missing label, a prefix-collision cookie `xtumbenla.session_hint=`);
  - **script equivalence:** `new Function('document', SESSION_HINT_SCRIPT)(fakeDoc)` gives the same dataset and
    property as `applySessionHint` for every case;
  - the `buildSessionHint` label rule (venue first in the given order; otherwise the person's name trimmed, else email).
- `package.json`: `"test:auth": "bun test tests/auth"`. `ci.yml`: a step after "Comercio transaccional".
- **Done when:** `bun run test:auth` passes and `bun run typecheck` is clean. Commit `[T1]`.

### [ ] T2: Server writers + lazy email + auth.ts in English (Opus)
- Impact first: `auth` (the exported const), mi-acceso `GET`.
- Before comparing `ctx.context.returned` with `null`, log its shape once for an anonymous `get-session`.
  better-call may wrap `ctx.json(null)`. Match the real shape and note it in a comment.
- Hooks also run for `auth.api.getSession()` inside Server Components. That's safe: `nextCookies()` wraps
  `cookies().set` in try/catch (`node_modules/better-auth/dist/integrations/next-js.mjs:50`), and better-auth
  already deletes cookies from that path today. A stale hint is then cleared by the next client `get-session` or by
  `mi-acceso`.
- `src/lib/auth/auth.ts`: add `hooks.after` exactly as in Design → Writers 1. Make the email stack lazy. The helper
  is `const loadEmail = async () => ({ ...(await import('@/components/emails')), ...(await import('@/lib/messaging/email')), ...(await import('@/lib/messaging/email/mailer')) })`,
  and it's destructured inside `afterEmailVerification`, `sendResetPassword` and `sendVerificationOTP`
  (already prototyped and measured during diagnosis). Translate identifiers (`origenesPropios` →
  `deploymentOrigins`, `candidatos`, `locales`, `valor`) and all the Spanish comments, keeping their reasoning.
- `src/app/api/mi-acceso/route.ts`: set, refresh or expire the hint on the response (Design → Writers 2). Keep
  `Cache-Control: no-store`.
- **Done when:** `typecheck` and `lint` are clean. On a local prod build (`bun run build && bun run start`):
  - `curl -si -X POST /api/auth/sign-in/email -H 'Origin: http://localhost:3000' …duenoa…` has
    `Set-Cookie: tumbenla.session_hint=` with `"k":"venue"`;
  - `/api/mi-acceso` with that session re-sets it;
  - `/api/auth/sign-out` sends it with `Max-Age=0`;
  - `get-session` with only a hint cookie (no session) expires it;
  - sending an OTP still works (`EMAIL_PROVIDER=log`, the code appears in the server log).
- Commit `[T2]`.

### [ ] T3: First-paint nav (Opus)
- Impact first: `RootLayout`, `AccountMenu` (HIGH), `SiteNav`, `NavLink`, `useMyAccess` (HIGH).
- `src/app/layout.tsx`: `<html … suppressHydrationWarning>`, then `<head><script dangerouslySetInnerHTML={{ __html: SESSION_HINT_SCRIPT }} /></head>`.
- `src/components/layout/account-menu.tsx`:
  - Extract the trigger class string into one const used by the real trigger and by the placeholder (they can't drift).
  - `isPending` branch renders: the "Entrar" `<Link>` with `in-data-[session=person]:hidden in-data-[session=venue]:hidden`,
    plus an `aria-hidden` `<span data-account-trigger>` lookalike that is `hidden in-data-[session=person]:inline-flex
    in-data-[session=venue]:inline-flex` with the venue lime styles under `in-data-[session=venue]:`. Its icons are
    `UserIcon`/`StoreIcon` toggled the same way, and the label is `<span className='max-w-32 truncate after:content-(--session-label)'/>`.
    Honour `variant`.
  - Add `data-account-trigger` to the real `MenuTrigger`.
  - Call `useSessionHintSync(isPending, session)`.
  - Update the header comment: the gap placeholder is replaced by the hint, and decision 23 still holds.
- `src/components/layout/site-nav.tsx`: `NavLink` gets an optional `className`. While `isPending`, render
  "Mi bar" (`href='/panel'`, which already redirects single-venue users) under `in-data-[session=venue]:`, and
  "Mi historia" under `in-data-[session=person]:`, in both the desktop and the mobile lists.
- `src/hooks/use-my-access.ts`: `placeholderData: hasSession ? () => accessFromHint(readSessionHint()) : undefined`,
  where `accessFromHint` lives here: venue → `{ admin: false, venues: [{ slug, name }] }`, person → `{ admin: false, venues: [] }`.
- Check the generated CSS contains the variants: `grep -o 'data-session' .next/static/**/*.css | head`.
- **Done when:** `typecheck` and `lint` are clean, the build succeeds, and there are no hydration warnings in the browser
  console. Quick Playwright check: with `**/_next/static/chunks/**` aborted, `/` shows "Entrar" (anon) or the venue
  label (duenoa). Commit `[T3]`.

### [ ] T4: Env/Zod out of the client bundle + urls.ts in English (Opus)
- Impact: `getBaseUrl` is CRITICAL (123 dependents), but the change keeps behaviour identical:
  - it reads `process.env.NEXT_PUBLIC_APP_URL`, `…_VERCEL_ENV`, `…_VERCEL_PROJECT_PRODUCTION_URL`,
    `…_VERCEL_BRANCH_URL` and `…_VERCEL_URL` as **literal** accesses, so Next inlines them;
  - `env.ts` still validates the same values at server boot (they're in its client schema, and
    `emptyStringAsUndefined` matches `limpia()`'s `''` → undefined).
  - Add a comment explaining why this file must not import `@/config/env`.
- Translate `conEsquema`, `limpia`, `explicita`, `produccion`, `despliegue` and the comments.
- **Done when:** the `/` HTML's chunks contain no `ZodError` and no `DATABASE_URL`
  (`curl -s localhost:3000/ | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u | xargs -I{} sh -c 'curl -s localhost:3000{} | grep -l -e ZodError -e DATABASE_URL'`
  prints nothing), and `typecheck`, `lint` and the build are clean. Commit `[T4]`.

### [ ] T5: Defer Sentry in the browser (Opus)
- Impact first: `onRouterTransitionStart`, `GlobalError`.
- New `src/lib/monitoring/sentry-browser.ts`:
  - `loadSentry()`: memoized `import('@sentry/nextjs')` + `init` with the current options from
    `instrumentation-client.ts`. Skip it entirely when `process.env.NEXT_PUBLIC_SENTRY_DSN` is empty.
  - `captureException(error)`: forwards once the SDK is loaded; before that, it queues and triggers the load.
- `instrumentation-client.ts`:
  - Early `error`/`unhandledrejection` listeners push into that queue and are removed after `init`, since
    Sentry's own global handlers take over.
  - Schedule `loadSentry` after `load` + `requestIdleCallback` (fallback `setTimeout`).
  - `export const onRouterTransitionStart = (...args) => loaded?.captureRouterTransitionStart(...args)`.
- `src/app/global-error.tsx`: use `captureException` from the loader. Its static `@sentry/nextjs` import is a
  second path onto the critical chunk set.
- **Done when:** `typecheck`, `lint` and the build are clean; none of the `/` HTML's initial chunks contains
  `__SENTRY__`; and a chunk loaded after `load` does (same curl pipeline as T4, plus the harness network log).
  Commit `[T5]`.

### [ ] T6: E2E specs (Sonnet)
- Move `authenticate()` from `e2e/flujo-principal.spec.ts` into `e2e/auth.ts` and import it from both specs.
- `e2e/session-hint.spec.ts` (runs through `e2e/run.ts`: isolated DB, port 3107, `NODE_ENV=test`, so no `__Secure-`):
  1. Anonymous, with `**/_next/static/chunks/**` aborted: "Entrar" visible, `[data-account-trigger]` hidden.
  2. `duenoa@prueba.local`, chunks aborted: the trigger is visible, `::after` content is `"Bar La Nona"`, and "Entrar" is hidden.
  3. `operador@prueba.local` (no venue), chunks aborted: the label is `"Operación"`.
  4. Owner with JS on: the sequence of visible trigger labels (MutationObserver + `::after`) never contains
     the person's name. One label from first paint to the end.
  5. Sign out from the menu: the hint cookie is gone. Reload with chunks aborted: "Entrar".
  6. Anonymous context with a hand-set stale hint: after load, get-session clears the cookie and "Entrar" shows.
- `e2e/client-bundle.spec.ts`: fetch the `/` HTML, fetch every initial `/_next/static/chunks/*.js`, and assert
  that none contains `DATABASE_URL` or `__SENTRY__`.
- Run: `bun run test:e2e e2e/session-hint.spec.ts e2e/client-bundle.spec.ts > log 2>&1`, and iterate until green.
- **Done when:** both specs are green, and so is the full `bun run test:e2e`. Commit `[T6]`.

### [ ] T7: Per-stage measurement + Sentry delivery (Sonnet)
- For each commit `[T3]`, `[T4]` and `[T5]`: `git switch --detach <sha>`, build, start, then run the harness for
  anon/person/venue, 4g, 3 runs. Return with `git switch perf/session-hint`, and confirm `git status` is clean.
- Auth function cold boot on the `[T5]` build (it includes T2; the baseline comes from T0b): run
  `node --env-file=.env -e 'const t=performance.now();require("./.next/server/app/api/auth/[...all]/route.js");console.log(performance.now()-t)'`
  ×5 and take the median.
- Sentry check on the `[T5]` build with a dummy `NEXT_PUBLIC_SENTRY_DSN`. Playwright intercepts `**/monitoring**`
  and fulfils 200, so nothing leaves the machine. Throw one error before `load`, via an init script, and one after.
  Both envelopes must be posted.
- Keep the numbers in your notes while detached (older commits have an older plan file). Back on
  `perf/session-hint`, fill in the Results table in `docs/plans/session-hint.md` and commit it as `[T7] measure per stage`.
  The dummy-DSN build is throwaway: rebuild without it before leaving.

### [ ] T8: Docs (Opus)
- `PRODUCT.md`:
  - New decision **46**: "the nav paints from the hint cookie, the session still arbitrates", with the why and the accepted edges above.
  - Amend decision 23's last sentence: the gap placeholder is replaced by the hint.
  - Rewrite the "La barra tarda ~2.6 s…" finding as resolved, with before/after numbers from Results.
  - Record that `urls.ts` reads `NEXT_PUBLIC_*` literally, and why.
  - Record the Sentry deferral trade-off.
  - Spanish-code inventory: 51 → 49 files with Spanish comments (`auth.ts`, `urls.ts` translated).
- `CLAUDE.md`, Important Notes #3: client code never imports `@/config/env`, directly or through a barrel (see `urls.ts`).
- `docs/react-patterns.md`: the trap "a barrel re-exporting a server module drags env.ts + Zod into every page".
- Commit `[T8]`.

### [ ] T9: Gate (Opus)
- `node .gitnexus/run.cjs detect-changes --scope compare --base-ref preview --repo tumbenla`: only expected
  symbols and flows.
- `git diff --check`, `typecheck`, `lint`, `test:auth`, `test:commerce`, and the full `test:e2e` (all logged to a file).
- Report the Results to the user and **ask** whether they'll test it manually or authorize the push + PR to `preview`.
  After the preview deploy, optionally re-run the harness against the preview URL.

## Results (to be filled in by T0b/T7; medians, local prod build, 4g)

| Metric | baseline | after T3 | after T4 | after T5 |
|---|---|---|---|---|
| anon: FCP / navCorrectAt / hydratedAt (ms) | | | | |
| person: FCP / navCorrectAt / labels | | | | |
| venue: FCP / navCorrectAt / labels | | | | |
| auth route cold boot (ms, local, median of 5) | T0b: (diag 122) | — | — | |

Targets: `navCorrectAt − FCP ≤ 50 ms` for all three from T3 on; venue `labels` has exactly one entry.
`hydratedAt` ≈ −390 ms at T4 and ≈ −740 ms at T5 relative to the previous column (±15 %).

## Verification (end to end)
1. `bun run test:auth`: parser, escaping, and the inline script matching `applySessionHint`.
2. `bun run test:e2e`: first paint is correct with JS blocked, for anon/person/venue; no label swap; sign-out;
   a stale hint gets cleared; no env or Sentry code in the initial chunks. It also re-runs the existing flows (auth
   shells in panel/admin).
3. The harness (T0b/T7): the Results table meets the targets.
4. The Sentry envelope check (T7): early and late errors are both delivered.
5. After the authorized push, the harness against the preview deployment.
