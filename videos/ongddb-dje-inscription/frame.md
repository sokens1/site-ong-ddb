---
version: alpha
name: ONG DDB — Isometric Frame (video / frame layer)
description: >
  Bespoke frame system for the ONG DDB « Déjeuner Environnemental » registration tutorial.
  A 3D isometric motion-design world: floating isometric platforms (tiles with visible top +
  two side faces), a real iPhone mockup carrying the captured screens, isometric props
  (calendar, envelope, ticket, check badge, plant pots, trees) and soft long shadows,
  on the brand's deep forest green. Poppins display + Work Sans body, both from the site.
unit: the frame — 1080×1920 (9:16) primary
principle: brand is sacred · the captured screens are the truth · numbers come from the site

colors:
  forest: "#0B3D22"        # canvas — deep brand green (site background family)
  forest-deep: "#052E16"   # vignette / far plane / side face of dark tiles
  green: "#16A34A"         # primary brand green (CTA buttons on the site)
  green-dark: "#15803D"    # side face of green tiles
  mint: "#86EFAC"          # progress-bar green, highlights, glows
  mint-pale: "#D1FAE5"     # top face of light tiles, chips
  cream: "#F4F1E8"         # paper, cards, light top faces
  white: "#FFFFFF"         # type on dark, phone screen surround
  ink: "#0B2416"           # type on light surfaces
  sun: "#F2B632"           # warm accent — one hero per frame (stars, highlight, sun)
  orange: "#F97316"        # « J'y serai ! » orange (poster ribbon) — reserve for the J'y serai beat + final CTA
  sky: "#2DD4BF"           # cool secondary accent, rare
  shadow: "rgba(2, 20, 10, 0.35)"

typography:
  display:  { fontFamily: "Poppins", weight: 800, px: 132, lineHeight: 0.95, tracking: "-0.03em", upper: true }
  headline: { fontFamily: "Poppins", weight: 800, px: 92, lineHeight: 1.0, tracking: "-0.02em" }
  title:    { fontFamily: "Poppins", weight: 700, px: 64, lineHeight: 1.05, tracking: "-0.01em" }
  step-num: { fontFamily: "Poppins", weight: 900, px: 220, lineHeight: 0.85, tracking: "-0.05em" }
  label:    { fontFamily: "Poppins", weight: 700, px: 30, tracking: "0.16em", upper: true }
  body:     { fontFamily: "Work Sans", weight: 500, px: 40, lineHeight: 1.35 }
  chip:     { fontFamily: "Work Sans", weight: 600, px: 32 }

spacing:
  pad: "80px"
  safe-top: "220px"     # keep clear for platform UI
  safe-bottom: "360px"  # caption band + platform UI
  gap: "36px"

