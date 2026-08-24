# ShipFree - AI Agent Onboarding Guide

## Product roadmap

`PRODUCT.md` at the repo root is the living product doc: current state, decisions
already taken (with the reason, so they are not re-litigated), the roadmap, and
the accumulated technical debt and findings with file paths.

**Read it before proposing product changes**, and update it when you take a
decision, find a trap, or finish something on the roadmap. It outranks the
original build plan in `~/.claude/plans/` where the two disagree.

## Flujo de ramas

`local (Docker) -> PR -> preview -> PR -> main (produccion)`

Todo PR va contra `preview`. A `main` solo llega lo que ya se valido alli, y
`.github/workflows/ci.yml` lo hace cumplir. Detalles y trampas en `PRODUCT.md`.

## Overview

ShipFree is a production-ready Next.js boilerplate designed to help developers ship startups quickly. It's a free, open-source alternative to ShipFast, built with modern web technologies and best practices.

### Key Characteristics
- **Framework**: Next.js  with App Router
- **Runtime**: Bun (package manager and runtime)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better-Auth with multiple OAuth providers
- **Payments**: Multi-provider support (Stripe, Polar, Lemon Squeezy, Creem)
- **Email**: Multi-provider support (Resend, Postmark, Plunk, Nodemailer)
- **UI**: TailwindCSS 4, BaseUI components, Shadcn-style patterns
- **Language**: Spanish only. There is no i18n library (next-intl was removed upstream in `8b458d9`); copy is written directly into components
- **Monitoring**: Sentry integration
- **Storage**: Cloudflare R2 support

## Architecture

### Project Structure

Application code lives under `src/`. The path alias `@/*` maps to `src/*` (e.g. `@/lib/auth` is `src/lib/auth`).

```
ShipFree/
├── src/                    # Application source
│   ├── app/                # Next.js App Router pages and routes
│   │   ├── (auth)/         # Authentication pages (login, register, etc.)
│   │   ├── (publico)/      # Public Tumbenla pages (sitios, transparencia)
│   │   ├── (admin)/        # Operator-only pages, gated by requireAdmin()
│   │   ├── (site)/         # Landing-page section components (NOT routes)
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # Better-Auth endpoints
│   │   │   ├── payments/   # Payment processing
│   │   │   └── webhooks/   # Webhook handlers
│   │   └── _providers/     # React context providers
│   ├── components/         # Reusable React components
│   │   ├── emails/        # Email templates (React Email)
│   │   └── ui/            # BaseUI/Shadcn UI components
│   ├── config/            # Configuration files
│   │   ├── env.ts        # Environment variable validation (t3-env)
│   │   ├── payments.ts   # Payment plans and pricing
│   │   ├── branding.ts   # Brand configuration
│   │   └── feature-flags.ts
│   ├── database/          # Database schema and connection
│   │   ├── schema.ts     # Drizzle ORM schema
│   │   └── index.ts      # Database connection
│   ├── lib/               # Core libraries and utilities
│   │   ├── auth/         # Authentication setup
│   │   ├── payments/     # Payment service and adapters
│   │   ├── messaging/    # Email service and providers
│   │   ├── storage.ts    # Cloudflare R2 storage client
│   │   └── utils/        # Utility functions
│   └── hooks/             # React hooks
├── scripts/               # Runtime scripts (e.g. migrate.ts)
├── migrations/            # Drizzle migrations
├── drizzle.config.ts      # Drizzle Kit config
└── instrumentation*.ts    # Sentry and Next.js instrumentation
```

### Key Patterns

#### 1. **Server Components by Default**
- Most components are Server Components unless marked with `'use client'`
- Client components are used for interactivity (forms, state, etc.)

#### 2. **Route Groups**
- `(auth)`, `(publico)`, `(admin)` are route groups: they organize layouts without
  affecting the URL
- `(site)` is the exception. It has no `layout.tsx` and no `page.tsx`, so it produces
  no routes at all. It is a folder of landing-page section components that
  `src/app/page.tsx` imports by relative path

