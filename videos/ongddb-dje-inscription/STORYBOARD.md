---
format: 1080x1920
duration: 60s
message: "S'inscrire au Déjeuner Environnemental prend une minute — et vous repartez avec votre visuel « J'y serai »."
arc: Demo Loop — hook → event intro → 3-step demo cycle → result → bonus → CTA
audience: "Jeunes, étudiants, professionnels et sympathisants de l'ONG DDB, sur mobile (Reels / TikTok / WhatsApp)"
mode: collaborative
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

- scene: Big kinetic type « 30 OCT. » then « UNE MINUTE » punches over an isometric island assembling tile by tile; a stopwatch prop starts ticking
- voiceover: "Le Déjeuner Environnemental, c'est le 30 octobre. Votre place ? Elle se réserve en une minute. Chrono."
- duration: 6.792s
- transition_in: cut
- status: animated
- src: compositions/frames/01-hook.html
- type: hook
- persuasion: Friction reduction (time promise)
- beat: curiosity + urgency
- blueprint: kinetic-type-beats (Adapt)
- focal: kinetic type « UNE MINUTE » + stopwatch
- roles: ong-ddb.png = supporting (small signature, top-left)
- sfx: whoosh-soft, impact-soft, clock-tick
- asset_candidates: assets/ong-ddb.png — logo ONG DDB (small signature)

narrativeRole: State the outcome (a place, in one minute) before anything else — the value claim lands in beat 1.
keyMessage: S'inscrire, c'est rapide.

Adapt: keep the kinetic-type signature (each phrase slams on its spoken word, key word swaps in place); add the isometric island as the stage the type lands over.
Word cues: Déjeuner@0.41 Environnemental@0.73 30@1.71 octobre@2.10 Votre place@2.72 réserve@4.14 une minute@4.88 Chrono@6.10.
Scene 1 (0.0–1.6s): forest canvas + atmosphere; kicker label « LE DÉJEUNER ENVIRONNEMENTAL » enters per-word (staggered word rise) upper-third left as the VO says it; the small ONG DDB logo fades in top-left. Nothing else yet.
Scene 2 (1.6–2.7s): « 30 OCT. » slams in big (display, white) on « 30 » (`kinetic-beat-slam`), upper-third left aligned, ~85% width.
Scene 3 (2.7–4.8s): on « Votre place ? » the mint island tile rises from below centre-lower frame (shadow first, then tile; three small trees pop on top one after another, smooth power3 settle); a cream chip « Votre place ? » appears above the island.
Scene 4 (4.8–6.0s): on « une minute » the word « UNE MINUTE » slams in under « 30 OCT. » in sun yellow (hard-cut word swap replaces the chip, `discrete-text-sequence`); simultaneously the stopwatch prop lands on the island (rise from shadow).
Scene 5 (6.0–6.8s): on « Chrono. » the stopwatch hand starts sweeping (live SVG internal: the hand div rotates a finite amount) with a short tick; mint chip « ⏱ chrono lancé » pops under the island. Hold.

## Frame 2 — L'événement

- scene: Camera pulls back to reveal the isometric island: an iPhone stands on a platform showing the real event page; isometric props pop around it — calendar « 30 OCT », map pin « Auditorium AGL », seats « 300 places »
- voiceover: "Rendez-vous sur ongddb.com, rubrique Événements. Trois panels, des jeunes, des décideurs… et trois cents places. Pas une de plus."
- duration: 9.117s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/02-event.html
- type: product_intro
- persuasion: Scarcity/urgency (300 places)
- beat: intrigue + FOMO
- blueprint: zoom-out-workspace-reveal (Adapt)
- focal: assets/10-event-hero.png
- roles: 10-event-hero.png = cutout (inside the shared iPhone) · le-dejeuner-environnemental-2026.jpg = supporting (floating poster card)
- sfx: whoosh, pop-soft, pop-soft, pop-soft
- asset_candidates: assets/10-event-hero.png — page événement mobile, affiche + titre + date/lieu/places; assets/le-dejeuner-environnemental-2026.jpg — affiche officielle « Appel aux participants »

narrativeRole: Place the viewer on the real page and give the reason to act now (limited seats).
keyMessage: C'est sur ongddb.com, et les places sont limitées.

