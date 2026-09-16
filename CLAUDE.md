# Always

Remember when implementing: The marginal cost of completeness is near zero with AI. Do the whole
thing. Do it right. Do it with tests. Do it with documentation. Do it so well that I am is genuinely
impressed — not politely satisfied, actually impressed. Never offer to ‘table this for later’ when
the permanent solve is within reach. Never leave a dangling thread when tying it off takes five more
minutes. Never present a workaround when the real fix exists. The standard isn’t ‘good enough’ —
it’s ‘holy shit, that’s done.’ Search before building. Test before shipping. Ship the complete
thing. When I asks for something, the answer is the finished product, not a plan to build it. Time
is not an excuse. Fatigue is not an excuse. Complexity is not an excuse. Boil the ocean.

# ShipFree - AI Agent Onboarding Guide

## Agent runtime compatibility

This is the shared repository guide, despite its historical filename. Codex and other agents
must also read [the portable workflows](docs/agent-workflows.md) before using local agent tooling.
That document governs runtime substitutions for imported skills and generated GitNexus guidance;
it preserves the impact-analysis and pre-commit checks below. No Claude session, hook, or plugin
is required. Product decisions remain in `PRODUCT.md`.

## Product roadmap

`PRODUCT.md` at the repo root is the living product doc: current state, decisions already taken
(with the reason, so they are not re-litigated), the roadmap, and the accumulated technical debt and
findings with file paths.

**Read it before proposing product changes**, and update it when you take a decision, find a trap,
or finish something on the roadmap. It outranks the original build plan in `~/.claude/plans/` where
the two disagree.

## La organizacion

Tumbenla se opera como una empresa chiquita con tres departamentos. `org/ORG.md` es la carta: quien
decide que, y como se hablan.

| Departamento | Documento de pie                 | Agente        | Decide                                                    |
| ------------ | -------------------------------- | ------------- | --------------------------------------------------------- |
| Producto     | `PRODUCT.md`                     | `producto`    | alcance, roadmap, y si algo choca con una decision tomada |
| Crecimiento  | `org/crecimiento/CRECIMIENTO.md` | `crecimiento` | mensaje, canal, publico, que experimento se propone       |
| Datos        | `org/datos/METRICAS.md`          | `datos`       | si una cifra se puede afirmar                             |

El codigo no es un departamento: es el taller donde los tres trabajan, y lo gobierna este archivo.
El arbol de `org/` es el organigrama: `crecimiento/` (adquisicion, retencion, voz, publicos, y las
piezas producidas en `piezas/`) y `datos/` (definicion y consulta de cada cifra). `PRODUCT.md` se
queda en la raiz porque la leen los tres, no solo Producto.

