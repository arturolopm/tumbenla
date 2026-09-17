# City gate handoff

Objective: implement PRODUCT.md's existing city gate acceptance on `/sitios`.
Branch: `feat/vender-el-trago-doctrina`. No commits. Preserve all pre-existing dirty work.

## Files in this slice

- `src/app/(publico)/sitios/page.tsx`: wrap existing content in CityGate and Suspense;
  keep ISR and existing explorer/empty state.
- `src/components/sitios/city-gate.tsx`: client URL subscription, inactive-city message,
  configured cities in progress and nearest-active CTA preserving other query parameters.
- `src/lib/cities/gate.ts`: URL > saved manual choice > geo cookie; defensive reads.
- `scripts/test-city-gate.ts`: dependency-free checks for configured cities, precedence,
  accented names, malformed cookies, unavailable browser storage and fail-open behavior.
- `PRODUCT.md`: implementation status and verified findings only; prior edits retained.
- `docs/plans/city-gate.md`: this handoff.

Manual choices persist in the existing `tumbenla:ciudad` localStorage key, so returning
from a venue or via the public nav retains them without changing map/card links.
`?ciudad=` and unknown overrides explicitly open access and save an empty value.
Remove that storage key to resume IP detection. When storage is unavailable, the URL
still works, but persistence across routes without the parameter is unavailable.
The initial HTML and Suspense fallback show normal content; the gate applies after hydration.
No proxy/config/explorer edits, dependencies, product decisions or unrelated formatting.

## Verification

- GitNexus status: indexed/current commit `2c4b71b`, up to date. Relevant source files
  were clean at entry and context matched SitiosPage's calls to explorer and queries.
- Upstream impact before editing SitiosPage: LOW, 0 direct callers, 0 affected processes.
- `bun scripts/test-city-gate.ts`: passed.
- Targeted `bunx biome check` on the four code files above: passed.
- `git diff --check`: passed.
- `bun run build`: passed after starting the local Docker PostgreSQL service. It confirms
  `/sitios` is static/ISR with 300-second revalidation. The build logs non-blocking local
  pooler warnings from the database configuration.
- Browser validation against the local dev server: `?ciudad=pereira` showed the inactive-city
  gate and active-city CTA; an active-city override showed the normal explorer; the CTA from
  `?ciudad=pereira&vista=mapa` preserved `vista=mapa` while selecting the active city.
- GitNexus `detect-changes --scope unstaged`: whole dirty tree reports CRITICAL because it
  includes pre-existing panel/action work. This slice's pre-edit impact was LOW. Do not infer
  that whole-tree result is the city gate's blast radius.

## Remaining validation

1. In preview, validate Vercel IP geolocation end to end: `proxy.ts` should write
   `tumbenla-geo` and a recognized inactive city should show the gate without `?ciudad=`.
2. Test the gate on mobile and desktop, including keyboard focus, browser back/forward, and
   same-route Next Link navigation.
3. Before committing, separate the city-gate slice from the 25+ pre-existing dirty files;
   run `detect-changes` on the intended staged scope, `git diff --check`, the city-gate script,
   targeted Biome, and `bun run build` again. No commit was made in this session.