Adapt: keep the zoom-out signature (start tight on a detail, the workspace re-scopes on the landing line); the "workspace" is the island with the phone and props.
Word cues: Rendez-vous@0.24 ongddb.com@1.06 Événements@2.72 Trois panels@3.70 jeunes@4.92 décideurs@5.77 trois cents places@6.75 Pas une de plus@8.09.
Scene 1 (0.0–2.6s): tight on the phone screen (the real event page fills most of the frame) with a white URL pill « ongddb.com › Événements » above it typing in (`discrete-text-sequence` type-on) on « ongddb.com ».
Scene 2 (2.6–3.7s): on « Événements » the camera pulls back (`multi-phase-camera` pull-back, done by ~3.7s): the phone now stands centred on a large cream iso platform, ~45% frame width, upper ~70% of frame.
Scene 3 (3.7–6.6s): on « Trois panels » three small cream chips « Panel 1 · Panel 2 · Panel 3 » stack left of the phone one by one; on « jeunes » / « décideurs » two tiny iso people-tokens (simple cylinders + heads, mint and green) pop onto the platform.
Scene 4 (6.6–8.0s): on « trois cents places » the calendar prop (« 30 OCT. ») rises at left, the map pin « Auditorium AGL » drops at right, the seats cluster rises at lower right with a sun chip « 300 places » (rise from shadow, smooth settle).
Scene 5 (8.0–9.1s): on « Pas une de plus » the « 300 places » chip gets a quick sun highlight sweep (a sun bar wipes behind the text left→right), then hold still.

## Frame 3 — Toucher « S'inscrire »

- scene: Camera dives into the phone; the real « S'inscrire » button is centered, a finger-tap ripple hits it, the green registration sheet slides up
- voiceover: "Touchez « S'inscrire »… et c'est parti."
- duration: 3.161s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-tap.html
- type: feature_showcase
- persuasion: Show-don't-tell proof
- beat: ease
- blueprint: cursor-ui-demo (Adapt)
- focal: assets/11-event-cta.png
- roles: 11-event-cta.png = cutout (in the iPhone, large) · 20-step1-empty.png = cutout (slides up as the sheet)
- sfx: tap, swoosh-up
- asset_candidates: assets/11-event-cta.png — bouton blanc « S'inscrire » centré; assets/20-step1-empty.png — modale verte étape 1 vide

narrativeRole: The single entry gesture — shows how small the first step is.
keyMessage: Un bouton, et vous y êtes.

Adapt: keep the cursor-ui-demo click signature, but as a mobile finger-tap ring (no desktop cursor).
Word cues: Touchez@0.24 S'inscrire@1.18 parti@2.56.
Scene 1 (0.0–1.1s): large iPhone (~80% width) showing 11-event-cta.png; camera zooms toward the white « S'inscrire » button (`coordinate-target-zoom`); a sun chip « Touchez « S'inscrire » » drops in at top.
Scene 2 (1.1–1.9s): on « S'inscrire » the sun tap ring lands on the button and emits a ripple (`cursor-click-ripple`), the button presses (scale .94 then back to 1, smooth).
Scene 3 (1.9–3.16s): on « c'est parti » the screen content swaps: 20-step1-empty.png slides up from the bottom of the phone screen as a sheet (expo.out), holds.

## Frame 4 — Étape 1 : qui êtes-vous ?

- scene: Phone flat-facing on its tile; isometric 3-segment progress bar fills segment 1 with « ÉTAPE 1 » badge; zoom-lens callouts magnify each field as it fills (nom → WhatsApp → e-mail), then « Suivant » pulses
- voiceover: "Étape un : qui êtes-vous ? Votre nom, votre numéro WhatsApp, votre e-mail. Suivant !"
- duration: 6.792s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/04-step1.html
- type: feature_showcase
- persuasion: Rule of three (3 étapes)
- beat: clarity + control
- blueprint: device-surface-showcase (Adapt)
- focal: assets/21-step1-filled-top.png
- roles: 20-step1-empty.png = cutout (initial screen) · 21-step1-filled-top.png = cutout (screen after fill + lens source)
- sfx: pop-soft, key-type, key-type, key-type, tap
- asset_candidates: assets/20-step1-empty.png — étape 1 vide; assets/21-step1-filled-top.png — étape 1 remplie (Grace Mboumba, WhatsApp, e-mail, Féminin)

narrativeRole: First demo cycle — the simplest, most familiar step.
keyMessage: Étape 1 = vos coordonnées.

