---
format: 1080x1920
duration: 60s
arc: Demo Loop — hook → event intro → 3-step demo cycle → result → bonus → CTA
music: upbeat optimistic afro-pop underscore, light percussion, bright and modern
language: fr
---

## Video direction

- **World:** one isometric island-world on the `forest` canvas (frame.md). Same 30° projection, same top-left light, same soft ground shadows in every frame. Every frame has the atmosphere layer (radial mint glow behind the focal + faint isometric grid + a few drifting leaf particles that drift ONCE across the frame, finite, deterministic).
- **Shared components:** use the exact snippets in frame.md § Shared components (iPhone, iso tiles, props, progress bar, step badge, chip, tap ring). Never redraw them differently — continuity across frames depends on it.
- **Palette roles:** forest = ground; cream / mint-pale / green = tile tops; mint = progress, ✓, highlights; sun = the ONE hero accent per frame (step badge, key word); orange only in frames 08 and 09 (« J'y serai ! » and the final CTA). White display type on forest.
- **Type roles:** display (Poppins 800 uppercase) for punch words; title (Poppins 700) for step titles; chip (Work Sans 600) for option pills; label for small caps kickers.
- **Motion grammar:** smooth long-tail settles (`power3`; `expo.out` on fast arrivals). Overshoot is allowed ONLY for the tap ripple, the ✓ badge stamp and the « J'y serai ! » ribbon (explicitly playful moments). Every piece reveals when the voiceover names it (word timings given per frame); never front-load. Isometric objects enter by rising up from below their ground shadow (shadow fades in first, object lands into it). Camera moves are done on one `.world` wrapper (zoom-to-target / push), only in the FIRST half of a scene, never a slow back-half drift.
- **Rhythm / held frames:** Frame 03 is a quick beat (no hold). Frames 04–06 share one rhythm (badge → bar fills → screen → callouts). Frame 07 is the breather/relief hold after the demo. Frame 08 is the climax; Frame 09 ends on a 1 s still hold of the CTA card.
- **Screens:** captured screenshots are the truth — always inside the shared iPhone; readable (flat or ≤ 20° tilt) when the voice explains them. Zoom-lens callouts magnify the exact region named.
- **Caption keep-out:** nothing important in the bottom 17% (y > 1594 px).
- **Negative list:** no slideshow (front-load then freeze), no screensaver (everything floating), no lazy breathing loops, no `repeat`/`yoyo`, no Math.random, no blurred-glass cards, no purple/blue AI gradients, no invented figures, no fake UI.

## Frame 1 — Une minute, chrono

- duration: 6.792s
- transition_in: cut
- status: outline
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Friction reduction (time promise)
- beat: curiosity + urgency
- blueprint: kinetic-type-beats (Adapt)
- focal: kinetic type « UNE MINUTE » + stopwatch
- roles: ong-ddb.png = supporting (small signature, top-left)
- sfx: whoosh-soft, impact-soft, clock-tick

<fill in: this video's content for the "Une minute, chrono" beat — keep the layout role, replace the words.>

## Frame 2 — L'événement

- duration: 9.117s
- transition_in: zoom-through
- status: outline
- src: compositions/frames/02-event.html
- type: product_intro
- persuasion: Scarcity/urgency (300 places)
- beat: intrigue + FOMO
- blueprint: zoom-out-workspace-reveal (Adapt)
- focal: assets/10-event-hero.png
- roles: 10-event-hero.png = cutout (inside the shared iPhone) · le-dejeuner-environnemental-2026.jpg = supporting (floating poster card)
- sfx: whoosh, pop-soft, pop-soft, pop-soft

<fill in: this video's content for the "L'événement" beat — keep the layout role, replace the words.>

## Frame 3 — Toucher « S'inscrire »

- duration: 3.161s
- transition_in: crossfade
- status: outline
- src: compositions/frames/03-tap.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: ease
- blueprint: cursor-ui-demo (Adapt)
- focal: assets/11-event-cta.png
- roles: 11-event-cta.png = cutout (in the iPhone, large) · 20-step1-empty.png = cutout (slides up as the sheet)
- sfx: tap, swoosh-up

<fill in: this video's content for the "Toucher « S'inscrire »" beat — keep the layout role, replace the words.>

## Frame 4 — Étape 1 : qui êtes-vous ?

- duration: 6.792s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/04-step1.html
- type: feature_showcase
- persuasion: Rule of three (3 étapes)
- beat: clarity + control
- blueprint: device-surface-showcase (Adapt)
- focal: assets/21-step1-filled-top.png
- roles: 20-step1-empty.png = cutout (initial screen) · 21-step1-filled-top.png = cutout (screen after fill + lens source)
- sfx: pop-soft, key-type, key-type, key-type, tap

<fill in: this video's content for the "Étape 1 : qui êtes-vous ?" beat — keep the layout role, replace the words.>

## Frame 5 — Étape 2 : votre profil

- duration: 8.255s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/05-step2.html
- type: feature_showcase
- persuasion: Belonging (every profile welcome)
- beat: belonging + ease
- blueprint: device-surface-showcase (Adapt)
- focal: assets/31-step2-filled-top.png
- roles: 30-step2-empty.png = cutout (initial) · 31-step2-filled-top.png = cutout (after tick) · 32-step2-filled-bottom.png = cutout (scrolled state)
- sfx: pop-soft, pop-soft, pop-soft, pop-soft, check, swipe

<fill in: this video's content for the "Étape 2 : votre profil" beat — keep the layout role, replace the words.>

## Frame 6 — Étape 3 : le cocktail

- duration: 8.62s
- transition_in: push-slide LEFT
- status: outline
- src: compositions/frames/06-step3.html
- type: feature_showcase
- persuasion: Choice architecture (three clear options)
- beat: control
- blueprint: device-surface-showcase (Adapt)
- focal: assets/41-step3-choice.png
- roles: 40-step3-empty.png = cutout (initial) · 41-step3-choice.png = cutout (after choice) · 42-step3-captcha-ok.png = cutout (scrolled to Confirmer)
- sfx: pop-soft, pop-soft, pop-soft, check, tap

<fill in: this video's content for the "Étape 3 : le cocktail" beat — keep the layout role, replace the words.>

## Frame 7 — Inscription confirmée

- duration: 5.068s
- transition_in: zoom-through
- status: outline
- src: compositions/frames/07-confirmed.html
- type: benefit_highlight
- persuasion: Show-don't-tell proof (real confirmation)
- beat: relief + triumph
- blueprint: video-text-pivot (Adapt)
- focal: assets/50-success-top.png
- roles: 50-success-top.png = cutout (in the iPhone, centred)
- sfx: success-chime, confetti, whoosh

<fill in: this video's content for the "Inscription confirmée" beat — keep the layout role, replace the words.>

## Frame 8 — Le bonus « J'y serai »

- duration: 9.482s
- transition_in: crossfade
- status: outline
- src: compositions/frames/08-jyserai.html
- type: feature_showcase
- persuasion: Status seeking (show the world you'll be there)
- beat: excitement + belonging
- blueprint: camera-journey (Adapt)
- focal: assets/62-poster-jy-serai.png
- roles: 51-success-poster-btn.png = cutout (phone, first beat) · 61-poster-preview.png = cutout (phone, second beat) · 62-poster-jy-serai.png = cutout (hero poster) · avatar-grace.png = supporting (photo dropping in)
- sfx: tap, whoosh, sparkle, pop-soft

<fill in: this video's content for the "Le bonus « J'y serai »" beat — keep the layout role, replace the words.>

## Frame 9 — Trois étapes, une place

- duration: 6.57s
- transition_in: zoom-through
- status: outline
- src: compositions/frames/09-cta.html
- type: cta
- persuasion: Rule of three + urgency-to-act
- beat: motivation + urgency-to-act
- blueprint: kinetic-type-beats (Adapt)
- focal: CTA card with the URL
- roles: ong-ddb.png = supporting (logo signature under the card) · 62-poster-jy-serai.png = supporting (small tilted thumbnail tucked behind the card corner)
- sfx: pop-soft, pop-soft, pop-soft, impact-soft

<fill in: this video's content for the "Trois étapes, une place" beat — keep the layout role, replace the words.>