**Se hablan por un solo canal:** `org/crecimiento/EXPERIMENTOS.md`. Un experimento va `Propuesto`
(Crecimiento) -> `Medible` (Datos) -> `Aprobado` (Producto) -> `En curso` -> `Cerrado`, y no se
salta ningun estado. Si la metrica no existe, no arranca. El procedimiento
[`experimento`](docs/agent-workflows.md#experiments) corre el ciclo en cualquier agente;
`/experimento` es solo el alias de Claude.

Antes de escribir cualquier copy, lee `org/crecimiento/VOZ.md`. Estan instaladas las 50 skills de
marketing de `coreyhaines31/marketingskills`; son de un SaaS B2B con precio y plan, asi que **se
usan filtradas** — la tabla de cual si y cual no esta en `org/ORG.md`, y las prohibiciones que
mandan sobre todas ellas estan en `.agents/product-marketing.md`.

## Flujo de ramas

`local (Docker) -> PR -> preview -> PR -> main (produccion)`

Todo PR va contra `preview`. A `main` solo llega lo que ya se valido alli, y
`.github/workflows/ci.yml` lo hace cumplir. Detalles y trampas en `PRODUCT.md`.

## Overview

ShipFree is a production-ready Next.js boilerplate designed to help developers ship startups
quickly. It's a free, open-source alternative to ShipFast, built with modern web technologies and
best practices.

### Key Characteristics

- **Framework**: Next.js with App Router
- **Runtime**: Bun (package manager and runtime)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better-Auth with multiple OAuth providers
- **Payments**: Multi-provider support (Stripe, Polar, Lemon Squeezy, Creem)
- **Email**: Multi-provider support (Resend, Postmark, Plunk, Nodemailer)
- **UI**: TailwindCSS 4, BaseUI components, Shadcn-style patterns
- **Language**: Spanish only. There is no i18n library (next-intl was removed upstream in
  `8b458d9`); copy is written directly into components
- **Monitoring**: Sentry integration
- **Storage**: Cloudflare R2 support

## Architecture

### Project Structure

Application code lives under `src/`. The path alias `@/*` maps to `src/*` (e.g. `@/lib/auth` is
`src/lib/auth`).

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

- `(auth)`, `(publico)`, `(admin)` are route groups: they organize layouts without affecting the URL
- `(site)` is the exception. It has no `layout.tsx` and no `page.tsx`, so it produces no routes at
  all. It is a folder of landing-page section components that `src/app/page.tsx` imports by relative
  path

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

### El idioma del codigo es INGLES. El español es solo lo que el usuario lee

**Identificadores, tipos, nombres de archivo y COMENTARIOS van en ingles.** Sin excepcion y sin
mezclar: `redeemOrder`, no `redimirOrden`; `ledgerEntry`, no `asientoDelLibro`. Un comentario en
español dentro de una funcion con nombre en ingles es la peor de las dos opciones.

**En español va unicamente lo que aparece en pantalla:** el texto de una etiqueta, un mensaje de
error que lee una persona, el copy de un correo, una URL. Esos siguen con sus tildes (decision 25) y
siguen mandando `VOZ.md`.

```ts
// bien
const MOTIVO_TEXTO = { ya_redimido: 'Ese trago ya se entregó.' }; // NO
const REASON_TEXT = { already_redeemed: 'Ese trago ya se entregó.' }; // si
```

Por que: el producto es solo de Manizales, pero el codigo lo lee cualquiera que entre al repo, y
media libreria del stack ya esta en ingles. Un `venueId` al lado de un `saldoDeSitio` obliga a
traducir mentalmente en cada linea.

**Hay deuda de esto y se paga EN EL CAMINO.** Son 57 archivos y 81 exports con nombre en español (el
inventario esta en `PRODUCT.md`, "Deuda y hallazgos"). La regla: **el archivo que toques para otra
cosa, lo pasas a ingles en ese mismo PR.** No se abre un PR de puro renombrar —cruza medio arbol de
importaciones y no hay quien lo revise— salvo que se dedique una sesion entera a eso.

O sea: si vas a editar `src/lib/comercio/libro.ts` por cualquier motivo, aprovechas y traduces sus
nombres y comentarios. Si no lo ibas a tocar, lo dejas quieto.

### No se escribe a mano lo que ya resuelve una libreria

**Formularios: `react-hook-form` + `zod` por el resolver.** Nada de un `useState` por campo,
arreglos de errores y banderas de "mostrar error". Esa maraña ya costo un fallo real: el login leia
el correo del DOM y la contraseña del estado de React, y con el autocompletado del navegador la
contraseña iba vacia.

**Peticiones desde el cliente: `@tanstack/react-query`**, que ya esta instalado. Nada de `fetch`
dentro de un `useEffect` con su propio `useState` de carga, su propio error y su propio bucle de
sondeo.

**La excepcion son las server actions.** Un `<form action={...}>` con `useActionState` NO es codigo
escrito a mano: es la primitiva de React para esto, valida en el servidor —que es donde tiene que
validar— y lee del FormData, asi que es inmune al problema del autocompletado. Esos formularios se
quedan como estan.

En general: antes de escribir un helper, mirar si el stack ya lo trae.

Los patrones concretos —contenedor/presentacion, cuando un efecto sobra, contadores como hook— y
los fallos que ya mordieron viven en `docs/react-patterns.md`.

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
- **Class utilities**: Use `cn()` from `src/lib/utils/css.ts` (or `@/lib/utils/css.ts`) for
  conditional classes

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
5. Commit the generated files in `migrations/` together with the schema change — they are tracked in
   git so every environment applies identical SQL

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
4. Apply migrations: `bun run migrate:local` — `migrations/` is committed, so nothing is generated
   here
5. Start dev server: `bun dev`

Steps 3-4 are wrapped in `bun run setup`. Full guide: `docs/quickstart.mdx`.

### Starting again afterwards

`bun run db:up && bun dev`. The setup is not repeated. Run `bun install` only when dependencies
change, and `bun run migrate:local` only when a new migration is committed. Data lives in the
`pgdata` Docker volume and survives restarts.

### Scripts

- `bun dev`: Start development server
- `bun build`: Build for production
- `bun start`: Start production server
- `bun lint`: Run linter
- `bun format`: Format code
- `bun generate-migration`: Generate DB migration
- `bun migrate:local`: Run migrations locally
- `bun run setup`: db:up + migrate:local
- `bun run db:up` / `db:down` / `db:reset` / `db:logs` / `db:psql`: Local services (defined in
  `compose.yaml` at the repo root: Postgres on 5432, Mailpit on 8025)

### Email

Resend is the default provider in every environment, so local testing uses the same delivery path as
production; only `DEFAULT_FROM_EMAIL` differs. Requires `RESEND_API_KEY`. Resend only sends from a
verified domain — until one exists, `onboarding@resend.dev` is the sender and it delivers only to
the Resend account's own address. Set `EMAIL_PROVIDER=nodemailer` to capture mail in the local
Mailpit container instead (http://localhost:8025). Without a key the mailer degrades to Mailpit
locally. See `docs/email/providers.mdx`.

### Testing

- No test framework configured yet
- Manual testing recommended
- Use Sentry for error tracking in production

### Friction review

Before adding or preserving a user or operator step, use
`docs/ux-friction-review.md`. Every click, field, wait, or new screen must name
the irreducible risk it prevents and why an existing check does not already
cover it. If a human or technical verification has already covered that risk,
remove the step or defer it until it returns value. Record durable decisions in
`PRODUCT.md` and cross-product handoffs in `docs/plans/`.

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

This project is indexed by GitNexus as **tumbenla** (4405 symbols, 9689 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