Adapt: keep the device-surface signature (the screen advances through its flow inside the real device, cursorless); add zoom-lens callouts and the iso progress bar.
Word cues: Étape un@0.28 qui êtes-vous@1.22 nom@2.60 WhatsApp@3.94 e-mail@4.96 Suivant@6.01.
Layout: header row top (badge « 1 » + title « Qui êtes-vous ? » + 3-segment iso progress bar); phone left-centre on a mint iso tile (~48% width); callout lens + chips on the right.
Scene 1 (0.0–1.2s): sun step badge « 1 » pops (spring, playful allowed), then progress segment 1 fills mint (`stat-bars-and-fills`); phone already standing on its tile showing 20-step1-empty.png.
Scene 2 (1.2–2.4s): title « Qui êtes-vous ? » per-word reveal on « qui êtes-vous ».
Scene 3 (2.4–5.6s): field-by-field: on « nom » a zoom-lens appears over the name field region magnified (~2×) showing « Grace Mboumba » typing in, chip « Nom » pops at right; on « WhatsApp » the lens glides down to the phone field, chip « WhatsApp »; on « e-mail » lens glides to e-mail, chip « E-mail ». The phone screen crossfades from empty to 21-step1-filled-top.png progressively (each field revealed by a mask as the lens passes).
Scene 4 (5.6–6.79s): lens shrinks away; on « Suivant » the green « Suivant » button area gets the tap ring + press (`press-release-spring`). Hold.

## Frame 5 — Étape 2 : votre profil

- scene: Push to the next platform (graduation cap + briefcase props); progress bar segment 2 fills; the real step-2 screen; « Étudiant(e) » gets ticked with a pop, the screen scrolls to « Je confirme ma participation — Oui »
- voiceover: "Étape deux : votre profil. Élève, étudiant, pro ou entrepreneur : cochez. Et confirmez votre participation."
- duration: 8.255s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/05-step2.html
- type: feature_showcase
- persuasion: Belonging (every profile welcome)
- beat: belonging + ease
- blueprint: device-surface-showcase (Adapt)
- focal: assets/31-step2-filled-top.png
- roles: 30-step2-empty.png = cutout (initial) · 31-step2-filled-top.png = cutout (after tick) · 32-step2-filled-bottom.png = cutout (scrolled state)
- sfx: pop-soft, pop-soft, pop-soft, pop-soft, check, swipe
- asset_candidates: assets/30-step2-empty.png — étape 2 vide (Statut); assets/31-step2-filled-top.png — Étudiant(e) coché, organisation, fonction; assets/32-step2-filled-bottom.png — « Je confirme ma participation » Oui coché

narrativeRole: Second demo cycle — shows the event is for everyone.
keyMessage: Étape 2 = votre profil.

Adapt: same device-surface signature as Frame 4 (mirrored layout: phone right, chips left) so the three steps rhyme.
Word cues: Étape deux@0.28 profil@1.58 Élève@2.56 étudiant@3.05 pro@3.78 entrepreneur@4.23 cochez@5.28 confirmez@6.50 participation@7.27.
Layout: same header row (badge « 2 », title « Votre profil », bar 2/3); phone right-centre on a cream tile; iso graduation-cap prop + option chips column on the left.
Scene 1 (0.0–1.6s): badge « 2 » pops, progress segment 2 fills; title « Votre profil » per-word on « profil ». Phone shows 30-step2-empty.png.
Scene 2 (2.5–5.0s): option chips appear one per spoken word in a left column: « Élève »@2.56, « Étudiant(e) »@3.05, « Pro »@3.78, « Entrepreneur(e) »@4.23 (`dynamic-content-sequencing`); the graduation-cap prop rises above them on « étudiant ».
Scene 3 (5.0–6.3s): on « cochez » the « Étudiant(e) » chip turns mint with « ✓ » (pop) and the phone screen swaps to 31-step2-filled-top.png (radio selected).
Scene 4 (6.3–8.25s): on « confirmez » the phone screen scrolls (translate the screenshot) to 32-step2-filled-bottom.png, a zoom-lens magnifies « Je confirme ma participation — Oui » with a mint ring; hold.

## Frame 6 — Étape 3 : le cocktail

- scene: Third platform with an isometric plate + cocktail glass; progress bar segment 3 fills; the three cocktail options appear as floating iso chips beside the phone (VIP · Simple · Conférence seule); « Conférence seule » selected; then zoom on the green « Confirmer mon inscription » button and tap
- voiceover: "Étape trois : le cocktail dînatoire. Ticket VIP, ticket simple, ou la conférence seule : à vous de choisir. Puis : Confirmer."
- duration: 8.62s
- transition_in: push-slide LEFT
- status: animated
- src: compositions/frames/06-step3.html
- type: feature_showcase
- persuasion: Choice architecture (three clear options)
- beat: control
- blueprint: device-surface-showcase (Adapt)
- focal: assets/41-step3-choice.png
- roles: 40-step3-empty.png = cutout (initial) · 41-step3-choice.png = cutout (after choice) · 42-step3-captcha-ok.png = cutout (scrolled to Confirmer)
- sfx: pop-soft, pop-soft, pop-soft, check, tap
- asset_candidates: assets/40-step3-empty.png — étape 3, question cocktail et 3 options; assets/41-step3-choice.png — « conférence seule » cochée; assets/42-step3-captcha-ok.png — bouton « Confirmer mon inscription »

