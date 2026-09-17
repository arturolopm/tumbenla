# Agent instructions

**The guide for this repo is [`CLAUDE.md`](./CLAUDE.md). Read it.**

**Codex entry point:** then read [`docs/agent-workflows.md`](./docs/agent-workflows.md).
It defines the supported procedures for skills, department reviews, experiments, GitNexus,
media, loops, and handoffs. Its runtime mappings take precedence over tool-specific invocation
instructions in imported skills and generated sections below; `PRODUCT.md` still governs product
decisions. Referenced `.claude/` files are readable procedures, not a requirement to launch Claude.

This file used to be a byte-identical copy of it. Two copies of the same 11 KB document drift, and
they did: both spent months describing a `next-intl` setup that had already been deleted from the
codebase. So this one is a pointer now.

Below are only the things that most often trip an agent up here. Everything else is in `CLAUDE.md`.

## Gotchas worth knowing before you touch anything

- **Never push automatically to a deployed branch.** A green test suite is evidence, not release
  authorization. Unless the active user request explicitly says this change may be pushed, stop
  after local validation and ask whether the user will test it manually or authorizes an automatic
  push. A push instruction from an earlier change is not standing permission for later fixes.
- **This repo is run as an organization, not a codebase.** Three departments with their own standing
  docs and subagents: Producto (`PRODUCT.md`), Crecimiento (`org/crecimiento/`), Datos (the schema).
  The charter is `org/ORG.md` and they only talk through `org/crecimiento/EXPERIMENTOS.md`. The 50
  marketing skills from `coreyhaines31/marketingskills` are installed but **filtered** — they assume
  a B2B SaaS with a price, and this product takes no money at all. Read
  `.agents/product-marketing.md` before letting any of them write a word, and
  `org/crecimiento/VOZ.md` before writing copy yourself.
- **There is no i18n.** No `[locale]` segment, no `src/i18n/`, no `src/messages/`. `next-intl` is
  not installed. Routes are flat and all copy is Spanish, written inline. `proxy.ts` at the repo
  root is Next 16's renamed `middleware.ts` and is currently a no-op passthrough.
- **Global styles live at `src/app/_styles/globals.css`**, not `src/app/globals.css`. It is Tailwind
  v4 CSS-first: there is no `tailwind.config.ts`. That one file owns nearly the whole visual
  identity.
- **The app is dark-only.** `<html>` carries a hardcoded `className="dark"`; there is no theme
  provider and `next-themes` is not installed.
- **`(site)` is not a route group in the routing sense.** No `layout.tsx`, no `page.tsx`, so it
  produces no URLs. It is a bag of landing-page sections that `src/app/page.tsx` imports by relative
  path.
- **`decimal` columns come back from postgres-js as strings**, not numbers. Money and coordinates
  both. `Number()` them at the mapper boundary or you get a silently blank map and NaN totals.
- **IDs are supplied by the application**, never by the database. Use `createId()` from
  `@/lib/utils/id`. There is no `serial` and no `defaultRandom()` anywhere.
- **Formatting is Biome, not Prettier**: single quotes, **no semicolons**, 2-space indent, 100
  columns. Run `bun run lint`.
- **Admin access is an env allowlist** (`ADMIN_EMAILS`) and requires a verified email. A layout gate
  does not protect server actions; call `assertAdmin()` inside each one.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **tumbenla** (4622 symbols, 10147 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/tumbenla/context` | Codebase overview, check index freshness |
| `gitnexus://repo/tumbenla/clusters` | All functional areas |
| `gitnexus://repo/tumbenla/processes` | All execution flows |
| `gitnexus://repo/tumbenla/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