#### 3. **Language: Spanish, no i18n layer**
- Routes are flat. There is no `[locale]` segment, no `src/i18n/`, no `src/messages/`
- `next-intl` is NOT installed. `getTranslations` / `useTranslations` do not exist here
- All user-facing copy is written in Spanish directly in the component
- `proxy.ts` at the repo root (Next 16's renamed `middleware.ts`) is a no-op passthrough
- Do not reintroduce an i18n library without being asked

#### 4. **Environment Configuration**
- All env vars validated via `@t3-oss/env-nextjs` in `src/config/env.ts`
- Server-only vars in `server` object
- Client-accessible vars in `client` object (prefixed with `NEXT_PUBLIC_`)

## Code Style

### TypeScript

- **Strict mode**: Enabled
- **Path aliases**: `@/*` maps to `src/*`
- **No implicit any**: Enabled

### React Patterns

1. **Component Naming**: PascalCase
2. **File Naming**: kebab-case for files, PascalCase for components
3. **Hooks**: Prefix with `use`
4. **Event Handlers**: Prefix with `handle` (e.g., `handleClick`)
5. **Const over function**: Prefer `const fn = () => {}` over `function fn() {}`

### Styling

- **TailwindCSS**: Primary styling method
- **No CSS files**: Avoid custom CSS, use Tailwind classes
- **Class utilities**: Use `cn()` from `src/lib/utils/css.ts` (or `@/lib/utils/css.ts`) for conditional classes

## Common Tasks

### Adding a New Page

1. Create file in `src/app/(group)/page.tsx`
2. Add metadata export if needed
3. Use appropriate layout group
4. Write the copy in Spanish, directly in the component

### Adding an API Route

1. Create file in `src/app/api/{route}/route.ts`
2. Export `GET`, `POST`, etc. functions
3. Validate input with Zod
4. Handle errors gracefully
5. Return JSON responses

### Adding a Database Table

1. Define schema in `src/database/schema.ts`
2. Add relations if needed
3. Generate migration: `bun run generate-migration`
4. Run migration: `bun run migrate:local`
5. Commit the generated files in `migrations/` together with the schema change —
   they are tracked in git so every environment applies identical SQL

### Adding a UI Component

1. Use BaseUI components from `src/components/ui/`
2. Follow existing component patterns
3. Add proper TypeScript types
4. Include accessibility attributes
5. Use Tailwind for styling

### Adding Email Template

1. Create template in `src/components/emails/`
2. Use React Email components
3. Add subject in `src/components/emails/subjects.ts`
4. Export render function
5. Use in auth flows or custom emails

## Development Workflow

### First-time setup (once per machine)

1. Install dependencies: `bun install`
2. Copy `.env.example` to `.env` (defaults work for local development)
3. Start Postgres: `bun run db:up` (Docker Desktop must be running)
4. Apply migrations: `bun run migrate:local` — `migrations/` is committed, so
   nothing is generated here
5. Start dev server: `bun dev`

Steps 3-4 are wrapped in `bun run setup`. Full guide: `docs/quickstart.mdx`.

### Starting again afterwards

`bun run db:up && bun dev`. The setup is not repeated. Run `bun install` only
when dependencies change, and `bun run migrate:local` only when a new migration
is committed. Data lives in the `pgdata` Docker volume and survives restarts.

### Scripts

- `bun dev`: Start development server
- `bun build`: Build for production
- `bun start`: Start production server
- `bun lint`: Run linter
- `bun format`: Format code
- `bun generate-migration`: Generate DB migration
- `bun migrate:local`: Run migrations locally
- `bun run setup`: db:up + migrate:local
- `bun run db:up` / `db:down` / `db:reset` / `db:logs` / `db:psql`: Local services
  (defined in `compose.yaml` at the repo root: Postgres on 5432, Mailpit on 8025)

### Email

Resend is the default provider in every environment, so local testing uses the
same delivery path as production; only `DEFAULT_FROM_EMAIL` differs. Requires
`RESEND_API_KEY`. Resend only sends from a verified domain — until one exists,
`onboarding@resend.dev` is the sender and it delivers only to the Resend
account's own address. Set `EMAIL_PROVIDER=nodemailer` to capture mail in the
local Mailpit container instead (http://localhost:8025). Without a key the
mailer degrades to Mailpit locally. See `docs/email/providers.mdx`.

### Testing

- No test framework configured yet
- Manual testing recommended
- Use Sentry for error tracking in production

## Important Notes

1. **Bun Runtime**: This project uses Bun, not Node.js
2. **Server Components**: Default to Server Components, use `'use client'` only when needed
3. **Environment Variables**: Always validate via `src/config/env.ts`
4. **Database**: Use Drizzle ORM, not raw SQL
5. **Authentication**: Use Better-Auth client/server APIs, don't access DB directly
6. **Payments**: Use payment service, don't call providers directly
7. **Email**: Use email mailer, don't call providers directly
8. **Language**: All user-facing text is Spanish, written inline. There is no translation layer
9. **Error Handling**: Always handle errors gracefully with proper messages
10. **Type Safety**: Leverage TypeScript, avoid `any` types

## Resources

- **Better-Auth**: https://better-auth.com
- **Drizzle ORM**: https://orm.drizzle.team
- **Next.js**: https://nextjs.org/docs
- **BaseUI**: https://base-ui.com

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ShipFree** (1673 symbols, 3445 relationships, 126 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| `gitnexus://repo/ShipFree/context` | Codebase overview, check index freshness |
| `gitnexus://repo/ShipFree/clusters` | All functional areas |
| `gitnexus://repo/ShipFree/processes` | All execution flows |
| `gitnexus://repo/ShipFree/process/{name}` | Step-by-step execution trace |

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