components:
  iso-tile:
    description: >
      The universal 3D primitive. A box drawn in true isometric (30°) projection: top face +
      left face + right face, 3 tones of one hue (top lightest, left mid, right darkest).
      Build with CSS: a wrapper `transform: rotateX(60deg) rotateZ(-45deg)` with
      `transform-style: preserve-3d`, top face = div, side faces = divs rotated 90° with
      `transform-origin` at the edge; OR as inline SVG polygons (preferred for props).
    faces: "top {colors.mint-pale|cream|green} · left darker 12% · right darker 24%"
    shadow: "long soft ground shadow: blurred ellipse {colors.shadow}, offset down-right"
  phone:
    description: >
      iPhone-style mockup, corner radius 64px, 14px dark bezel (#0A0F0C), dynamic-island pill,
      holding a captured screen (1170×2532 png, object-fit cover). Shown either flat-facing
      (for readability) or tilted into isometric space (rotateX(55deg) rotateZ(-35deg)) standing
      on an iso-tile platform. The screen must be readable whenever narration explains it:
      flat or ≤ 20° tilt during explanation; isometric tilt only for establishing/transition.
  callout:
    description: >
      Zoom-lens callout: a white rounded-rect (28px radius) magnifying a region of the screen
      at 1.8–2.4×, with a mint 4px ring and a thin connector line to the source region.
  step-badge:
    description: "Circle 120px {colors.sun} with {typography.step-num}-scaled numeral in {colors.ink}, iso drop shadow."
  chip:
    description: "Pill 9999px, {colors.cream} fill, {colors.ink} {typography.chip}; mint variant for « ✓ » confirmations."
  props:
    description: >
      Isometric SVG props drawn in the 3-tone face rule: calendar (30 OCT), envelope (billet),
      ticket, check-badge, plant pots, low-poly trees, speech bubble, map pin (Auditorium AGL),
      clock (08H30). Flat colors only, no gradients except a subtle top-face highlight.
  atmosphere:
    description: >
      Every frame: forest canvas + radial mint glow (8–14%) behind the focal + faint isometric
      grid (1px lines at ±30°, mint 6% opacity) + 3–6 floating leaf/particle elements drifting.

---

# ONG DDB — Isometric Frame

## Overview

A **3D isometric world on deep forest green**. The registration journey is staged as a
little island-world: each step is a floating isometric platform; the phone (with the real
captured screen) travels from platform to platform. The camera **zooms** into the phone to
read a field, then pulls back to the island. Props built in true isometric projection give the
"portfolio motion design" feel; the captured screens give the truth.

## The Frame

- **Canvas:** 1080×1920. Safe area: 80px sides, 220px top, 360px bottom (captions).
- **Container law:** the frame ground sets `container-type: size`; size with px against the
  1080×1920 frame (or cqw/cqh) — never `vw`.
- **Isometric law:** every 3D object uses the same projection (30° iso) and the same light:
  light from top-left → top face lightest, left face mid, right face darkest. Long soft ground
  shadows fall down-right. One projection, one light, everywhere.

## Colors

`forest` is the ground. Light tiles use `cream`/`mint-pale` top faces; brand tiles use `green`.
`sun` is the single warm hero accent per frame. `orange` is reserved for the « J'y serai ! »
beat and the final CTA so it lands as a reward. Never introduce colors outside this list.

## Typography

- Poppins 800 uppercase for the big beat words (« 1 MINUTE », « ÉTAPE 1 »), Poppins 700 for
  titles in sentence case, Work Sans for small explanatory chips.
- Legibility floor on 9:16 mobile: nothing load-bearing under 36px.
- Max ~6 words on screen at once besides the captured UI — the voice explains, the type punches.

## Depth & Surface

- 3D comes from **geometry** (iso faces), not from blur. Shadows: soft ground ellipses only.
- Phone gets a 40px blurred shadow `rgba(0,0,0,0.45)` when flat-facing.

## Composition Rules

### Do
- Keep the captured screen readable when it is being explained (flat or slight tilt, zoom-lens).
- Use the zoom-lens callout or a camera push-in to point at the exact field being explained.
- Build each step's platform with 1–2 relevant props (step 1: ID card/avatar; step 2: graduation
  cap/briefcase; step 3: ticket + plate/cocktail; confirmation: envelope + check; J'y serai:
  frame/poster + sparkles).
- Show the « Étape X sur 3 » progress as a 3-segment isometric progress bar.

### Don't
- No invented numbers: only 3 étapes, 30 octobre 2026, 08H30, Auditorium AGL, 300 places,
  25 000 / 15 000 FCFA (only if shown on the captured screen).
- No blurred-glass SaaS cards; no gradients beyond the subtle top-face highlight and glows.
- Never fake the site's UI — use the captured screenshots.

## Approved Entities

ONG DDB (Développement Durable et Bien-Être) logo: `capture/assets/ong-ddb.png`. Event poster:
`capture/assets/le-dejeuner-environnemental-2026.jpg`. J'y serai visual:
`capture/assets/62-poster-jy-serai.png`. Partner logos appear only inside the captured poster.

