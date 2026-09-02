# Hyperframes Composition Brief: Tumbenla

## Objective

Create a short launch-style brag video for **Tumbenla** — a map of bars and clubs in Manizales that
put part of their sales into construction material after the earthquake, with every purchase receipt
published.

## Output

- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 21s

## Source Material

- Project root: `/Users/arturolopez/Documents/npi`
- Primary files read:
  - `PRODUCT.md` — the living product doc (positioning, the 25 locked decisions)
  - `src/app/(publico)/page.tsx` — hero, "El Combo", "El impacto se siente"
  - `src/app/(publico)/transparencia/page.tsx` — "A dónde va la plata", totals, split bars
  - `src/app/(publico)/mi-historia/page.tsx` — noches/sitios/fotos, "Aporte estimado"
  - `src/components/fiestas/galeria-de-la-noche.tsx` — the "Esa soy yo" claim button
  - `src/components/sitios/venue-card.tsx` — the map's venue card
  - `src/components/layout/le-entro.tsx` — the two-sided CTA
  - `src/app/_styles/globals.css` — the full oklch token set and the type scale
- Product name: **Tumbenla**
- Tagline / strongest claim: **Si no hay recibo, no pasó.**
- Key UI moments to recreate:
  1. the hero lockup (grain + halftone + orange bloom, black-weight uppercase display type)
  2. the map with orange pins and the lime-selected venue card
  3. the night gallery with the orange **ESA SOY YO** button flipping to a lime **GUARDADA**
  4. `/mi-historia`'s stat trio + "Aporte estimado" count-up
  5. `/transparencia`'s total, municipal split bars, and a published receipt card
