# Audit fix plan — "feel-first" scope  ✅ implemented 2026-06-12

Context: site is a layout/feel prototype. Placeholder links, megamenus, and
decorative buttons stay (they sketch the intended IA). Scope = everything that
breaks the premium feel or the rendering itself.

## Phase 1 — Broken rendering (Critical)

- [ ] **Mobile overflow (C2a)**: `.feat-tabs-row` has no breakpoint; min-content
      572px forces 592px layout viewport on a 375px phone. Add `@media (max-width:720px)`
      → 2×2 grid (number + label stacked tighter), smaller padding.
- [ ] **Mobile footer (C2b)**: `.footer-grid` 4 columns never collapses; Correspond
      column (email/phone) spills into overflow gutter. Stack to 1 col ≤720px,
      2 col ≤1000px.
- [ ] Verify: scrollWidth == clientWidth at 375px on both pages; screenshot proof.

## Phase 2 — Visual glitches that read as bugs

- [ ] **`--page-max` undefined** (styles-v4.css:155) → `var(--container)`; megamenu
      content re-contained on wide screens.
- [ ] **Scroll-indicator overlap**: `.feat-scroll` sits on top of tab labels at all
      widths. Lift above the tab strip; hide ≤1100px.
- [ ] **Hero tab desync**: orange indicator + aria-selected move 240ms before the
      title swaps. Move selection-state change into the same timeout as the text swap
      (indicator and content always agree).

## Phase 3 — Contrast & accessibility (design-level)

- [ ] Inactive `.feat-tab` 45%→~65% white; remove extra opacity on `.feat-tab-num`
      (currently 2.82:1, fails AA).
- [ ] `.plate-tag` unreadable on light plate-c: add subtle dark scrim behind tag text.
- [ ] Overlay menu focus management: move focus in on open, restore on close, trap Tab.
- [ ] Heading order: overlay H4s precede H1 → demote to styled divs.
- [ ] `scroll-behavior:smooth` gated behind `prefers-reduced-motion: no-preference`.
- [ ] Skip-to-content link on both pages.

## Phase 4 — Weight & SEO foundation (static-friendly)

- [ ] Re-encode 4 plate PNGs (1.5–1.9MB each) → WebP ~150–250KB + JPEG hero poster.
      Extend tools/encode-web.sh. Keep originals in raw/.
- [ ] Real 180×180 apple-touch-icon (replace 736KB ac-mark.png reference).
- [ ] 1200×630 og-image JPEG ≤300KB; fix `og:locale` → `en_GB`.
- [ ] robots.txt + sitemap.xml + 404.html (styled, on-brand).
- [ ] JSON-LD: ProfessionalService (index), Person (markus.html);
      twitter:card tags on markus.html.

## Phase 5 — Copy nits (no content additions)

- [ ] "boards, cabinets and executive teams" → "boards and executive teams" (index:326).
- [ ] Dedupe verbatim "75% faster than plan… PwC" (markus.html proof card vs
      experience row — vary the experience-row phrasing).

## Deferred (content decisions, user input needed)

- Contact section reinstatement (was removed deliberately in 5796182) — decide later.
- Founder/Landkreditt framing (H3) — copy decision.
- Real dispatch articles (C3), founder portrait (H5) — need material.
- Link removal / nav collapse — explicitly out of scope while prototyping the feel.

## Review

All five phases implemented and verified in a live browser (1280 + 375):

- Mobile overflow fixed: scrollWidth == clientWidth == 375, zero overflowing
  elements; hero tabs now 2×2, footer stacks, contact legible.
- Megamenu re-contained (max-width 1400px), scroll indicator lifted above the
  tab strip (hidden ≤1100px), hero indicator/content now swap in the same frame.
- Contrast: inactive tabs 0.45→0.65 white, tab numbers full opacity, plate tags
  on a dark scrim pill.
- Overlay: focus moves to close button on open (rAF-deferred), Tab traps and
  wraps both directions (verified), Esc closes, focus restored. Root cause of
  un-focusability was `visibility` inside the .35s transition — now flips
  instantly on open / after the fade on close.
- Heading order fixed (overlay group heads → divs, footer h4 → h3); skip links
  + <main> landmarks on both pages; smooth-scroll behind prefers-reduced-motion.
- Images: plates 1.5–1.9MB PNG → 33–68KB WebP (all refs repointed: posters,
  CSS, JS map); 180px touch icon (was 736KB); 80KB 1200×630 og-image.jpg.
  Repeatable via tools/encode-images.sh.
- SEO: robots.txt, sitemap.xml, on-brand 404.html, JSON-LD (ProfessionalService
  + Person), twitter cards on profile, og:locale en_GB.
- Copy: "cabinets" removed; duplicated PwC sentence varied on profile.

Extra fix found during verification: overlay visibility-transition bug (above).
Known cosmetic: tab-label color crossfade (.25s) can be caught mid-swap in
screenshots; indicator and content are in sync.