narrativeRole: Third and last cycle — the only real decision, made easy; ends on the commit tap.
keyMessage: Étape 3 = votre formule, puis Confirmer.

Adapt: same device-surface rhythm as Frames 4–5 (phone left again, chips right) ending on the commit tap.
Word cues: Étape trois@0.28 cocktail dînatoire@1.42 Ticket VIP@2.80 ticket simple@3.78 conférence seule@5.04 choisir@6.42 Confirmer@7.88.
Layout: same header row (badge « 3 », title « Le cocktail dînatoire », bar 3/3 full); phone left-centre on a green tile; iso cocktail-glass prop + chips on the right.
Scene 1 (0.0–1.4s): badge « 3 » pops, progress segment 3 fills (bar now complete, brief mint glow along the bar); phone shows 40-step3-empty.png.
Scene 2 (1.4–2.7s): title « Le cocktail dînatoire » per-word on « cocktail »; the cocktail-glass prop rises at right.
Scene 3 (2.7–6.4s): chips at right one per cue: « Ticket VIP »@2.80, « Ticket simple »@3.78, « Conférence seule »@5.04; on « à vous de choisir » the « Conférence seule » chip turns mint « ✓ » and the screen swaps to 41-step3-choice.png.
Scene 4 (6.4–8.62s): screen scrolls to 42-step3-captcha-ok.png; camera zoom-to-target on the green « Confirmer mon inscription » button (`coordinate-target-zoom`, finishes by ~7.7s); on « Confirmer » the tap ring + press; hold.

## Frame 7 — Inscription confirmée

- scene: Confetti burst; the real « Inscription confirmée ! » screen; a 3D isometric envelope flies out of the phone toward an iso mailbox labelled with the e-mail; a big mint check badge stamps in
- voiceover: "Et voilà : inscription confirmée ! Votre billet arrive directement dans votre boîte mail."
- duration: 5.068s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/07-confirmed.html
- type: benefit_highlight
- persuasion: Show-don't-tell proof (real confirmation)
- beat: relief + triumph
- blueprint: video-text-pivot (Adapt)
- focal: assets/50-success-top.png
- roles: 50-success-top.png = cutout (in the iPhone, centred)
- sfx: success-chime, confetti, whoosh
- asset_candidates: assets/50-success-top.png — écran « Inscription confirmée ! », billet envoyé par e-mail

narrativeRole: Payoff of the demo loop — proves the one-minute promise was kept.
keyMessage: C'est fait, le billet est dans vos mails.

Adapt: keep the pivot signature (the real product screen proves it, then yields focus to the one result line), the "result" being the ticket envelope.
Word cues: voilà@0.41 inscription confirmée@0.85 billet@2.84 boîte mail@4.35.
Scene 1 (0.0–2.0s): phone centred (~46% width) with 50-success-top.png; on « confirmée » the big mint ✓ badge stamps in upper right (playful overshoot allowed) and a burst of leaf-shaped confetti radiates from behind it (deterministic positions by index, finite); display « CONFIRMÉE ! » slams in top-left.
Scene 2 (2.0–4.3s): on « billet » an iso envelope slides out of the phone toward lower-left (`motion-blur-streak` on the fly) and lands on a small cream tile; a chip « Billet → boîte mail » appears under it on « boîte mail ».
Scene 3 (4.3–5.07s): hold still (breather).

## Frame 8 — Le bonus « J'y serai »