## Shared components (copy these EXACTLY — every frame uses the same pieces)

Sizes below are px on the 1080×1920 canvas. Prefix the class names / symbol ids with your
`<frame_id>-` as the worker contract requires (shown here as `X-`). Visual values are fixed.

**1 · iPhone holding a captured screen.** Default width 500px (scale the whole wrapper with
GSAP `scale`, never by changing width). Screen image = a captured `assets/NN-*.png`
(1170×2532). To "scroll" a long screen, translate the `<img>` up inside `.X-screen`.

```html
<div class="X-phone"><div class="X-screen"><img src="assets/21-step1-filled-top.png" alt=""></div><i class="X-island"></i></div>
```
```css
.X-phone{position:absolute;width:500px;aspect-ratio:1170/2532;border-radius:66px;background:#0A0F0C;padding:14px;
  box-shadow:0 40px 80px rgba(0,0,0,.45),inset 0 0 0 3px #26302B}
.X-screen{position:relative;width:100%;height:100%;border-radius:52px;overflow:hidden;background:#fff}
.X-screen img{position:absolute;left:0;top:0;width:100%;display:block}
.X-island{position:absolute;top:30px;left:50%;margin-left:-70px;width:140px;height:36px;border-radius:20px;background:#0A0F0C}
```
On-screen coordinates: a point at (u,v) in the 1170×2532 screenshot sits at
`left + 14 + u*(472/1170)`, `top + 14 + v*(472/1170)` for the default 500px phone
(screen scale ≈ 0.4034). Use this to aim taps, lenses and zooms precisely.

