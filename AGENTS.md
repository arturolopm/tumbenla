# Agent instructions

**The guide for this repo is [`CLAUDE.md`](./CLAUDE.md). Read it.**

This file used to be a byte-identical copy of it. Two copies of the same 11 KB
document drift, and they did: both spent months describing a `next-intl` setup
that had already been deleted from the codebase. So this one is a pointer now.

Below are only the things that most often trip an agent up here. Everything else
is in `CLAUDE.md`.

## Gotchas worth knowing before you touch anything

- **There is no i18n.** No `[locale]` segment, no `src/i18n/`, no `src/messages/`.
  `next-intl` is not installed. Routes are flat and all copy is Spanish, written
  inline. `proxy.ts` at the repo root is Next 16's renamed `middleware.ts` and is
  currently a no-op passthrough.
- **Global styles live at `src/app/_styles/globals.css`**, not `src/app/globals.css`.
  It is Tailwind v4 CSS-first: there is no `tailwind.config.ts`. That one file owns
  nearly the whole visual identity.
- **The app is dark-only.** `<html>` carries a hardcoded `className="dark"`; there is
  no theme provider and `next-themes` is not installed.
- **`(site)` is not a route group in the routing sense.** No `layout.tsx`, no
  `page.tsx`, so it produces no URLs. It is a bag of landing-page sections that
  `src/app/page.tsx` imports by relative path.
- **`decimal` columns come back from postgres-js as strings**, not numbers. Money and
  coordinates both. `Number()` them at the mapper boundary or you get a silently blank
  map and NaN totals.
- **IDs are supplied by the application**, never by the database. Use `createId()` from
  `@/lib/utils/id`. There is no `serial` and no `defaultRandom()` anywhere.
- **Formatting is Biome, not Prettier**: single quotes, **no semicolons**, 2-space
  indent, 100 columns. Run `bun run lint`.
- **Admin access is an env allowlist** (`ADMIN_EMAILS`) and requires a verified email.
  A layout gate does not protect server actions; call `assertAdmin()` inside each one.
