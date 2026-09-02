# Brag Plan: Tumbenla

## What is this app?

A map of bars and clubs in Manizales that put part of their sales into construction material after
the earthquake — and a public ledger of every receipt, so you can see exactly where the money went.
The money never touches the app. All it has is trust.

## The angle

Most "impact" products ask you to donate. This one asks you to go out on Friday like you always do —
and then proves, with a receipt, what your night bought.

The premise of the video is the **chain of custody of a peso**: night → venue → verification →
cement → receipt. Every link is visible, and the last link is a scanned invoice with a number on it.
The video is that chain, in order, in 21 seconds.

The line the whole product hangs on is already written into the transparency page:

> **Si no hay recibo, no pasó.**

That is the punchline. Everything before it is the setup.

What makes this specific and not generic: the palette is a night-street poster (deep blue-black,
brand orange, party amber, one acid lime used _only_ for selection), the type is black-weight
uppercase Anybody with -0.04em tracking, and every number in this product comes out of a database or
does not render at all (product decision #5: "Ninguna cifra inventada"). The video honours that — no
invented metrics, no fake dashboard numbers. The receipt is the metric.

## Hook (first 2-3 seconds)

Black frame. The wordmark slams in at display weight, uppercase, in two lines — and the second line
is the reversal:

**TUMBENLA** / **Y VOLVÁMOSLA A PARAR**

("Knock it down" / "and let's put it back up.") The first word lands hard on a downbeat with an
impact hit; the second line arrives a beat later in acid lime and turns the sentence around. The
hook _is_ the name, because the name already contains the whole idea. Halftone grain and an orange
bloom breathe behind it.

## Key moments (the middle)

- **The map of Manizales** with orange pins dropping in one by one, then one pin going lime
  (selection) and its venue card sliding up: name in black uppercase, a lime pledge chip in the
  corner, cover photo in `mix-blend-luminosity` that bleeds back into colour.
- **"Esa soy yo."** The photo grid from a night. A cursor arrives, clicks one photo's orange button,
  and the tile's border turns lime with a check — "Guardada". This is the entire consumer product in
  one gesture, and it is the reason a visit is counted at all (a "were you here" button would be
  inflatable by clicking; a claimed photo is not).
- **The estimate, labelled as an estimate.** "Aporte estimado" counts up in tabular numerals — and
  the honest caption arrives right under it: _un estimado, no un recibo._ The product's own
  restraint is the flex.
- **The receipt.** "A DÓNDE VA LA PLATA", the total in orange, and the municipal split bars filling.
  This is where the estimate becomes a fact.

## Outro / punchline

Everything drops away to black except one line, held longer than anything else in the video:

**SI NO HAY RECIBO, NO PASÓ.**

Then the wordmark, small, with `tumbenla.com`. No CTA shouting. The restraint is the point — this is
a product whose only asset is trust, and a video that oversold would contradict it.

## User flow worth showing

Three beats, all real screens:

1. **Entry** — `/sitios`, the map of the parche. Pins on Manizales; hover pairs a card to its pin;
   the pin goes lime when selected.
2. **Key action** — `/sitios/[slug]/noches/[nightId]`, the night's gallery. Find your face, hit
   **"Esa soy yo"**, tile locks to lime + "Guardada".
3. **Result** — `/mi-historia` (noches / sitios / fotos + _Aporte estimado_), handing off to
   `/transparencia` where the estimate is answered by a published receipt with quantities and a
   date.

## Tone

- Preset: `polished`
- Creative direction: _afiche de calle de noche_ — a night-street poster. Party energy in the colour
  and the type, documentary honesty in the claims.
- Interpretation: fewer scenes, longer holds, confident restraint. Motion is energetic but never
  frantic; the type slams and then _sits_. The subject is an earthquake and a promise about money,
  so nothing winks, nothing exaggerates, and no number appears that the product wouldn't render.
  Party energy lives in the palette and the tracking, not in the pacing.

## Format: landscape — 1920x1080

## Duration: 21s

## Visual identity (from the project)

Pulled from `src/app/_styles/globals.css` (oklch, dark-only by product decision #6).

- Background: `oklch(0.188 0.03 265.9)` — deep blue-black
- Surface / card: `oklch(0.241 0.03 267.3)`, popover `oklch(0.286 0.029 267.6)`
- Accent (brand orange, fills only): `oklch(0.676 0.196 41.9)`
- Orange **text** variant: `oklch(0.836 0.095 42.3)` — the fill orange fails AA on body text
- Party amber: `oklch(0.776 0.165 72.6)`
- Acid lime (selection only, 15.28:1): `oklch(0.917 0.226 129)`
- Text: `oklch(0.915 0.028 274.6)`, street white `oklch(0.982 0.002 247.8)`
- Display font: **Anybody** — black (900), uppercase, -0.04em tracking, line-height 1
- Body font: **Montserrat**
- Strongest visual element: the hero — gradient + halftone overlay + film grain, with a 50vw orange
  blur bloom top-right; and the 2px card border that switches from muted → amber on hover → lime on
  selection.

**Palette discipline (carry this into the composition):** lime appears in exactly one place per
scene. It is the selected state and nothing else. If lime shows up twice at once it stops reading as
selection — that is a written product decision, and breaking it in the video would misrepresent the
design system.

## Share copy (draft)

Construimos Tumbenla: un mapa de los bares de Manizales que ponen parte de sus ventas en material de
construcción — y el recibo de cada compra, público. La plata no pasa por la app. Si no hay recibo,
no pasó.

## Audio direction

- Role: warm rhythmic bed with professional, motion-matched accents. Present enough to carry a
  night-out feeling, restrained enough that the receipt scene lands quiet.
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (120.19 BPM) — the most forward of
  the bundled tracks, which suits nightlife without turning into a hype edit.
- Music treatment: start at 0.0s under the black frame, up to full by the wordmark hit, hold through
  the map and claim scenes, then **duck roughly 30% under the receipt scene** and fade out across
  the last 1.5s so the closing line sits in near-silence. The drop in energy at the end is the tonal
  argument of the video.
- Music cue guidance: preset read from
  `assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.md`. Beat grid is
  ~0.50s from 3.02s. Strong cues to target for major moments: **17.02s**, **18.52s**, **20.02s**,
  **23.02s**. Because the film is 21s and the hook must land immediately, offset the track so a
  strong cue sits under the wordmark slam rather than starting the track at 0 and waiting —
  Hyperframes should pick the offset. Sequential reveals (map pins, stat cards, split bars) ride the
  beat grid on **every other beat (~1.0s)**, never every beat: 0.5s is fine for a pin dropping, too
  fast for a line of text.
- Audio-reactive treatment: subtle. The hero's orange bloom and the grain may breathe with music
  RMS. No waveform bars, no visualiser — this is a poster, not a music video.
- SFX posture: sparse and motion-matched. One impact on the wordmark, soft ticks as pins drop, one
  clean click on "Esa soy yo", one soft confirm on "Guardada", a paper/settle sound on the receipt.
  Silence on the closing line.
- Audio-coupled moments: the wordmark slam; pins dropping one by one; the cursor click and the lime
  confirm; the estimate counter ticking; the split bars filling.
- Restraint rule: **no sound at all on the final line.** Nothing rises under "Si no hay recibo, no
  pasó" — no swell, no logo sting, no riser. If the audio tries to sell that line, the line stops
  being true. Also: no crowd noise, no cheering, no party foley. The product deliberately refuses to
  dress an earthquake in stock nightlife imagery (see the comment in `page.tsx` about why the hero
  has no stock party photo), and the audio holds the same line.

## Storyboard

### Scene 1 — El nombre — 3.5s

Near-black stage. Grain + halftone + a slow orange bloom top-right. The pill "EL RITMO NOS LEVANTA"
fades in small and lime-on-dark. Then the wordmark, in two lines, black-weight uppercase Anybody at
display scale: **TUMBENLA** slams in on a strong cue; a beat later **Y VOLVÁMOSLA A PARAR** arrives
in acid lime. Hold the full lockup ~1.4s — this is the hook line and gets the most reading time.
Sequential/interaction: yes — two-part text arrival, line 2 landing one beat after line 1, then a
full settled hold. Audio intent: the room turning on. One dry impact under the first word.
Audio-coupled idea: beat-aligned reveal; impact hit on TUMBENLA. Music: forward, warm, immediate.
Transition mood: clean → Scene 2

### Scene 2 — El mapa del parche — 4.5s

Cut to the map surface: dark basemap, "MAPA DEL PARCHE" as a small display label top-left. Four
orange pins drop onto Manizales one at a time on every other beat. The last pin turns **lime** and
its venue card slides up beside it — 2px border in lime, a lime pledge chip in the corner ("10% DE
LA NOCHE"), venue name in black uppercase, cover photo desaturated then bleeding back into colour.
Sequential/interaction: yes — 4 pins arriving ~1.0s apart, then one selection promoting a pin to
lime and pulling its card up. Audio intent: arrivals. Small, dry, satisfying — a place appearing,
not a notification. Audio-coupled idea: a soft tick per pin drop; a slightly warmer one on
selection. Music: steady, unchanged. Transition mood: soft slide → Scene 3

### Scene 3 — "Esa soy yo" — 4.5s

The night's photo grid, six tiles, dark cards with muted borders. An oversized cursor enters from
the lower right and moves to one tile. Its orange button reads **ESA SOY YO**. Click. The tile's
border snaps to lime, the button flips to a lime outline with a check: **GUARDADA**. Caption
beneath, held: _Una visita se registra reclamando una foto de esa noche._ Sequential/interaction:
yes — simulated cursor move + click on a real button, with the state change as the payoff. Audio
intent: the single most tactile moment in the film. One clean click, one soft confirm — then let it
sit. Audio-coupled idea: click SFX on the press, a quiet confirm on the lime state. Music: holds; no
build. Transition mood: clean cut → Scene 4

### Scene 4 — El estimado — 3.0s

`/mi-historia`. Three small stat cards arrive fast and hold together: **NOCHES 6**, **SITIOS 3**,
**FOTOS 11**. Then the framed block: label "APORTE ESTIMADO" in wide-tracked caps, and the figure
counting up in orange tabular numerals to a COP amount. Immediately under it, in muted body text and
held long enough to read: **Es un estimado, no un recibo.** Sequential/interaction: yes — 3 stat
cards in quick succession, then the counter. Cards may ride the beat grid; the honest caption gets a
full settled hold and is NOT snapped to a fast beat. Audio intent: forward motion, then a small
catch of breath on the caption. Audio-coupled idea: light ticks under the count-up, ending on the
settle. Music: steady, beginning to thin. Transition mood: soft crossfade → Scene 5

### Scene 5 — El recibo — 3.5s

`/transparencia`. "A DÓNDE VA LA PLATA" in display caps, "la plata" in orange text. The total in
large orange tabular numerals inside the 2px orange-bordered block. Beside it, "REPARTO POR
MUNICIPIO" and two bars filling left-to-right (orange, then amber) with their percentages. A receipt
card settles in below with a date and a quantity, the way a published purchase actually renders.
Sequential/interaction: yes — bars fill in sequence, ~1.0s apart, then the receipt card settles.
Audio intent: the music **ducks here**. This is the scene that has to feel like evidence, not
marketing. Audio-coupled idea: one soft paper/settle sound as the receipt card lands. Nothing else.
Music: ducked ~30%, thinning toward the fade. Transition mood: soft fade to black → Scene 6

### Scene 6 — Si no hay recibo, no pasó — 2.0s

Black. One line, centred, display caps, street white with **RECIBO** in orange: **SI NO HAY RECIBO,
NO PASÓ.** Held nearly the whole scene — this is the longest single read in the film. Then, small
and quiet at the bottom: the TUMBENLA wordmark and `tumbenla.com`. Sequential/interaction: none.
Deliberate stillness. Audio intent: **nothing rises.** The music has already faded out. The line is
delivered in near-silence and the film ends without a sting. Audio-coupled idea: none — this is the
restraint rule. Music: faded out by the start of the hold. Transition mood: end.

**Total: 3.5 + 4.5 + 4.5 + 3.0 + 3.5 + 2.0 = 21.0s**

**Music mood for this video:** upbeat and warm through scenes 1-4, thinning and ducking through
scene 5, gone by scene 6. **Audio summary:** a night that starts loud and confident, and ends by
getting quiet enough to show you the receipt.

---

## Guion final — la campana, conseguida sin DSP

Escenas: 0 / 2.7 / 6.9 / 11.7 / 14.1 / 16.8 / 23.6 — total **29.0s**, en
horizontal y vertical.

### Se descartó el arreglo por DSP

Imponer la campana con `rubberband --pitchmap` **sonaba partido**. Se revirtió
por completo: no queda una sola muestra procesada en la locución.

### Lo que sí funcionó: bajar `stability`

Con la ortografía **`cieerto`** (la *e* alargada, no la *o*) y el guion
`¿Quée chimba, cieerto?`, se muestrearon tomas midiendo el F0 de la última
palabra:

| Ajuste | tomas | resultado |
|---|---|---|
| stability 0.40 / style 0.45 | 17 | ninguna campana — el modelo cae siempre |
| **stability 0.20 / style 0.60** | 6 | **campana a la segunda** |

`stability` baja = prosodia más expresiva. Ese es el parámetro que lo destrabó,
no la ortografía ni la puntuación.

**Medido en el render final: `242 → 288 → 308 → 282 Hz`** — arranca bajo, sube,
y baja. Esa línea usa 0.20/0.60; las otras seis siguen en 0.40/0.45.

### Detalle que casi se cuela

Había **dos tomas** con esos mismos ajustes y el `glob` tomó la equivocada
(226 → 187 → 169 → 187, sin campana). Se detectó midiendo las dos por separado
antes de dar nada por bueno.