- Copy that must appear verbatim (all Spanish, with accents — product decision #25):
  - `EL RITMO NOS LEVANTA`
  - `TUMBENLA` / `Y VOLVÁMOSLA A PARAR`
  - `MAPA DEL PARCHE`
  - `ESA SOY YO` → `GUARDADA`
  - `Una visita se registra reclamando una foto de esa noche.`
  - `APORTE ESTIMADO`
  - `Es un estimado, no un recibo.`
  - `A DÓNDE VA LA PLATA`
  - `REPARTO POR MUNICIPIO`
  - `SI NO HAY RECIBO, NO PASÓ.`

## Creative Direction

- Tone preset: `joy party`
- Creative direction: _afiche de calle de noche_ — a night-street poster. Party energy in the colour
  and the type, documentary honesty in the claims.
- Interpretation: fewer scenes, longer holds, confidence through restraint. Type slams in fast and
  then **sits**. The subject is an earthquake and a promise about money, so nothing winks and
  nothing exaggerates. Party energy lives in the palette and the tracking, not in the pacing.
- Angle: most impact products ask you to donate; this one asks you to go out on Friday like you
  always do, and then proves with a receipt what your night bought. The video is the chain of
  custody of a peso — night → venue → verification → cement → receipt — in order, with every link
  visible.
- Hook: black frame, then **TUMBENLA** slams in at display weight and **Y VOLVÁMOSLA A PARAR** lands
  a beat later in acid lime, turning the sentence around.
- Outro / punchline: everything drops to black except **SI NO HAY RECIBO, NO PASÓ.**, held longer
  than anything else, then a small wordmark and `tumbenla.com`.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - **Invented numbers.** Product decision #5 is "ninguna cifra inventada" — every figure on screen
    comes out of the database or does not render. The video may show plausible small figures inside
    a recreated UI, but must never present a growth stat, a user count, or a percentage the product
    does not itself compute.
  - **Stock nightlife imagery.** `page.tsx` carries an explicit comment about why the hero has no
    stock party photo: on a site about an earthquake it would be both generic and slightly
    dishonest. Hold that line — no crowd photos, no confetti, no party foley.

## Visual Identity

Exact tokens from `src/app/_styles/globals.css` (dark-only by product decision #6):

- Background: `oklch(0.188 0.03 265.9)`
- Card surface: `oklch(0.241 0.03 267.3)` · popover `oklch(0.286 0.029 267.6)`
- Secondary / bar track: `oklch(0.33 0.028 267.8)`
- Accent (brand orange, **fills only**): `oklch(0.676 0.196 41.9)`
- Orange **text** variant: `oklch(0.836 0.095 42.3)` — the fill orange fails AA as body text
- Party amber: `oklch(0.776 0.165 72.6)`
- Acid lime (**selection only**, 15.28:1): `oklch(0.917 0.226 129)`
- Text: `oklch(0.915 0.028 274.6)` · street white `oklch(0.982 0.002 247.8)`
- Muted text: `oklch(0.831 0.044 41.4)` · border `oklch(0.4 0.038 40.7)`
- Display font: **Anybody**, weight 900, uppercase, `letter-spacing: -0.04em`, `line-height: 1` —
  local file at `assets/fonts/anybody.woff2`
- Body font: **Montserrat** — local at `assets/fonts/montserrat.woff2`
- Label style: 700 weight, uppercase, `letter-spacing: 0.1em` (the wide-tracked metadata caps)
- Radii: cards `0.75rem` (xl), controls `0.5rem` (lg) — fixed steps, not derived
- Visual references from the project:
  - `.texture-grain` — the real film-grain plate, copied to `assets/img/grain.jpg`
  - `.halftone-overlay` — `radial-gradient(circle, currentColor 1px, transparent 1px)` at `4px 4px`,
    opacity 0.1
  - the hero's `50vw` orange blur bloom, top-right
  - the 2px card border that goes muted → amber (hover) → lime (selected)
  - `.glow-primary` / `.glow-lime` — depth in this system is made with light, not shadow

**Palette discipline — carry this into every scene:** lime appears in exactly ONE place per frame.
It is the selected state and nothing else (a written product decision: if lime shows up twice it
stops reading as selection). The hook line and the "GUARDADA" state and the selected pin each get it
in their own scene, never two at once.

## Storyboard

Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:

1. **El nombre** — 3.5s — "EL RITMO NOS LEVANTA" pill; TUMBENLA slams; Y VOLVÁMOSLA A PARAR lands in
   lime
2. **El mapa del parche** — 4.5s — 4 orange pins drop one by one; last goes lime; venue card slides
   up with its lime pledge chip
3. **"Esa soy yo"** — 4.5s — photo grid; oversized cursor clicks the orange ESA SOY YO; tile
   border + button flip to lime GUARDADA; caption holds
4. **El estimado** — 3.0s — NOCHES/SITIOS/FOTOS arrive; APORTE ESTIMADO counts up in orange tabular
   numerals; "Es un estimado, no un recibo." holds
5. **El recibo** — 3.5s — A DÓNDE VA LA PLATA; total in orange; two municipal split bars fill; a
   receipt card settles
6. **Si no hay recibo, no pasó** — 2.0s — black, one line held, then the small wordmark

Total: 21.0s

## Audio

- Audio role: warm rhythmic bed with sparse, motion-matched accents.
- Audio arc: confident and forward through scenes 1-4 → thinning and ducked under the receipt in
  scene 5 → **fully out** before the closing line in scene 6.
- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (120.19 BPM)
- Music treatment: fade in fast under the black frame, full by the wordmark hit, duck ~30% at the
  start of scene 5, fade to zero across the last ~1.5s so scene 6 is silent.
- Music cue guidance: preset at
  `~/.claude/skills/brag/assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.md`.
  Beat grid ~0.50s apart from 3.02s. Strong cues: 17.02, 17.52, 18.02, 18.52, 20.02, 21.01, 22.01,
  23.02, 23.52. Because the film is 21s and the hook must land at once, **offset the track**
  (`data-media-start`) so a strong cue sits under the wordmark slam rather than starting at 0 and
  waiting. Lock at most 3 major moments; snap sequential reveals to every other beat (~1.0s), never
  every beat — 0.5s outruns reading for text.
- Audio-reactive treatment: subtle. Drive only the hero's orange bloom opacity/scale and the grain
  intensity from music RMS. No waveform bars, no equalizer, no particles.
- Audio-coupled moments:
  - Scene 1 wordmark slam — one dry impact, beat-locked
  - Scene 2 pin drops — a soft tick per pin on the beat grid; a warmer one on selection
  - Scene 3 cursor click — one clean click on the press, one soft confirm on the lime state
  - Scene 4 count-up — light ticks under the number, ending on the settle
  - Scene 5 receipt card — one soft card/paper settle, and nothing else
  - Scene 6 — **nothing.** Silence is the cue.
- SFX selection guidance (chosen, already copied into `assets/sfx/`):
  - `impact/impactSoft_medium_001.ogg` — wordmark slam (low HF risk, "major reveal")
  - `interface/drop_002.ogg` — pin landing (soft drop, "element landing")
  - `interface/click_003.ogg` — the cursor press (low HF risk, repeatable)
  - `interface/switch_007.ogg` — the GUARDADA confirm
  - `casino/card-slide-1.ogg` — the receipt card settling (lowest-risk of the card family)
- SFX analysis guidance: `~/.claude/skills/brag/assets/sfx/sfx-analysis.md`. All five picks are low
  or medium high-frequency risk, per its "Lower-Risk Picks By Use Case" table.
- Exact SFX timestamps, density, and volume: Hyperframes decides, after the animation exists.
- Audio files: already copied into `brag-output/composition/assets/`.

## Hyperframes Instructions

Load `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion),
`hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe
keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the
`hyperframes` entry-point intent interview and do not route into its generic promo / launch-video
workflow. Prefer native Hyperframes conventions over anything in /brag.

Requirements:

- Show at least one real UI, copy, or visual element from the source project. (Five scenes do.)
- Keep all text readable: short label ≥0.8s settled, sentence ≥0.3s/word with a ~1.2s floor.
- Keep the video within 15-25 seconds. (21s.)
- Include the planned music/SFX layer.
- Treat /brag audio notes as guidance, not a fixed cue sheet.
- Treat music cue metadata as optional timing hints; ignore any cue that hurts readability.
- Major reveals may move within ±0.15s of a strong cue; smaller entrances within ±0.10s of a beat.
- Honor the ducking and the hard fade-to-silence before scene 6 — the silence is a creative
  requirement, not an oversight.
- Consider a subtle audio-reactive treatment on the bloom and grain only.
- Use local assets for audio, fonts, and textures. No network fetches at render time (determinism
  rule) — fonts are already local `woff2` files.
- Run `hyperframes check` before render — it is brag's single gate.

## Motion doctrine notes (from `motion-doctrine`)

- **The current is LEFT.** Ordinary seams move content leftward; reserve upward for the final line
  (elevation = conclusion) and spend nothing else.
- Cut mid-motion on both sides of each seam; no scene settles to rest before its cut and none starts
  from rest after one.
- **Carriers:** the cursor carries scene 3; the orange figure carries scene 4 → 5 (the estimate
  becomes the total — same colour, same tabular numerals, same screen position, which makes the seam
  a match-cut and is the whole argument of the video).
- **No idle wobble.** Each scene owns a sustained-motion route: 1 staged reveal, 2 sequenced UI
  life, 3 cursor-led action, 4 sequenced UI life, 5 sequenced UI life, 6 deliberate stillness (the
  one scene where stillness is the point).
- **Stillness before climax:** hold ~0.4s between the click in scene 3 and the GUARDADA state, and
  ~0.5s of black before the final line resolves.
