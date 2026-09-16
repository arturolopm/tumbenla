# Owner, map, and scanner fixes

## Objective

Resolve the eleven reported issues in the isolated `codex/owner-ux-fixes` worktree without
changing the short public venue-application flow or weakening venue isolation.

## Constraints

- Base branch: `preview`.
- CARTO raster tiles do not require an API key; remove the stale environment prompt.
- `/api/geocode` stays closed to anonymous traffic. Platform operators may use it for new venues;
  verified owners may use it only for a venue they own.
- The public application remains the four-field flow from product decision 35. Address and pin
  editing happen after approval in the authorized panels.
- Product publication keeps the 40% server-side minimum.
- A cash order is scanned before staff learn that they must collect payment.

## Checklist

- [x] Remove the stale CARTO key requirement from local/preview configuration.
- [x] Make authorized owner geocoding work and place the pin from the entered address.
- [x] Revalidate the existing approval-email path end to end.
- [x] Add an obvious "register another venue" path under the owner panel's Sites section.
- [x] Make the global account trigger show the venue active in the current panel URL.
- [x] Make Map of the Patch search explicit for venue name and city.
- [x] Let owners choose draft or immediate publication when saving a product.
- [x] Cap public venue cover-image height.
- [x] Open "Cómo llegar" in Google Maps with the saved coordinates.
- [x] Source the footer mailbox from `DEFAULT_REPLY_TO`, with a safe public fallback.
- [x] Make cash collection unmistakable, clarify completion, add motion, and add recent history.
- [x] Update durable product notes and relevant automated coverage.
- [x] Run formatting, lint, typecheck, focused tests, full commerce tests, build, browser journeys,
  GitNexus change detection, and diff checks.

## Friction review

- Address lookup: one explicit click is required because Nominatim does not permit per-keystroke
  autocomplete. The click returns value immediately by placing the first matching pin.
- Draft versus publish: the choice is required because the two states have different public
  effects. It is presented as two submit actions, not a confirmation modal.
- Scanner history: optional disclosure avoids slowing the primary scan path and returns value only
  when staff need to recall a recent order.
- Starting another order: the success card itself resets the scanner, so there is no extra
  confirmation after delivery has been recorded.

## Validation

- `rg` finds no runtime or example reference that requires `NEXT_PUBLIC_CARTO_BASEMAP_KEY`; a
  production build also passes with that variable explicitly unset.
- `bun run typecheck`, `bun run lint`, and `git diff --check` pass. Lint retains three unrelated
  pre-existing warnings outside this change.
- The PostgreSQL commerce suite passes: 100 tests, 386 assertions.
- The production browser harness passes all 12 journeys, including approval email delivery,
  anonymous/owner geocoder gates, multi-venue switching, both product-save choices, Google Maps,
  footer configuration, paid redemption, cash collection, and scanner history.
- The final GitNexus change audit reports the expected critical aggregate risk because publication
  reaches checkout and redemption reaches the order ledger; those paths are covered by the suites
  above.