**2 · Isometric props (inline SVG `<symbol>`s).** Paste this `<svg>` defs block once inside your
template, rename ids with your prefix (symbol ids must differ from any element id, e.g. `X-sym-check`), and place props with `<svg class="X-prop" style="left:…;top:…;width:…;height:…"><use href="#X-tile-mint"/></svg>`.
Light from top-left: top face lightest, left mid, right darkest.

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="X-tile-cream" viewBox="0 0 200 130"><polygon points="100,0 200,50 100,100 0,50" fill="#F4F1E8"/><polygon points="0,50 100,100 100,130 0,80" fill="#D9D3C2"/><polygon points="100,100 200,50 200,80 100,130" fill="#BDB59F"/></symbol>
<symbol id="X-tile-mint" viewBox="0 0 200 130"><polygon points="100,0 200,50 100,100 0,50" fill="#D1FAE5"/><polygon points="0,50 100,100 100,130 0,80" fill="#86EFAC"/><polygon points="100,100 200,50 200,80 100,130" fill="#4ADE80"/></symbol>
<symbol id="X-tile-green" viewBox="0 0 200 130"><polygon points="100,0 200,50 100,100 0,50" fill="#22C55E"/><polygon points="0,50 100,100 100,130 0,80" fill="#16A34A"/><polygon points="100,100 200,50 200,80 100,130" fill="#15803D"/></symbol>
<symbol id="X-shadow" viewBox="0 0 200 60"><ellipse cx="110" cy="30" rx="95" ry="22" fill="rgba(2,20,10,.45)"/></symbol>
<symbol id="X-calendar" viewBox="0 0 120 130"><polygon points="10,30 70,0 110,20 50,50" fill="#F4F1E8"/><polygon points="10,30 50,50 50,128 10,108" fill="#D9D3C2"/><polygon points="50,50 110,20 110,98 50,128" fill="#fff"/><polygon points="50,50 110,20 110,40 50,70" fill="#16A34A"/><g transform="matrix(1,-0.5,0,1,50,75)"><text x="30" y="34" font-family="Poppins" font-weight="900" font-size="30" fill="#0B2416" text-anchor="middle">30</text><text x="30" y="50" font-family="Poppins" font-weight="700" font-size="11" fill="#16A34A" text-anchor="middle">OCT.</text></g></symbol>
<symbol id="X-pin" viewBox="0 0 80 120"><path d="M40 0c22 0 38 16 38 37 0 26-38 63-38 63S2 63 2 37C2 16 18 0 40 0z" fill="#F97316"/><path d="M40 0c22 0 38 16 38 37 0 26-38 63-38 63z" fill="#EA580C"/><circle cx="40" cy="36" r="14" fill="#fff"/><ellipse cx="40" cy="110" rx="22" ry="8" fill="rgba(2,20,10,.4)"/></symbol>
<symbol id="X-seat" viewBox="0 0 60 70"><polygon points="5,30 35,15 55,25 25,40" fill="#86EFAC"/><polygon points="5,30 25,40 25,62 5,52" fill="#16A34A"/><polygon points="25,40 55,25 55,47 25,62" fill="#15803D"/><polygon points="35,15 55,25 55,0 35,-10" fill="#4ADE80"/></symbol>
<symbol id="X-stopwatch" viewBox="0 0 120 130"><rect x="52" y="0" width="16" height="14" rx="3" fill="#F2B632"/><circle cx="60" cy="72" r="54" fill="#D9A21F"/><circle cx="56" cy="68" r="54" fill="#F2B632"/><circle cx="56" cy="68" r="42" fill="#F4F1E8"/><circle cx="56" cy="68" r="6" fill="#0B2416"/></symbol>
<symbol id="X-envelope" viewBox="0 0 160 120"><polygon points="10,50 90,10 150,40 70,80" fill="#FFFFFF"/><polygon points="10,50 70,80 70,94 10,64" fill="#D9D3C2"/><polygon points="70,80 150,40 150,54 70,94" fill="#BDB59F"/><polygon points="10,50 90,10 150,40 82,47" fill="#F4F1E8" stroke="#BDB59F" stroke-width="2" stroke-linejoin="round"/><circle cx="82" cy="47" r="11" fill="#16A34A"/></symbol>
<symbol id="X-check" viewBox="0 0 120 120"><circle cx="64" cy="64" r="54" fill="#15803D"/><circle cx="58" cy="58" r="54" fill="#86EFAC"/><path d="M32 60 L52 80 L86 40" fill="none" stroke="#0B3D22" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="X-cocktail" viewBox="0 0 100 140"><polygon points="10,20 90,20 50,70" fill="#2DD4BF"/><polygon points="50,70 90,20 70,20" fill="#14B8A6"/><rect x="47" y="70" width="6" height="45" fill="#F4F1E8"/><ellipse cx="50" cy="118" rx="24" ry="8" fill="#F4F1E8"/><circle cx="72" cy="14" r="9" fill="#F2B632"/></symbol>
<symbol id="X-gradcap" viewBox="0 0 140 100"><polygon points="70,5 135,35 70,65 5,35" fill="#0B2416"/><polygon points="35,48 70,64 105,48 105,72 70,88 35,72" fill="#1F3B2B"/><line x1="120" y1="40" x2="120" y2="78" stroke="#F2B632" stroke-width="5"/><circle cx="120" cy="80" r="6" fill="#F2B632"/></symbol>
<symbol id="X-tree" viewBox="0 0 80 130"><rect x="36" y="80" width="10" height="40" fill="#7C4A2D"/><polygon points="40,0 78,70 40,92 2,70" fill="#22C55E"/><polygon points="40,0 78,70 40,92" fill="#15803D"/></symbol>
<symbol id="X-leaf" viewBox="0 0 60 40"><path d="M2 38C10 8 40 0 58 2 54 24 30 40 2 38z" fill="#86EFAC"/><path d="M2 38C20 26 36 14 58 2" stroke="#15803D" stroke-width="2" fill="none"/></symbol>
</defs></svg>
```
The stopwatch hands are separate elements so they can rotate: put two `<div>` hands (6px wide,
ink + green, `transform-origin: bottom center`) over the dial centre and rotate them with GSAP.
Iso "people tokens": a mint or green rounded cylinder (`border-radius: 40% / 30%`) + a cream circle head, with an iso shadow.

**3 · Step header** (frames 04–06): sun badge 120px circle (`#F2B632`, Poppins 900 72px ink numeral,
hard shadow `8px 12px 0 rgba(2,20,10,.4)`) at left 80 / top 150; title (Poppins 700 64px white)
at left 230 / top 160; 3-segment progress bar at left 230 / top 250: three 170×36 rounded-10px
blocks, gap 16px, off = `#052E16` with `inset 0 -8px 0 rgba(0,0,0,.3)`, on = `#86EFAC` with
`inset 0 -8px 0 #16A34A` (fill a segment by scaling an inner mint bar `scaleX` 0→1 from the left).