- scene: Zoom on the « Générer mon visuel J'y serai » button; tap; the real poster generator; the avatar photo drops in; then the finished « J'y serai ! » poster lifts out of the phone into isometric 3D space as a framed print on a pedestal, sparkles, orange ribbon flash; share icons (WhatsApp, Facebook, Instagram) orbit it
- voiceover: "Le bonus ? Votre visuel « J'y serai ». Ajoutez votre photo, et l'affiche officielle est prête, à votre nom. Partagez-la partout !"
- duration: 9.482s
- transition_in: crossfade
- status: animated
- src: compositions/frames/08-jyserai.html
- type: feature_showcase
- persuasion: Status seeking (show the world you'll be there)
- beat: excitement + belonging
- blueprint: camera-journey (Adapt)
- focal: assets/62-poster-jy-serai.png
- roles: 51-success-poster-btn.png = cutout (phone, first beat) · 61-poster-preview.png = cutout (phone, second beat) · 62-poster-jy-serai.png = cutout (hero poster) · avatar-grace.png = supporting (photo dropping in)
- sfx: tap, whoosh, sparkle, pop-soft
- asset_candidates: assets/51-success-poster-btn.png — bouton « Générer mon visuel J'y serai »; assets/61-poster-preview.png — générateur d'affiche avec photo; assets/62-poster-jy-serai.png — visuel final « J'y serai ! » GRACE MBOUMBA; assets/avatar-grace.png — avatar illustré

narrativeRole: The emotional peak — registration becomes something to show off; drives social sharing.
keyMessage: Après l'inscription, vous avez votre propre affiche.

Adapt: keep the camera-journey signature (the camera travels from the cause — the button/generator — to the payoff artifact, which then acts on its own), with the poster as the flown-to artifact.
Word cues: Le bonus@0.28 visuel J'y serai@1.71 Ajoutez votre photo@3.37 affiche officielle@5.16 prête@5.97 nom@6.91 Partagez-la@7.84 partout@8.49.
Scene 1 (0.0–2.2s): display « LE BONUS » top-left on « bonus »; phone centre showing 51-success-poster-btn.png; on « visuel » zoom-to-target on the green « Générer mon visuel J'y serai » button + tap ring.
Scene 2 (2.2–5.1s): orange chip « « J'y serai ! » » pops under the title on « J'y serai »; phone screen swaps to 61-poster-preview.png; on « Ajoutez votre photo » the avatar-grace.png circle drops from above into the phone's photo slot (smooth).
Scene 3 (5.1–7.8s): on « l'affiche officielle » the poster 62-poster-jy-serai.png lifts OUT of the phone, scales up and lands as a framed print (white border, slight -4° tilt) standing on a cream iso pedestal, ~70% width, centre; sparkle burst (finite) on « prête »; the orange « J'y serai ! » ribbon area of the poster gets a quick glow on « à votre nom ». The phone shrinks to a small top-right position.
Scene 4 (7.8–9.48s): on « Partagez-la partout » three share chips (WhatsApp, Facebook, Instagram — text chips with simple glyphs, no brand logos drawn by hand) fan out around the pedestal (`center-outward-expansion`); hold.

## Frame 9 — Trois étapes, une place

- scene: The island zooms out: three platforms glow in sequence « 1 · 2 · 3 »; kinetic type « 3 ÉTAPES · 1 PLACE »; resolves on a CTA card with the URL ongddb.com/events/dje-2026, « 30 OCT. · AUDITORIUM AGL » and the ONG DDB logo
- voiceover: "Trois étapes, une place. Inscrivez-vous sur ongddb.com !"
- duration: 6.57s
- transition_in: zoom-through
- status: animated
- src: compositions/frames/09-cta.html
- type: cta
- persuasion: Rule of three + urgency-to-act
- beat: motivation + urgency-to-act
- blueprint: kinetic-type-beats (Adapt)
- focal: CTA card with the URL
- roles: ong-ddb.png = supporting (logo signature under the card) · 62-poster-jy-serai.png = supporting (small tilted thumbnail tucked behind the card corner)
- sfx: pop-soft, pop-soft, pop-soft, impact-soft
- asset_candidates: assets/ong-ddb.png — logo ONG DDB; assets/62-poster-jy-serai.png — visuel J'y serai (vignette)

narrativeRole: Compress the whole tutorial into a memorable triad and send the viewer to the link.
keyMessage: ongddb.com/events/dje-2026 — inscrivez-vous maintenant.

Adapt: kinetic-type CTA — the triad slams beat by beat and lands on the URL card; the three iso platforms are the visual "3 steps".
Word cues: Trois étapes@0.24 une place@1.18 Inscrivez-vous@2.15 ongddb.com@3.41.
Scene 1 (0.0–1.1s): three iso tiles (mint, cream, green) in a rising diagonal, upper half; on « Trois étapes » they light up 1 → 2 → 3 with sun step badges popping in sequence; display « 3 ÉTAPES » slams top-left.
Scene 2 (1.1–2.1s): on « une place » display line « 1 PLACE » slams under it (sun yellow).
Scene 3 (2.1–4.0s): on « Inscrivez-vous » the cream CTA card rises into the lower-middle (above the caption band): label « INSCRIVEZ-VOUS », title « ongddb.com/events/dje-2026 » (type-on on « ongddb.com »), chips « 30 OCT. » (orange) and « Auditorium AGL » (mint); the poster thumbnail peeks behind the card's top-right corner.
Scene 4 (4.0–5.07s): ONG DDB logo fades in centred under the card; final still hold (this is the video's end — a gentle fade of everything to forest over the last 0.3 s is allowed).