**4 · Chip.** Pill 9999px, padding 16px 34px, Work Sans 600 34px, cream `#F4F1E8` fill + ink text,
hard shadow `6px 10px 0 rgba(2,20,10,.35)`. Variants: mint (`#86EFAC`, selected — prefix « ✓ »),
sun (`#F2B632`), orange (`#F97316`, white text — frames 08–09 only).

**5 · Tap ring.** 120px circle, 8px `#F2B632` border, plus an expanding ripple ring
(scale 1→2.2, opacity .6→0). The touched button presses (scale .94 → 1, smooth).

**6 · Zoom-lens callout.** Rounded 28px white box with a 8px `#86EFAC` border and
`0 20px 40px rgba(0,0,0,.4)` shadow, `overflow:hidden`, containing the SAME screenshot scaled
~2× and offset so the named field sits in the lens centre. A 4px mint connector line joins the
lens to the field on the phone.

**7 · Atmosphere** (every frame, as the full-bleed background clip): `#0B3D22` fill +
radial-gradient mint glow `rgba(134,239,172,.16)` behind the focal + an isometric grid
(two `repeating-linear-gradient`s at ±30°, 1px mint lines every 64px, opacity .07) + 4–6
`X-leaf` particles that drift once across the frame (finite, positions derived from index).

## Font loading

Brand fonts ship locally in `assets/fonts/` — do NOT link Google Fonts. Paste this `<style>`
into every frame's `<head>`/`<template>`:

```html
<style>
@font-face{font-family:'Poppins';font-style:normal;font-weight:400;font-display:block;src:url("assets/fonts/Poppins-400.woff2") format('woff2');}
@font-face{font-family:'Poppins';font-style:normal;font-weight:500;font-display:block;src:url("assets/fonts/Poppins-500.woff2") format('woff2');}
@font-face{font-family:'Poppins';font-style:normal;font-weight:600;font-display:block;src:url("assets/fonts/Poppins-600.woff2") format('woff2');}
@font-face{font-family:'Poppins';font-style:normal;font-weight:700;font-display:block;src:url("assets/fonts/Poppins-700.woff2") format('woff2');}
@font-face{font-family:'Poppins';font-style:normal;font-weight:800;font-display:block;src:url("assets/fonts/Poppins-800.woff2") format('woff2');}
@font-face{font-family:'Poppins';font-style:normal;font-weight:900;font-display:block;src:url("assets/fonts/Poppins-900.woff2") format('woff2');}
@font-face{font-family:'Work Sans';font-style:normal;font-weight:400;font-display:block;src:url("assets/fonts/WorkSans-400.woff2") format('woff2');}
@font-face{font-family:'Work Sans';font-style:normal;font-weight:500;font-display:block;src:url("assets/fonts/WorkSans-500.woff2") format('woff2');}
@font-face{font-family:'Work Sans';font-style:normal;font-weight:600;font-display:block;src:url("assets/fonts/WorkSans-600.woff2") format('woff2');}
@font-face{font-family:'Work Sans';font-style:normal;font-weight:700;font-display:block;src:url("assets/fonts/WorkSans-700.woff2") format('woff2');}
</style>
```
