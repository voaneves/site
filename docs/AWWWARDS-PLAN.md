# Awwwards pass: plan and status

Started 2026-11-15. Goal: Awwwards Site of the Month quality for voaneves.com.
References, to be reproduced faithfully in our own code, brand and content:
[lamalama.com](https://lamalama.com/) and [era-residence.com](https://www.era-residence.com/).
We copy behaviour, never source code or assets.

Previous plan: [WOW-PLAN.md](WOW-PLAN.md).

## Rules

- Lighthouse 100 in all four categories, mobile and desktop, is never relaxed. Any effect that costs a point is
  shortened or deferred until it passes; if it cannot pass, it is dropped and reported.
- Everything respects `prefers-reduced-motion` and works without JavaScript. pt-BR and en stay in parity.
- The hero title and the portrait image (LCP candidates) do not animate, and no ancestor of them fades, scales or is
  clipped. Motion happens around them.
- One small task per commit (Conventional Commits), pushed to `main`. Local gate before each push:
  `npm run lint && npm run build && npm run check:budget && npm run check:html && npm test`, plus the Playwright
  specs for the touched area. Full e2e and Lighthouse run once at the end; only the final commit's deploy must be green.
- Byte budgets (`budget.json`): inline CSS and first-load JS stay as they are. The lazy JS cap (code loaded after
  idle or first pointer) is raised for the signature effects, with the new numbers recorded in "Budgets" below.
- No new npm dependency. Everything is hand-written. Tokens come from the vendored brand tarball
  (`vendor/voaneves-brand-1.0.0.tgz`); no task repacks it. Site CSS may override a brand custom property.
- Executors never run a git command that changes state (no add, commit, stash, checkout, push). The orchestrator
  commits each task separately, so every task leaves the tree green.
- No file, commit or PR mentions an assistant or a vendor of one.

### Codebase rules that apply to every task

Read these once; each spec refers to them by number (R1 to R14).

- **R1. Where CSS lives.** There are three places, in increasing lateness:
  1. *Inline sheet*: `src/styles/site.css` imports `src/styles/sections/*.css`; Astro inlines it into every page
     (`build.inlineStylesheets: 'always'`). Every section file wraps its rules in `@layer site { ... }`. This sheet is
     counted by `inlineCssGzMaxBytes` (14336) and by `htmlGzMaxBytes` (32768). Only put a rule here when it is needed at
     first paint or by visitors without JavaScript.
  2. *Late sheet* (created by task A5): `src/styles/late/*.css`, imported with `?inline` by `src/scripts/late.ts`, a
     lazy chunk loaded on idle for every visitor (also under reduced motion and on touch). Use it for interaction-only
     rules (hover, pointer) and for decorative elements that may appear after idle.
  3. *Fx sheet*: `src/styles/fx/*.css`, imported with `?inline` by `src/scripts/scroll-fx.ts`, a lazy chunk loaded on
     idle only under `prefers-reduced-motion: no-preference` (all pointers, touch included). Top-level
     `@supports (animation-timeline: view()) { ... }` blocks are deleted by the script when the browser has no scroll
     timelines. Use it for motion.
- **R2. Cascade order.** The brand CSS sits in layers `vn.reset, vn.tokens, vn.base, vn.type, vn.components,
  vn.utilities`; `site` is declared after them, so any `@layer site` rule beats any brand rule regardless of
  specificity. The late and fx sheets are also wrapped in `@layer site` by their scripts (do not add `@layer` inside
  those files); they are adopted after the inline sheet, so on equal specificity they win over inline rules, and
  between the late sheet and the fx sheet the order is not deterministic: never set the same property on the same
  element from both. Two sheets are unlayered and beat every layered rule: the theme-toggle sheet in
  `src/scripts/theme.ts` (`VT_CSS`) and the cursor sheet in `src/scripts/cursor.ts`.
- **R3. One `animation` per element.** A second `animation` (or `animation-name`) declaration that wins the cascade
  replaces the first; it does not add to it. A sheet adopted on idle can therefore cut an intro that started at first
  paint. Before animating an element, search for existing animations on it:
  `grep -rn "animation" src/styles src/scripts/*.ts | grep -i "<class name>"`. Elements that already carry one today:
  `.vn-hero__inner`, `.vn-hero::after`, `.vn-hero-portrait__img`, `.vn-hero-portrait__canvas`, `.vn-hero-badge__svg`
  (time-based spin), `.vn-status-pill__dot` (brand pulse), `#numeros`, `#jornada`, `#servicos`, `#contato`,
  `.vn-stats-hero-grid`, `.vn-site-footer__inner`, the `::before` of `#quem-sou`, `#expertise`, `#perguntas`, the first
  `.vn-container` of `#numeros`, `#jornada`, `#contato`, `.vn-journey-card`, `.vn-service-card`, `.vn-chart-svg__fill`,
  `.vn-project-row__media img`, `.vn-case-hero > .vn-container`, `.vn-case-media img`, `[data-drift]`,
  `.vn-marquee__track`, and the `::after` of `.vn-spec-list__row`, `.vn-faq-item`, `.vn-work-row`. To add motion to one
  of these, animate a child or a wrapper, or use a property the existing animation does not touch through a
  *transition*, not a second animation.
- **R4. Scroll-driven animations use longhands only.** Write `animation-name`, `animation-timing-function`,
  `animation-fill-mode`, `animation-timeline`, `animation-range`. Never the `animation` shorthand and never
  `animation-duration` or `animation-delay` on such a rule: the minifier folds longhands into the shorthand and Chrome
  then drops `view()` / `scroll()`. `e2e/lines-reveal.spec.ts` ("built inline scroll-driven animations keep a name and
  a scroll/view timeline") shows how to assert it.
- **R5. Animate only** `transform`, `translate`, `scale`, `rotate`, `opacity` and `clip-path`. Never layout properties,
  `filter` or `box-shadow`.
- **R6. Hidden states** exist only under `html.js` (class set by the inline head script in `src/layouts/Base.astro`)
  and `@media (prefers-reduced-motion: no-preference)`. Without JS and under reduced motion everything is visible and
  static. `e2e/gates.spec.ts` fails on any running animation with a duration above 1 ms under reduced motion.
- **R7. The reveal system.** `src/scripts/reveal.ts` (first load) observes `[data-stagger]` groups and lone
  `[data-enter]` elements, adds `.is-in` when they are 10% into the viewport and `.is-done` 3200 ms later. Until
  `.is-done`, `src/styles/sections/motion.css` owns the element's `transition`; after it, other transitions (hover)
  apply. Any entrance must finish (delay plus duration) inside 3200 ms. `--h` is the hidden flag (1 before `.is-in`),
  `--i` the stagger index from `[data-stagger] > :nth-child()`, `--l` the rendered line index of a `.vn-w` word.
- **R8. Deferred sections.** `src/styles/sections/render-cost.css` gives the eight home sections below the hero
  `content-visibility: auto`, which also applies paint containment: nothing a section draws outside its own box is
  visible (that is why the chapter wedges sit inside the section, `top: 0; translate: none`). Each section has a
  seeded height `--ci` per breakpoint; `e2e/render-cost.spec.ts` fails, and prints fresh values to paste, when a real
  height drifts more than 15% from its seed at 1366, 1100, 950, 850, 700 or 390 px (viewport height 800). A task that
  changes a section's height must re-run that spec and paste the values it prints.
- **R9. Header ground flip.** `groundFlip()` in `src/scripts/nav.ts` copies the background and text colours of the
  `main > section` (or footer) under the header's mid-line onto `.vn-navbar`, and sets `data-ground` on the navbar.
  A new full-width element placed between sections, or a section whose background becomes transparent, changes what
  the header shows. `e2e/header-ground.spec.ts` covers it.
- **R10. CSP.** No `style=""` attribute in markup and no inline event handler. Styles set from JS through the CSSOM
  (`el.style.setProperty`, constructable stylesheets) are fine. `<script is:inline>` in `Base.astro` is hashed by
  `astro.config.mjs` from the source text, so editing it is safe as long as it stays one `<script is:inline>` block.
- **R11. Lazy loading helpers** live in `src/scripts/lazy.ts`: `onIdle(cb)` (after `load`, in `requestIdleCallback`),
  `onFirstPointer(cb)` (first `pointermove`), `motionOK()` (fine pointer, hover, no reduced motion). New lazy modules
  are registered in the block marked `// --- module registrations ---` in `src/scripts/main.ts`, one line each.
  Lighthouse never moves the pointer, never wheels and never touches, so code behind those triggers costs it nothing.
- **R12. Budget script.** `npm run check:budget` reads `budget.json`. A lazy chunk is matched by file-name prefix
  (`src/scripts/foo.ts` becomes `dist/_astro/foo.<hash>.js`, key `"foo"`). A chunk listed in `lazyChunks` fails the
  check when it exceeds its cap or becomes part of a first-load set. When a task changes a cap it edits `budget.json`
  and the "Budgets" table in this file in the same commit.
- **R13. Tests.** Unit tests: `npm test` (node, reads `dist/`). e2e: `npx playwright test e2e/<file>.spec.ts` (needs a
  fresh `npm run build`; the config starts `wrangler pages dev dist` on port 8788 and uses the local Chrome). Common
  helpers used by the specs: wait for the fx sheet with
  `await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl')`; wait for the
  late sheet (after A5) with `await page.waitForFunction(() => 'late' in document.documentElement.dataset)`; wait two
  frames with `page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`.
  Debug flags (`window.__vn...`) are only written when the URL contains `vn-debug`.
- **R14. Byte ledger.** At the start of a task run `npm run build && npm run check:budget` and note, for
  `index.html`: `html=` and `inlineCss=`, and the `first-load max=` and `lazy total=` line. Run it again at the end and
  add one row to the "Byte ledger" table in this file. If a number passes its allowance in the spec, apply the
  spec's fallback before reporting done.

## Outline and status

### Phase A: defects found in the UX/UI review, and byte headroom

- [x] A1 Words vanished after a line break at a hyphen ("pós-graduações", "anti-spam"). `3f2519e`
- [x] A2 Section headings collide with the lede below; expertise chips wrap inside the pill; footer link orphan on mobile. `64d5bea`
- [x] A3 Header nav unreadable (brown on red, 1.6:1) when it sits over the contact band. `64d904d`
- [x] A4 Projects subtitle is pointer-only copy; the cursor image preview duplicates the row thumbnail. `b431edd`
- [ ] A5 Late sheet: interaction-only CSS leaves the inline sheet and the first-load script (new lazy chunk `late`).
- [x] A6 Case-study CSS is inlined only on case pages (freed 363 B gz of home inline CSS, 332 B of home HTML).

### Phase B: from lamalama

- [ ] B1 Line reveal as theirs: lines rise from 80%, scale .96, fade, masked, expo-out, 0.85 s, base delay 0.15 s,
      per-line stagger `(0.135 + 0.03 N) / (N - 1)` s.
- [ ] B2a Cursor label pill follows with a 0.45 s expo-out lag (no spring overshoot).
- [ ] B2b Fluid trail distorts the images it passes over (project thumbnails, case hero), reusing the solver's
      velocity field. The ink trail remains everywhere else and as the fallback.
- [ ] B3 Page transition: 0.65 s cover, 0.25 s hold with a 0 to 100 counter, 0.65 s reveal; the thumbnail still morphs
      into the case hero above the cover. Typed, so the theme toggle's reveal is untouched.
- [ ] B4 Smooth wheel on fine pointers (exponential ease-out, about 1 s); native scroll on touch and trackpads.

### Phase C: from Era Residence

- [ ] C1 Preloader on the first home visit of a session: split words slide apart, hairline progress, the curtain
      lifts as an arch. The page under it is painted from the first frame.
- [ ] C2 Hero opening on non-LCP elements: strip and strap wipe in, grid fades, CTAs rise, chips and badge pop.
- [ ] C3 Jornada pinned on desktop: vertical scroll carries the career cards sideways behind an oversized ghost
      word that drifts slower. Touch, small screens and browsers without scroll timelines keep the swipe carousel.
- [ ] C4 Números rises over About as a large arch (replaces the diagonal wedge), with its label set on the curve.
- [ ] C5 Scroll rail on the left edge with a live percentage and a scroll cue (desktop); the top bar stays on small
      screens and as the fallback.
- [ ] C6 About manifesto as a tall centred statement that inks in word by word with scroll; small caption below.
- [ ] C7 Era's easings and hover duration as site-wide token overrides. (Image parallax in clipped frames and drawn
      hairlines already shipped in WOW-PLAN U7: `fx/parallax.css`, `fx/text.css`.)
- [ ] C8 Edge-fill hover on outline buttons (0.8 s in-out, text colour flips). (The nav text roll already shipped.)
- [ ] C9 Hero badge rotation tied to scroll, on top of its slow spin.

### Phase D: polish

- [ ] D1 Footer closing moment: full-width "voaneves." wordmark rising through a mask, Palmas local time.
- [ ] D2 Contact band: larger mobile title; the signal field drifts on its own when the pointer is idle.
- [ ] D3 Hero portrait colour blooms once on touch devices, on the visitor's first scroll or touch.
- [ ] D4 Service cards open like a frame on mobile; the marquee speeds up with scroll velocity.
- [ ] D5 Numbers: digits roll like a counter, including the decimal impact metrics; stat labels ruled.

### Phase E: review and release

- [ ] E1 Code review of logic, security and infrastructure changes.
- [ ] E2 Second UX/UI review from fresh captures (desktop 1440, mobile 390), both locales, light and dark,
      reduced motion, JavaScript off.
- [ ] E3 Full gate, full Playwright suite, Lighthouse with `lighthouserc.cjs` (mobile and desktop).
- [ ] E4 Final push; deploy run green; voaneves.com serving the new build; Lighthouse on production.

### What changed in the outline, and why

- **A5 widened.** `src/scripts/main.ts` already adopts two hand-minified sheets on idle (hover colours, case rows).
  A5 turns that into one lazy chunk (`late`) fed by real CSS files, and moves the remaining pointer-only inline rules
  into it. Later tasks (C5, C8, D1) put their non-critical CSS there.
- **A6 added.** The home page inlines `case.css` although no home element uses it. Splitting it out is the largest
  safe saving available and pays for C1, C2, C4, C6 and B3, which all need some inline CSS.
- **B2 split** into B2a (pill, small and safe) and B2b (distortion, risky, droppable).
- **C7 rescoped.** Parallax in clipped frames and hairlines that draw in already exist. What is left is the token
  override, which is done early because every later task uses the easings.
- **C8 rescoped.** The nav text roll exists (`[data-fx="roll"]` in `chrome.css`). C8 is the edge fill only.
- **C5.** The rail replaces the top bar only on wide screens with scroll timelines; the bar stays elsewhere.
- **D3.** The bloom is triggered by the first scroll or touch, not on load, so Lighthouse never measures it.

## Execution order

One task at a time, in this order. The first twelve are low risk and give the most visible change early. The four
risky tasks come last and are independent: any of B3, C1, B4, B2b, and also C3, can be dropped without touching another
task (each spec says what to revert).

| # | Task | Risk | Depends on |
|---|---|---|---|
| 1 | A6 case CSS per page | low | A2 to A4 committed |
| 2 | A5 late sheet | low | A6 |
| 3 | C7 token overrides | low | none |
| 4 | B1 line reveal | low | C7 |
| 5 | C2 hero opening | medium (Speed Index) | C7 |
| 6 | C4 arch over About | low | none |
| 7 | C6 About statement | low | B1 |
| 8 | C8 edge-fill buttons | low | A5 |
| 9 | C5 scroll rail | low | A5 |
| 10 | B2a cursor pill | low | none |
| 11 | D5 number roll | low | none |
| 12 | D1 footer wordmark and clock | low | A5 |
| 13 | D2 contact title and idle drift | low | none |
| 14 | C9 badge rotation | low | C2 |
| 15 | D4 mobile service frame, marquee velocity | low | none |
| 16 | D3 touch bloom | low | none |
| 17 | C3 pinned Jornada | high (test surface) | none |
| 18 | B3 page transition | medium | C2 |
| 19 | C1 preloader | high (Speed Index) | C2 |
| 20 | B4 smooth wheel | high (interaction) | C3 decided |
| 21 | B2b fluid distortion | high (visual seams) | none |

## Budgets

Numbers are gzip bytes. "Now" is the last committed build before this pass (`dist/` of 2026-11-15); every executor
re-measures (R14).

| Item | Now | After A | After B (no B2b, B4) | After C | After D | With B4 + B2b | Cap today | Proposed cap |
|---|---|---|---|---|---|---|---|---|
| Inline CSS, home | 13177 | 12300 | 12700 | 13450 | 13500 | 13500 | 14336 | 14336 (unchanged) |
| HTML, home | 31117 | 30250 | 30700 | 31950 | 32200 | 32200 | 32768 | 32768 (unchanged) |
| First-load JS (max) | 5159 | 4800 | 4850 | 4850 | 4950 | 5020 | 8192 | 8192 (unchanged) |
| Lazy `late` (new) | 0 | 520 | 520 | 1050 | 1450 | 1450 | none | 1792 |
| Lazy `scroll-fx` | 2093 | 2093 | 2150 | 2900 | 3250 | 3250 | 2304 | 3584 |
| Lazy `journey` | 1158 | 1158 | 1158 | 1500 | 1500 | 1500 | none | 1792 |
| Lazy `count` | 475 | 475 | 475 | 475 | 800 | 800 | none | 1024 |
| Lazy `cursor` | 3035 | 3035 | 3000 | 3000 | 3000 | 3000 | 3072 | 3072 (unchanged) |
| Lazy `cursor-trail` | 4094 | 4094 | 4094 | 4094 | 4094 | 5200 | 9216 | 6144 (lowered) |
| Lazy `signal-field` | 1221 | 1221 | 1221 | 1221 | 1400 | 1400 | 2560 | 1792 (lowered) |
| Lazy `hero-fx` | 2680 | 2680 | 2680 | 2680 | 2780 | 2780 | 3584 | 3584 (unchanged) |
| Lazy `hover-fx` | 1429 | 1429 | 1429 | 1429 | 1429 | 1429 | 1408 | 1536 |
| Lazy `magnetic` | 575 | 575 | 575 | 575 | 575 | 575 | 614 | 614 (unchanged) |
| Lazy `smooth` (new) | 0 | 0 | 0 | 0 | 0 | 620 | none | 768 |
| **Lazy total** | 16760 | 17280 | 17300 | 18930 | 20050 | 21780 | 17408 | **23040** |

Why the lazy caps move, per task: `late` is new code that leaves first load (A5) plus the rail (C5), the edge fill
(C8) and the footer (D1). `scroll-fx` carries the CSS of C4, C6, C3, C9, D4 and D1 (about 1150 B). `journey` gains the
pinned mode (C3). `count` gains the digit reels (D5). `smooth` is B4. `cursor-trail` gains the image pass (B2b) and its
cap is lowered from 9216 to what it needs plus 15%. The total cap is the projected total plus about 5%.
Without the three droppable signature tasks (C3, B4, B2b) the total is about 19700; the orchestrator lowers
`lazyJsGzMaxBytes` to the final measured total plus 5% in E3.

`hover-fx` measures 1429 in the 2026-11-15 `dist/` against a cap of 1408. A5 is the first task to touch budgets: if
`check:budget` reports `hover-fx` over its cap on a clean build before any change, A5 raises that cap to 1536 and
says so in its report.

How caps are applied: a task raises only the caps it needs, to the value in "Proposed cap", in its own commit. The
`lazyJsGzMaxBytes` total is raised by A5 to 23040 once.

Home HTML is the tightest number: about 570 B of headroom at the end. If a task finds `html=` for `index.html`
above 32500 after its change, it stops and applies these trims in order until it is back under, and reports which:
(1) drop the label on the arch (C4 step 2, about 120 B); (2) drop the counter of the page transition (B3 steps 4
and 5, about 170 B); (3) drop the two words of the preloader, keeping the hairline (C1, about 70 B).

### Byte ledger (filled in by each task, R14)

| Task | home html | home inlineCss | first-load max | lazy total | Notes |
|---|---|---|---|---|---|
| baseline | 31240 | 13307 | 5170 | 16616 | measured by A6 before its change; case page caato: html 21468, inlineCss 13307 |
| A6 | 30908 | 12944 | 5170 | 16616 | case.css only on case pages; case page caato: html 21610, inlineCss 13357; home -363 B inline CSS, -332 B html |

## Brand deviations

`D:\GitHub\brand\PLAN.md` sections B7 (motion) and B8 (cursor) are the brand's motion spec. This pass departs from
them on purpose in these places; everything else in B7 and B8 holds.

| # | B7 / B8 says | This pass does | Task |
|---|---|---|---|
| 1 | No animation on hero text | The hero strip (status pill, kicker, HUD), the mono strap and the three CTAs animate in once. The `h1`, the lead paragraph, the portrait image and every ancestor of them stay still | C2 |
| 2 | Masked line reveal: 105% rise, 800 ms, 80 ms stagger, brand ease-out | lamalama's values: 80% rise, scale .96, fade, 850 ms, expo-out, 150 ms base delay, stagger spread by line count | B1 |
| 3 | Scroll progress is a top bar | A left rail with a percentage on wide screens; the top bar elsewhere | C5 |
| 4 | Page transition: 250 ms root fade | A 1.55 s cover, hold with counter, reveal; the morph is kept | B3 |
| 5 | `--vn-ease-out` `(0.22, 0.61, 0.36, 1)`, `--vn-ease-in-out` `(0.65, 0, 0.35, 1)`, hover 250 ms | Site overrides: `(.25, 1, .5, 1)`, `(.76, 0, .24, 1)`, hover 400 ms | C7 |
| 6 | Cursor label physics: tau 150 ms | Tau 65 ms (the time constant of a 0.45 s expo-out) | B2a |
| 7 | Cursor is a dot, a lens, a label and a media card | A WebGL layer also redraws images under the trail, displaced by the flow. Still never `cursor: none` | B2b |
| 8 | Five signature patterns; scrolling is native (WOW-PLAN U7: "no Lenis, no scroll-jacking") | A preloader, a pinned horizontal chapter driven by native scroll, and a smoothed mouse wheel on fine pointers | C1, C3, B4 |
| 9 | Hover text and press only on buttons | Outline buttons fill from the edge over 0.8 s | C8 |
| 10 | Hero badge spins on time | It also turns with scroll | C9 |

## Decisions for the owner to confirm

- A4 rewrites the Projects subtitle (the old one promised a hover preview).
- D3 colours the portrait automatically on touch, on the first scroll or touch.
- The lazy JS budget rises from 17408 to 23040 (table above); inline CSS, HTML and first-load caps do not move.
- B3 makes every in-site navigation last about 1.55 s (lamalama's timing). The hold can be cut to 0 in one line.
- B2b leaves the hero portrait out of the distortion (it is grayscale by a CSS filter with a persistent colour brush
  on a canvas above it; redrawing it in WebGL would show the wrong colours).
- C1 shows the preloader only on the first home visit of a browser session.

# Task specs

Each spec stands alone together with the Rules section above. Line numbers are those of 2026-11-15; match by the
quoted text, not by number. Every spec ends with "Done when" (checkable from outside) and a commit message.

---

## A6. Case-study CSS only on case pages

**Goal.** `src/styles/sections/case.css` (3.5 KB raw) is inlined into every page through `site.css`, yet only
`src/components/CaseStudyPage.astro` uses its classes. Import it from that component instead, so the home, privacy and
404 pages stop carrying it. Expected: home `inlineCss` and `html` each drop by 500 to 700 B gz. No visual change.

**Files.** `src/styles/site.css`, `src/styles/sections/case.css`, `src/styles/sections/responsive.css`,
`src/components/CaseStudyPage.astro`, `e2e/gates.spec.ts` (one new test), this file (ledger).

**Do not change.** Any rule's declarations; `src/styles/sections/base.css` (its `.vn-case-grid > *` rule stays, it is
harmless); `src/styles/fx/case.css` (that is the motion sheet, a different file); `astro.config.mjs`.

**Steps.**

1. Measure the baseline (R14) and write the "baseline" row of the Byte ledger.
2. `src/styles/site.css`, line 15: delete the line `@import "./sections/case.css";`.
3. `src/styles/sections/responsive.css`. Three case rules depend on coming after `case.css`; move them into
   `case.css` so order no longer matters.
   - Lines 33 to 39 today:
     ```css
         .vn-hero__inner,
         .vn-about-grid,
         .vn-numbers-lower,
         .vn-faq-layout,
         .vn-case-grid {
           grid-template-columns: 1fr;
         }
     ```
     becomes (remove the last selector and the comma before it):
     ```css
         .vn-hero__inner,
         .vn-about-grid,
         .vn-numbers-lower,
         .vn-faq-layout {
           grid-template-columns: 1fr;
         }
     ```
   - Lines 68 to 74 today, inside `@media (max-width: 720px)`: delete both rules
     ```css
         .vn-case-pager {
           grid-template-columns: 1fr;
         }

         .vn-case-pager__link--next {
           text-align: left;
         }
     ```
4. `src/styles/sections/case.css`.
   - Insert as the very first line of the file, before `@layer site {`:
     ```css
     @layer vn.reset, vn.tokens, vn.base, vn.type, vn.components, vn.utilities, site;
     ```
     Reason: this file now becomes its own `<style>` block. If the build ever emits that block before the main one,
     `@layer site` would be declared before the brand layers and lose to them. Restating the full order makes the
     block order irrelevant.
   - Before the closing `}` of `@layer site` (after the comment on line 142), add:
     ```css
       @media (max-width: 1080px) {
         .vn-case-grid { grid-template-columns: 1fr; }
       }

       @media (max-width: 720px) {
         .vn-case-pager { grid-template-columns: 1fr; }
         .vn-case-pager__link--next { text-align: left; }
       }
     ```
5. `src/components/CaseStudyPage.astro`, frontmatter, after line 5 (`import Words from './Words.astro';`) add:
   ```ts
   import '../styles/sections/case.css';
   ```
6. Build. Check the split really happened (PowerShell):
   ```powershell
   (Select-String -Path dist/index.html -Pattern 'vn-case-hero' -Quiet)            # must print False
   (Select-String -Path dist/projetos/caato/index.html -Pattern 'vn-case-hero\{' -Quiet)  # must print True
   (Select-String -Path dist/en/projects/caato/index.html -Pattern 'vn-case-hero\{' -Quiet) # must print True
   ```
   Decision rule: if the first command prints True, Astro merged the chunk back into the shared sheet. Then revert
   steps 2 to 5 and report "A6 not possible with this Astro version"; later tasks then use the trims listed under
   "Budgets".
7. Add to `e2e/gates.spec.ts`, after the last test of the file:
   ```ts
   test('case CSS is inlined only on case pages and still beats the brand layers', async ({ page }) => {
     await page.goto('/');
     expect(await page.evaluate(() => [...document.querySelectorAll('style')].some((s) => s.textContent!.includes('.vn-case-hero')))).toBe(false);
     await page.setViewportSize({ width: 1366, height: 800 });
     await page.goto('/projetos/caato/');
     // a site-layer rule that the brand would otherwise override: the pager is a two-column grid
     await expect(page.locator('.vn-case-pager')).toHaveCSS('display', 'grid');
     expect(await page.locator('.vn-case-grid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(2);
     await page.setViewportSize({ width: 700, height: 800 });
     expect(await page.locator('.vn-case-grid').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(1);
     expect(await page.locator('.vn-case-pager').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)).toBe(1);
     await expect(page.locator('.vn-case-pager__link--next')).toHaveCSS('text-align', 'left');
   });
   ```
8. Run the gate, then `npx playwright test e2e/gates.spec.ts e2e/case-scroll.spec.ts e2e/case-404-fx.spec.ts
   e2e/projects.spec.ts e2e/thorough-pages-1.spec.ts e2e/thorough-pages-2.spec.ts e2e/thorough-pages-3.spec.ts
   e2e/thorough-pages-4.spec.ts e2e/a11y.spec.ts`.
9. Add the A6 ledger row.

**Reduced motion, no JS, touch.** Not affected (static CSS only).

**Bytes.** Home `inlineCss` and `html`: minus 500 to 700 B gz each. Case pages: plus about 40 B (the layer statement).

**Pitfalls.**
- `e2e/projects.spec.ts` ("built CSS: @view-transition only inside the no-preference block") joins every `<style>`
  block of `dist/projetos/caato/index.html`; it still passes with two blocks.
- If a unit test in `tests/dist-*.test.mjs` asserts exactly one `<style>` element per page, change that assertion to
  "at least one" for case pages and say so in the report.
- Do not move any other section file. Home sections share rules with the 404 and privacy pages.

**Done when.**
- The three `Select-String` checks print False, True, True.
- `npm run check:budget` prints a home `inlineCss` at least 450 B lower than the baseline row.
- Gate green; the specs of step 8 green.

**Commit.** `perf(css): inline case-study styles only on case pages`

---

## A5. Late sheet: interaction-only CSS leaves the inline sheet and the first-load script

**Goal.** One lazy chunk, `late`, adopts a constructable stylesheet on idle for every visitor. It takes over the two
hand-minified sheets that `src/scripts/main.ts` builds today (hover colours, case rows) and the pointer-only rules
that are still inline. Later tasks (C5, C8, D1) add their non-critical CSS to it.

**Files.** New: `src/scripts/late.ts`, `src/styles/late/hover.css`. Edited: `src/scripts/main.ts`,
`src/styles/sections/chrome.css`, `src/styles/sections/projects.css`, `src/styles/sections/numbers.css`, `budget.json`,
this file. Tests: `e2e/chrome-fx.spec.ts` (one new test) and whichever existing spec needs the new wait (step 8).

**Do not change.** The FAQ sheet in `main.ts` (lines 49 to 65; it is gated by an IntersectionObserver and stays);
`:focus-visible` and `.is-active` rules (keyboard users must not wait for a lazy chunk); `src/scripts/hover-fx.ts`;
the `.vn-arc` rules in `services.css`.

**Steps.**

1. Baseline (R14). If `check:budget` already fails on `hover-fx` before any change, set `"hover-fx": 1536` in
   `budget.json` first and note it in the report.
2. Create `src/styles/late/hover.css` with exactly this content:
   ```css
   /* late/hover.css: adopted on idle by src/scripts/late.ts into @layer site (do not wrap it in @layer yourself).
      Interaction-only rules: nothing here is needed at first paint or without a pointer. */

   /* Button hover colours (were a string in main.ts). */
   .vn-hero-btn-ghost:hover:not(:disabled) { background-color: var(--hero-btn-fg); border-color: var(--hero-btn-fg); color: var(--g-bg); }
   .vn-hero-btn-cv:hover:not(:disabled) { background-color: color-mix(in srgb, var(--hero-btn-fg) 12%, transparent); color: var(--hero-btn-fg); }
   [data-surface="signal"] .vn-btn--primary:hover:not(:disabled) { background-color: var(--vn-cream); color: var(--vn-ink); box-shadow: var(--vn-shadow-lift); }
   .vn-contact-secondary:hover:not(:disabled) { background-color: var(--vn-ink); border-color: var(--vn-ink); color: var(--vn-cream); }

   /* Case pages: spec-row wipe and pager lift (were a string in main.ts). */
   .vn-case .vn-spec-list__row { position: relative; }
   .vn-case .vn-spec-list__row::after { content: ""; position: absolute; inset: auto 0 -1px; height: 1px; background: var(--vn-signal-ink); transform: scaleX(0); transform-origin: left; }
   .vn-case .vn-spec-list__row:hover::after, .vn-case .vn-spec-list__row:focus-within::after { transform: scaleX(1); }
   .vn-case .vn-spec-list__row:hover dt, .vn-case .vn-spec-list__row:focus-within dt { transform: translateX(8px); }
   .vn-case-pager__link:hover, .vn-case-pager__link:focus-visible { transform: translateY(-3px); }
   @media (prefers-reduced-motion: no-preference) {
     .vn-case .vn-spec-list__row::after { transition: transform .8s cubic-bezier(.25, 1, .5, 1); }
     .vn-case .vn-spec-list__row dt, .vn-case-pager__link { transition: transform .4s cubic-bezier(.25, 1, .5, 1); }
   }

   /* Header nav hover (the active and focus states stay inline in chrome.css). */
   .vn-navbar__link:hover { color: var(--vn-text); }
   .vn-navbar__link:hover::after { transform: scaleX(1); }
   @media (prefers-reduced-motion: no-preference) {
     [data-fx="roll"]:hover > span > span { transform: translateY(-100%); }
   }

   /* Project thumbnails: hover zoom. transform, so it composes with the clip unveil, which owns `scale`. */
   @media (hover: hover) and (prefers-reduced-motion: no-preference) {
     html .vn-work-row.vn-project-row .vn-project-row__media img { transition: transform 600ms var(--vn-ease-out), scale 1.8s cubic-bezier(.16, 1, .3, 1); }
     html .vn-work-row.vn-project-row:is(:hover, :focus-visible) .vn-project-row__media img { transform: scale(1.06); }
   }

   /* Numbers: pointer spotlight layer of the impact cards (--mx/--my are written by hover-fx.ts). */
   .vn-impact-card { background: radial-gradient(180px circle at var(--mx, -999px) var(--my, -999px), color-mix(in srgb, var(--vn-signal, #ff4d00) 16%, transparent), transparent 70%), var(--vn-ref-ink-925); }
   ```
3. Create `src/scripts/late.ts`:
   ```ts
   import hover from '../styles/late/hover.css?inline';

   // Late sheet: CSS nobody needs at first paint (hover, pointer, decorative extras), adopted on idle for every
   // visitor, reduced motion and touch included. Motion inside it is guarded by its own media queries.
   export function init(): void {
     try {
       const sh = new CSSStyleSheet();
       sh.replaceSync(`@layer site{${hover}}`);
       document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
       document.documentElement.dataset.late = ''; // ready flag: tests wait on it
     } catch {
       /* no constructable stylesheets: the page keeps its inline styles */
     }
   }
   ```
4. `src/scripts/main.ts`. Delete lines 22 to 48 (the two `onIdle` blocks that start with the comments
   `// button hover colours (pointer-only), kept out of the inline critical CSS` and
   `// case pages: spec-row wipe and pager lift (interaction-only), kept out of the inline critical CSS`) and put in
   their place:
   ```ts
     // A5: interaction-only CSS (hover colours, case rows, nav hover, thumbnail zoom), one lazy sheet for everyone.
     onIdle(() => void import('./late').then((m) => m.init()));
   ```
5. `src/styles/sections/chrome.css`.
   - Lines 47 to 50 today:
     ```css
       .vn-navbar__link:hover,
       .vn-navbar__link.is-active {
         color: var(--vn-text);
       }
     ```
     become
     ```css
       .vn-navbar__link.is-active {
         color: var(--vn-text);
       }
     ```
   - Lines 70 to 73 today:
     ```css
       .vn-navbar__link:hover::after,
       .vn-navbar__link.is-active::after {
         transform: scaleX(1);
       }
     ```
     become
     ```css
       .vn-navbar__link.is-active::after {
         transform: scaleX(1);
       }
     ```
   - Lines 89 to 92 today:
     ```css
         [data-fx="roll"]:hover > span > span,
         [data-fx="roll"]:focus-visible > span > span {
           transform: translateY(-100%);
         }
     ```
     become
     ```css
         [data-fx="roll"]:focus-visible > span > span {
           transform: translateY(-100%);
         }
     ```
   Leave everything else in the roll block (`display: block`, `overflow: clip`, `line-height: 1.5`, the `text-shadow`
   and the `transition`) inline: those set the label's box, and moving them would shift the header when the late sheet
   arrives.
6. `src/styles/sections/projects.css`: delete lines 68 to 77 (the comment
   `/* Hover zoom uses transform so it composes with the clip unveil ... */` and the whole
   `@media (hover: hover) and (prefers-reduced-motion: no-preference) { ... }` block after it).
7. `src/styles/sections/numbers.css`, line 57 today:
   ```css
       background: radial-gradient(180px circle at var(--mx, -999px) var(--my, -999px), color-mix(in srgb, var(--vn-signal, #ff4d00) 16%, transparent), transparent 70%), var(--vn-ref-ink-925);
   ```
   becomes
   ```css
       background: var(--vn-ref-ink-925);
   ```
8. `budget.json`: set `"lazyJsGzMaxBytes": 23040` and add `"late": 1792` to `lazyChunks`. Update the "Cap today"
   column of the Budgets table for the rows you changed.
9. Tests.
   - Add to `e2e/chrome-fx.spec.ts`, inside `test.describe('chrome fx', ...)`:
     ```ts
     test('late sheet: lazy for everyone, carries the hover rules, none of them inline', async ({ page }) => {
       const hits: string[] = [];
       page.on('request', (r) => /\/_astro\/late\./.test(r.url()) && hits.push(r.url()));
       await page.emulateMedia({ reducedMotion: 'reduce' }); // it must load under reduced motion too
       await page.setViewportSize({ width: 1366, height: 800 });
       await page.goto('/');
       await page.waitForFunction(() => 'late' in document.documentElement.dataset);
       expect(hits.length).toBe(1);
       const inline = await page.evaluate(() => [...document.querySelectorAll('style')].map((s) => s.textContent).join(''));
       expect(inline).not.toContain('.vn-navbar__link:hover');
       expect(inline).not.toContain('vn-project-row__media img{transition');
       const link = page.locator('.vn-navbar__link').first();
       const before = await link.evaluate((e) => getComputedStyle(e).color);
       await link.hover();
       await expect.poll(() => link.evaluate((e) => getComputedStyle(e).color)).not.toBe(before);
     });
     ```
   - Run `npx playwright test e2e/chrome-fx.spec.ts e2e/case-404-fx.spec.ts e2e/projects.spec.ts e2e/hover-fx.spec.ts
     e2e/cursor.spec.ts e2e/services-arc.spec.ts e2e/interactions.spec.ts e2e/thorough-interactions.spec.ts
     e2e/gates.spec.ts e2e/a11y.spec.ts`. Where an existing test hovers an element right after `goto` and now fails
     because the rule arrives a few milliseconds later, add
     `await page.waitForFunction(() => 'late' in document.documentElement.dataset);` before the hover. Do not weaken
     any assertion.
10. Ledger row.

**Reduced motion, no JS, touch.** The chunk loads on idle in all three JS cases; its motion rules are inside
`prefers-reduced-motion: no-preference` blocks. Without JS there are no hover niceties (brand button hovers remain,
they are in the brand layer); nothing is hidden.

**Bytes.** Home `inlineCss` minus 250 to 350 B gz. First-load JS minus about 350 B gz. New lazy chunk `late` about
520 B gz.

**Pitfalls.**
- R2: the late sheet and the fx sheet arrive in either order. `hover.css` sets `transform` on
  `.vn-project-row__media img`; `fx/parallax.css` animates `scale` and `translate` on it. Different properties, so
  no conflict. Keep it that way.
- The `:not(.is-done)` transition rule of `motion.css` has higher specificity than the thumbnail hover transition, as
  before; the zoom starts working once the row is `.is-done` (R7). Same behaviour as today.
- `.vn-case .vn-spec-list__row` rules are inert on pages without `.vn-case`; the old `querySelector('.vn-case')`
  guard is not needed.
- Vite minifies `?inline` CSS. Do not put `animation-timeline` rules in `late/*.css` without reading R4.

**Done when.**
- `dist/_astro/late.*.js` exists, is not referenced by any `<script>` or `modulepreload` in `dist/index.html`, and
  `check:budget` passes with the new caps.
- `check:budget`: home `inlineCss` at least 200 B below the A6 ledger row; `first-load max` at least 250 B below.
- Gate and the specs of step 9 green.

**Commit.** `perf(css): move interaction-only rules to a lazy late sheet`

---

## C7. Era's easings and hover duration as token overrides

**Goal.** Every transition in the site that uses the brand tokens takes Era's curves: "out"
`cubic-bezier(.25, 1, .5, 1)`, "in-out" `cubic-bezier(.76, 0, .24, 1)`, and a 0.4 s hover. The duration scale
0.4 / 0.8 / 1.2 s is already in `motion.css`; later tasks use 1.6 s only for the page transition and the preloader.

**Files.** `src/styles/sections/base.css`, `e2e/chrome-fx.spec.ts` (one test), this file.

**Do not change.** The brand package; any other duration; `--vn-ease-spring`.

**Steps.**

1. `src/styles/sections/base.css`: directly after the two `:root[data-theme=...] { color-scheme: ... }` lines
   (lines 4 and 5), add:
   ```css
     /* Era's curves and hover time, site-wide. Only under no-preference: the brand sets the durations to 1ms
        under reduced motion and that must keep winning. */
     @media (prefers-reduced-motion: no-preference) {
       :root {
         --vn-ease-out: cubic-bezier(.25, 1, .5, 1);
         --vn-ease-in-out: cubic-bezier(.76, 0, .24, 1);
         --vn-dur-hover: .4s;
       }
     }
   ```
2. Test, in `e2e/chrome-fx.spec.ts` inside the describe block:
   ```ts
   test('easing and hover tokens: Era values, brand 1ms under reduced motion', async ({ page }) => {
     await page.setViewportSize({ width: 1366, height: 800 });
     await page.goto('/');
     const v = (n: string) => page.evaluate((k) => getComputedStyle(document.documentElement).getPropertyValue(k).replace(/\s+/g, ''), n);
     expect(await v('--vn-ease-out')).toBe('cubic-bezier(.25,1,.5,1)');
     expect(await v('--vn-ease-in-out')).toBe('cubic-bezier(.76,0,.24,1)');
     expect(await page.locator('.vn-navbar__link').first().evaluate((e) => getComputedStyle(e, '::after').transitionDuration)).toBe('0.4s');
     await page.emulateMedia({ reducedMotion: 'reduce' });
     expect(await v('--vn-dur-hover')).toBe('1ms');
   });
   ```
3. Gate; `npx playwright test e2e/chrome-fx.spec.ts e2e/services-arc.spec.ts e2e/faq-fx.spec.ts e2e/magnetic.spec.ts
   e2e/gates.spec.ts`. Ledger row.

**Reduced motion, no JS, touch.** Under reduced motion the brand values apply untouched. No JS and touch get the new
curves (pure CSS).

**Bytes.** Home `inlineCss` plus about 55 B gz.

**Pitfalls.** A test that waits a fixed 250 to 300 ms for a hover transition may now read a mid-transition value;
replace that wait with `expect.poll` on the final value, never with a shorter assertion.

**Done when.** The new test passes; gate green; no other file changed.

**Commit.** `style(motion): era easing curves and 0.4s hover as site token overrides`

---

## B1. Line reveal with lamalama's values

**Goal.** Split headlines (`[data-enter=mask]`, words in `.vn-w` spans from `src/components/Words.astro`) and split
paragraphs (`[data-enter=lines]`, words wrapped by `scroll-fx.ts`) enter like lamalama's lines: each rendered line
rises from 80% of its height, from scale .96 and opacity 0, through a mask, with `expo.out` over 0.85 s, after a
0.15 s base delay, and the lines of one block are spread over `(135 + 30 N)` ms for `N` lines, that is a step of
`(135 + 30 N) / (N - 1)` ms.

**Files.** `src/styles/sections/motion.css`, `src/scripts/reveal.ts`, `src/styles/fx/text.css`,
`e2e/lines-reveal.spec.ts` (one new test), this file.

**Do not change.** `Words.astro`; the word-splitting code in `scroll-fx.ts`; the non-mask entrances (`left`, `right`,
`scale`, `clip`, `wipe`); the hero `h1` (it has no `data-enter` and must never get one); the mask's wide clip margins
(see pitfall 1).

**Steps.**

1. `src/styles/sections/motion.css`, lines 51 to 55 today:
   ```css
       html.js [data-enter=mask] .vn-w {
         display: inline-block;
         translate: 0 calc(var(--h) * 180%);
         clip-path: inset(-40% -20% calc(var(--h) * 180% - 35%));
       }
   ```
   become
   ```css
       html.js [data-enter=mask] .vn-w {
         display: inline-block;
         transform-origin: 0 100%;
         opacity: calc(1 - var(--h));
         translate: 0 calc(var(--h) * 80%);
         scale: calc(1 - var(--h) * .04);
         clip-path: inset(-40% -20% calc(var(--h) * 150% - 35%));
       }
   ```
2. Same file, directly after the rule on lines 60 to 64 (the one whose selector starts with
   `html.js :is([data-enter], [data-enter=mask] .vn-w, [data-enter=clip] img):not(.is-done, .is-done *)`), add:
   ```css
       /* lamalama line timing: expo-out, .85s, .15s base delay, the block's lines spread over (135 + 30 N) ms.
          --ls is that step, written by reveal.ts. Same specificity as the rule above, so it must stay after it. */
       html.js [data-enter=mask] .vn-w:not(.is-done, .is-done *) {
         transition-duration: .85s;
         transition-timing-function: cubic-bezier(.16, 1, .3, 1);
         transition-delay: calc(150ms + var(--i, 0) * 100ms + var(--l, 0) * var(--ls, 100ms));
       }
   ```
3. `src/scripts/reveal.ts`, function `lines` (lines 2 to 12 today). Replace the whole function with:
   ```ts
   function lines(el: Element): void {
     let top = -1e9;
     let l = -1;
     el.querySelectorAll<HTMLElement>('.vn-w').forEach((w) => {
       if (w.offsetTop > top + 4) {
         top = w.offsetTop;
         l++;
       }
       w.style.setProperty('--l', String(l));
     });
     // lamalama's stagger: a block of N lines spreads over (135 + 30 N) ms, so the step shrinks as N grows.
     const n = l + 1;
     (el as HTMLElement).style.setProperty('--ls', n > 1 ? `${Math.round((135 + 30 * n) / (n - 1))}ms` : '0ms');
   }
   ```
4. `src/styles/fx/text.css`, lines 9 to 18 today:
   ```css
     html.js [data-enter=lines] .vn-w {
       position: relative; /* inline + top, not inline-block + translate: hyphenated words must still wrap exactly as in plain text */
       top: calc(var(--h) * 1.8em);
       clip-path: inset(-40% -20% calc(var(--h) * 180% - 35%));
     }
     html.js [data-enter=lines]:not(.is-done) .vn-w {
       transition: top .8s, clip-path .8s;
       transition-timing-function: cubic-bezier(.25, 1, .5, 1);
       transition-delay: calc(var(--l, 0) * 100ms);
     }
   ```
   become
   ```css
     html.js [data-enter=lines] .vn-w {
       position: relative; /* inline + top, not inline-block + translate: hyphenated words must still wrap exactly as in plain text */
       top: calc(var(--h) * .8em);
       opacity: calc(1 - var(--h));
       clip-path: inset(-40% -20% calc(var(--h) * 180% - 35%));
     }
     html.js [data-enter=lines]:not(.is-done) .vn-w {
       transition: top .85s, opacity .85s, clip-path .85s;
       transition-timing-function: cubic-bezier(.16, 1, .3, 1);
       transition-delay: calc(150ms + var(--l, 0) * var(--ls, 100ms));
     }
   ```
5. Test, appended to `e2e/lines-reveal.spec.ts` after the test "S/M/L ladder: ...":
   ```ts
   test('mask headline words use the lamalama line timing and settle at identity', async ({ page }) => {
     await ready(page); // 1366x900, '/', waits for the fx sheet
     const h = page.locator('#servicos h2[data-enter=mask]');
     const w = h.locator('.vn-w').first();
     // deferred sections keep stale computed styles until rendered (R8): render them all, the heading stays far below
     await page.evaluate(() => document.documentElement.classList.add('vn-cv-off'));
     // hidden pose, read while the heading is still below the fold
     const hid = await w.evaluate((e) => { const c = getComputedStyle(e); return [c.opacity, c.scale, c.transitionDuration, c.transitionTimingFunction]; });
     expect(hid[0]).toBe('0');
     expect(parseFloat(hid[1])).toBeCloseTo(0.96, 2);
     expect(hid[2].split(', ').every((d) => d === '0.85s')).toBe(true);
     expect(hid[3]).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
     await h.scrollIntoViewIfNeeded();
     await expect(h.locator('xpath=..')).toHaveClass(/is-in/);
     const { ls, n } = await h.evaluate((e) => ({
       ls: (e as HTMLElement).style.getPropertyValue('--ls'),
       n: Math.max(...[...e.querySelectorAll<HTMLElement>('.vn-w')].map((x) => Number(x.style.getPropertyValue('--l')))) + 1,
     }));
     expect(ls).toBe(n > 1 ? `${Math.round((135 + 30 * n) / (n - 1))}ms` : '0ms');
     await expect.poll(() => w.evaluate((e) => getComputedStyle(e).opacity), { timeout: 4000 }).toBe('1');
     await expect.poll(() => w.evaluate((e) => parseFloat(getComputedStyle(e).scale))).toBe(1);
   });
   ```
   (`#servicos h2` sits in a `[data-stagger]` head, so its parent receives `.is-in`.)
6. Gate; `npx playwright test e2e/lines-reveal.spec.ts e2e/choreography.spec.ts e2e/split-reveal.spec.ts
   e2e/scroll-fx.spec.ts e2e/sections.spec.ts e2e/a11y.spec.ts e2e/gates.spec.ts`. Ledger row.

**Reduced motion, no JS, touch.** All changed rules are under `html.js` and `prefers-reduced-motion: no-preference`
(motion.css line 38 wraps them; `text.css` has its own media query). Without JS and under reduced motion the words
are plain text. Touch gets the same reveal (no pointer needed).

**Bytes.** Inline CSS plus about 60 B gz; first-load JS plus about 45 B gz; `scroll-fx` plus about 20 B gz.

**Pitfalls.**
1. lamalama clips with `inset(-10%)`. Our display face is an italic with a line-height near 1, whose descenders and
   slant reach well outside the word box, so the settled clip keeps the existing wide margins (`-40% -20% ... -35%`).
   Only the hidden pose and the timing change. Do not "correct" the margins to -10%.
2. R7: the longest case is a six-line paragraph inside a stagger group: 150 + 600 + 315 + 850 = 1915 ms, inside the
   3200 ms before `.is-done`. If you raise any number, re-check this sum.
3. The words now fade. `e2e/a11y.spec.ts` audits after the reveals have settled; if axe reports a contrast failure on
   a `.vn-w`, the audit ran mid-transition: make the spec wait for `.is-done` on that block instead of touching the
   CSS.
4. `scale` on an inline-block does not change layout, so `e2e/choreography.spec.ts` ("split headlines take the same
   space with and without the motion layout") must still pass. If it fails, you changed `display` or added padding.
5. The new transition rule relies on source order (same specificity as the generic one). Keep it immediately after.

**Done when.**
- The new test and the listed specs pass.
- Frame capture check (manual, 1440 wide, `/`): scrolling to "Serviços", the two heading lines rise one after the
  other from just below their baseline and fade in; nothing jumps when the transition ends.
- Gate green.

**Commit.** `feat(motion): lamalama line reveal timing for split headlines and paragraphs`

---

## C2. Hero opening on the elements around the LCP

**Goal.** At first paint the `h1`, the lead paragraph and the portrait image are simply there. Around them, once:
the top strip and the mono strap wipe in from the left with their hairlines, the grid fades in, the three CTAs rise,
the four chips and the badge pop, the portrait's inner frame line and its caption fade in. Total length about 1.5 s.
C1 (preloader) and B3 (page transition) later delay the whole sequence through one custom property, `--t0`.

**Files.** `src/styles/sections/hero.css`, `e2e/hero.spec.ts` (two new tests), this file.

**Do not change.** `src/components/home/Hero.astro`; the `h1`, `.vn-hero__sub`, `.vn-hero-portrait`,
`.vn-hero-portrait__img`, `.vn-hero__stage`, `.vn-hero__copy`, `.vn-hero__inner`, `.vn-hero` themselves (never give
any of them an animation, opacity, clip-path or transform here: they are the LCP elements or their ancestors);
`src/scripts/hero.ts`, `hero-fx.ts`.

**Why these elements are safe (R3 check, done for you).**

| Element | Existing animation or JS style | What we animate | Conflict |
|---|---|---|---|
| `.vn-hero__strip` | none (its child `[data-vn-hud]` gets an inline `transform` from `hero-fx.ts`) | `clip-path` | none |
| `.vn-hero__strap` | none | `clip-path` | none |
| `.vn-hero__grid` | none (its `::before` reads `--vn-gx/--vn-gy`; `hero-fx.ts` appends a sheen child) | `opacity` | none |
| `.vn-hero__actions > a` | brand `transition` on `transform`; `magnetic.ts` writes inline `translate` and a `translate` transition | `opacity`, `translate`, `fill-mode: backwards` | none: after the animation ends it no longer applies, so the inline `translate` works |
| `.vn-hero-chip` | inline `transform` from `hero-fx.ts` | `opacity`, `scale` (individual property) | none |
| `.vn-hero-badge` | inline `transform` from `hero-fx.ts`; its child `.vn-hero-badge__svg` has `animation: vn-spin` | `opacity`, `scale` on the wrapper | none: different element from the spin |
| `.vn-hero-portrait__frame` | none | `opacity` | none (sibling of the image, not an ancestor) |
| `.vn-hero-portrait__hint` | `hero-fx.ts` later sets inline `opacity` and `transition` | `opacity`, `fill-mode: backwards` | none |

The fx sheet adopted on idle animates `.vn-hero__inner`, `.vn-hero::after`, `.vn-hero-portrait__img` and
`.vn-hero-portrait__canvas`. None of those is in the table, so adopting it mid-intro cuts nothing.

**Steps.**

1. `src/styles/sections/hero.css`: before the closing `}` of `@layer site` (after the `.vn-hero-badge__center` rule
   that ends on line 319), add:
   ```css
     /* C2 opening. Only non-LCP elements; never the h1, the lead, the portrait image or an ancestor of them.
        --d is the step index (80ms each); --t0 delays the whole sequence (set by the preloader and the page
        transition). fill-mode backwards: hidden only until each element's turn, plain afterwards. */
     @media (prefers-reduced-motion: no-preference) {
       @keyframes vn-o-wipe { from { clip-path: inset(0 100% 0 0); } }
       @keyframes vn-o-rise { from { opacity: 0; translate: 0 1.25rem; } }
       @keyframes vn-o-pop { from { opacity: 0; scale: .8; } }
       @keyframes vn-o-fade { from { opacity: 0; } }

       html.js :is(.vn-hero__strip, .vn-hero__strap, .vn-hero__grid, .vn-hero__actions > *, .vn-hero-chip, .vn-hero-badge, .vn-hero-portrait__frame, .vn-hero-portrait__hint) {
         animation: vn-o-rise .8s cubic-bezier(.25, 1, .5, 1) calc(var(--t0, 0s) + var(--d, 0) * 80ms) backwards;
       }
       html.js :is(.vn-hero__strip, .vn-hero__strap) { animation-name: vn-o-wipe; animation-duration: 1.2s; }
       html.js :is(.vn-hero__grid, .vn-hero-portrait__frame, .vn-hero-portrait__hint) { animation-name: vn-o-fade; }
       html.js :is(.vn-hero-chip, .vn-hero-badge) { animation-name: vn-o-pop; }

       .vn-hero__strap, .vn-hero-portrait__frame { --d: 2; }
       .vn-hero__actions > :nth-child(1) { --d: 3; }
       .vn-hero__actions > :nth-child(2), .vn-hero-chip--tl { --d: 4; }
       .vn-hero__actions > :nth-child(3), .vn-hero-chip--tr { --d: 5; }
       .vn-hero-chip--bl { --d: 6; }
       .vn-hero-chip--br { --d: 7; }
       .vn-hero-badge { --d: 8; }
       .vn-hero-portrait__hint { --d: 9; }
     }
   ```
   The last element starts at 720 ms and ends at 1520 ms.
2. Tests, in `e2e/hero.spec.ts`, after the `for (const route of ROUTES) { ... }` loop:
   ```ts
   test('hero opening animates only non-LCP elements and ends at rest', async ({ page }) => {
     await page.setViewportSize({ width: 1366, height: 800 });
     await page.goto('/');
     const targets = await page.evaluate(() => {
       const h1 = document.querySelector('h1.vn-hero__title')!;
       const img = document.querySelector('.vn-hero-portrait__img')!;
       const sub = document.querySelector('.vn-hero__sub')!;
       return document.getAnimations()
         .filter((a) => /^vn-o-/.test((a as CSSAnimation).animationName ?? ''))
         .map((a) => (a.effect as KeyframeEffect).target as Element)
         .map((t) => ({ cls: String(t.className).split(' ')[0], bad: t.contains(h1) || t.contains(img) || t.contains(sub) || h1.contains(t) }));
     });
     expect(targets.length).toBeGreaterThanOrEqual(8);
     expect(targets.filter((t) => t.bad)).toEqual([]);
     // the LCP elements are fully painted from the first frame
     for (const sel of ['h1.vn-hero__title', '.vn-hero__sub', '.vn-hero-portrait', '.vn-hero-portrait__img', '.vn-hero__inner']) {
       const s = await page.locator(sel).evaluate((e) => { const c = getComputedStyle(e); return [c.opacity, c.clipPath, c.animationName]; });
       expect(s[0], sel).toBe('1');
       expect(s[1], sel).toBe('none');
       expect(s[2], sel).not.toMatch(/vn-o-/);
     }
     // everything ends visible and unclipped
     await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => /^vn-o-/.test((a as CSSAnimation).animationName ?? '') && a.playState !== 'finished').length), { timeout: 5000 }).toBe(0);
     for (const sel of ['.vn-hero__strip', '.vn-hero__strap', '.vn-hero__actions > a', '.vn-hero-chip', '.vn-hero-badge', '.vn-hero__grid']) {
       const s = await page.locator(sel).first().evaluate((e) => { const c = getComputedStyle(e); return [c.opacity, c.clipPath]; });
       expect(s, sel).toEqual(['1', 'none']);
     }
   });

   test('hero opening is off under reduced motion and without JS', async ({ browser }) => {
     for (const opts of [{ reducedMotion: 'reduce' as const }, { javaScriptEnabled: false }]) {
       const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, baseURL: test.info().project.use.baseURL, ...opts });
       const page = await ctx.newPage();
       await page.goto('/en/');
       const names = await page.locator('.vn-hero__strip, .vn-hero__strap, .vn-hero-chip, .vn-hero-badge, .vn-hero__actions > a').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
       expect(new Set(names)).toEqual(new Set(['none']));
       await ctx.close();
     }
   });
   ```
3. Gate; `npx playwright test e2e/hero.spec.ts e2e/gates.spec.ts e2e/handoffs.spec.ts e2e/parallax.spec.ts
   e2e/magnetic.spec.ts e2e/cursor.spec.ts e2e/a11y.spec.ts e2e/themes-rhythm.spec.ts`.
4. Lighthouse check (this task changes what is visible in the first second, so Speed Index can move):
   ```powershell
   npm run build
   $env:LHCI_FORM='mobile';  npx --yes @lhci/cli autorun --config=lighthouserc.cjs
   $env:LHCI_FORM='desktop'; npx --yes @lhci/cli autorun --config=lighthouserc.cjs
   ```
   Both must exit 0 (they assert 100 in the four categories, LCP, CLS and TBT). Also open the newest
   `.lighthouseci/lhr-*.json` for `/` on desktop and note `audits['speed-index'].numericValue` in your report.
   Decision rule: if either run fails on performance, or desktop Speed Index is above 900 ms, (a) change `80ms` to
   `50ms` in the first rule and `.8s` to `.6s`, rebuild and re-run; (b) if it still fails, remove
   `.vn-hero__actions > *` and `.vn-hero__strap` from the three selector lists (they cover the most area), re-run;
   (c) if it still fails, revert the task and report the numbers.
5. Ledger row.

**Reduced motion, no JS, touch.** Guarded by `html.js` and the media query, so both get the static hero. On touch
phones the chips and the badge are `display: none` below 720 px (`responsive.css`), so only the strip, strap, grid,
CTAs, frame line and caption animate.

**Bytes.** Home `inlineCss` plus about 230 B gz. No JS.

**Pitfalls.**
1. R3: do not add `.vn-hero-badge__svg` to the list; its `animation: vn-spin` would be replaced.
2. `e2e/hero.spec.ts` ("hero name is a static two-line h1 with no animations") counts animations on `h1` descendants.
   `.vn-hero__dot` is inside the `h1`: never animate it.
3. The CTAs are invisible for up to 0.4 s. That is why the block is under `html.js`: without JS they are visible at
   once. Do not move the rules out of `html.js`.
4. `animation` shorthand is fine here: these are time-based, not scroll-driven (R4 does not apply).
5. If a later task needs a second animation on one of these elements, it must list both names in one declaration
   or animate a child. C9 does the latter for the badge.

**Done when.**
- The two new tests pass, plus the listed specs.
- Both LHCI runs exit 0 on the five URLs.
- Frame capture (manual, 1440 and 390 wide, both themes): at the first frame the name, lead and portrait are fully
  drawn; chips and badge appear after them; at 2 s everything is static.

**Commit.** `feat(hero): opening sequence on the strip, strap, CTAs, chips and badge`

---

## C4. Números rises over About as an arch

**Goal.** The diagonal wedge at the top of `#numeros` becomes a large arch: the section's ink ground comes up as a
dome into the About ground, and the section label is set along the curve. While the section enters, the dome starts
deep and narrow and settles to its resting shape (scroll-driven). This replaces the "Ink tide" clip on `#numeros`.

How it is drawn (R8 forbids painting outside the section): an `aria-hidden` SVG sits at the top of `#numeros`,
inside it. Its path fills everything *outside* a half-ellipse with the colour of the section above (`--w-about`,
defined per theme in `themes.css`), so the section's own ground shows through as the dome.

**Files.** `src/components/home/Numbers.astro`, `src/styles/sections/numbers.css`, `src/styles/fx/handoff.css`,
`e2e/handoffs.spec.ts`, `e2e/themes-rhythm.spec.ts`, this file.

**Do not change.** The wedges of `#quem-sou`, `#expertise`, `#perguntas`; the `u-drift` exit of
`#numeros > .vn-container`; `.vn-stats-hero-grid`'s `u-rise`; `themes.css` (its `#numeros::before` background rule
becomes unused and harmless); section paddings (the arch fits in the existing top padding).

**Steps.**

1. `src/components/home/Numbers.astro`, line 24 today is `<span id="work" class="vn-sr-only"></span>`. Directly after
   it add:
   ```astro
     <svg class="vn-arch" viewBox="0 0 1000 150" aria-hidden="true" focusable="false">
       <path class="vn-arch__fill" d="M0 0H1000V150A500 150 0 0 0 0 150Z" />
       <path id={`arch-curve-${locale}`} d="M60 150A440 132 0 0 1 940 150" fill="none" />
       <text class="vn-arch__text"><textPath href={`#arch-curve-${locale}`} startOffset="50%" text-anchor="middle">{eyebrowTag}</textPath></text>
     </svg>
   ```
   Geometry: the viewBox is 1000 by 150, so the arch is 15% of the section width tall. The first path covers the
   rectangle minus the half-ellipse centred at (500, 150) with radii 500 and 150 (crown at the top centre). The
   second path is a smaller half-ellipse 18 units inside it, left to right over the top; the text sits on it, centred
   at the crown, glyphs pointing outward, inside the dome. `eyebrowTag` already exists in the frontmatter.
2. `src/styles/sections/numbers.css`, lines 126 to 130 today:
   ```css
     #numeros::before {
       top: 0;
       translate: none;
       clip-path: polygon(0 0, 100% 0, 0 100%);
     }
   ```
   become
   ```css
     /* C4: the wedge is replaced by an arch drawn by an inline SVG (Numbers.astro). */
     #numeros::before { content: none; }

     .vn-arch {
       position: absolute;
       inset: 0 0 auto;
       display: block;
       width: 100%;
       height: auto;
       transform-origin: 50% 0;
       pointer-events: none;
     }

     .vn-arch__fill { fill: var(--w-about); }

     .vn-arch__text {
       fill: var(--vn-text-muted);
       font: 500 14px var(--vn-font-mono);
       letter-spacing: .3em;
     }

     @media (max-width: 899px) {
       .vn-arch__text { display: none; } /* 14 viewBox units are under 13px here: unreadable, so not shown */
     }
   ```
3. `src/styles/fx/handoff.css` (the file is one `@supports` block; all edits are inside it).
   - Line 9 today: `#quem-sou, #expertise, #perguntas, .vn-site-footer { view-timeline: --h; }` becomes
     `#quem-sou, #numeros, #expertise, #perguntas, .vn-site-footer { view-timeline: --h; }`.
   - Line 11 today starts `:is(#numeros, #jornada, #servicos, #contato, .vn-stats-hero-grid, .vn-site-footer__inner) {`:
     remove `#numeros, ` from that list.
   - Line 15 today: `#numeros { animation-name: u-tide; }`. Replace it with:
     ```css
     .vn-arch { animation-name: u-arch; animation-timing-function: cubic-bezier(.25, 1, .5, 1); animation-fill-mode: backwards; animation-timeline: --h; animation-range: entry 0% entry 90%; }
     #numeros:focus-within .vn-arch { animation: none; } /* the deep dome covers the head: release it for a focused control (WCAG 2.4.11) */
     ```
   - Line 19 today: `:is(#numeros, #jornada, #servicos, #contato):focus-within { animation: none; }`: remove
     `#numeros, ` from the list.
   - Line 38 today: `@keyframes u-tide { ... }`. Replace the whole line with
     `@keyframes u-arch { from { scale: 1 2.2; } }`.
4. `e2e/handoffs.spec.ts`.
   - Test "2 Ink tide: #numeros clip opens, grid rises": rename it to
     "2 Arch rise: the dome over About settles, grid rises" and replace its first seven lines (from
     `const c0 = ...` to `expect(c1).not.toBe(c5);`) with:
     ```ts
     const a0 = await at(page, '#numeros', 'entry', 0.02, 'scale', undefined, '.vn-arch');
     const a5 = await at(page, '#numeros', 'entry', 0.45, 'scale', undefined, '.vn-arch');
     const a1 = await at(page, '#numeros', 'entry', 1, 'scale', undefined, '.vn-arch');
     expect(num(a0, 1)).toBeGreaterThan(1.8); // "1 2.2" at the start of the entry
     expect(num(a5, 1)).toBeLessThan(num(a0, 1));
     expect(num(a5, 1)).toBeGreaterThan(1);
     rest(a1);
     ```
     Keep the `g0` / `g1` lines about `.vn-stats-hero-grid` as they are.
   - Test "focus inside a clipped section releases the clip": replace the three occurrences of `#numeros` with
     `#servicos` (it keeps a clip-path entry and a `:focus-within` release).
   - Test "every hand-off resolves to a named animation on a Scroll/View timeline": in the `sels` array replace
     `'#numeros'` (the bare one, not `'#numeros > .vn-container'`) with `'.vn-arch'`.
   - The describe "handoffs, no timelines" needs no edit (`#numeros` clip-path is `none` there, as before).
5. `e2e/themes-rhythm.spec.ts`.
   - Line with `const WEDGES: [Key, Key][] = [['about', 'hero'], ['numbers', 'about'], ['expertise', 'numbers'], ['faq', 'services']];`:
     remove `['numbers', 'about'], `.
   - In the test `chapter wedges match the ground (${theme})`, after the `for` loop add:
     ```ts
     // Numbers has an arch instead of a wedge: its mask is filled with About's ground
     await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.vn-arch__fill')!).fill)).toBe(EXPECTED[theme].about);
     ```
6. Add a test at the end of `e2e/sections.spec.ts`:
   ```ts
   for (const route of ['/', '/en/']) {
     test(`${route} Numbers arch: decorative, full width, inside the section, label on the curve`, async ({ page }) => {
       await page.setViewportSize({ width: 1440, height: 900 });
       await page.goto(route);
       await page.locator('#numeros').scrollIntoViewIfNeeded();
       const m = await page.evaluate(() => {
         const s = document.querySelector('#numeros')!.getBoundingClientRect();
         const a = document.querySelector('.vn-arch')!;
         const r = a.getBoundingClientRect();
         const eb = document.querySelector('#numeros .vn-eyebrow')!;
         return {
           hidden: a.getAttribute('aria-hidden'), w: r.width / s.width, ratio: r.height / r.width,
           before: getComputedStyle(document.querySelector('#numeros')!, '::before').content,
           label: a.querySelector('textPath')!.textContent, tag: eb.textContent!.replace(/[\[\]—\d\s]+/g, ' ').trim(),
         };
       });
       expect(m.hidden).toBe('true');
       expect(m.w).toBeCloseTo(1, 2);
       expect(m.ratio).toBeCloseTo(0.15, 2);
       expect(m.before).toBe('none');
       expect(m.tag).toContain(m.label!.trim());
       await page.setViewportSize({ width: 390, height: 800 });
       await expect(page.locator('.vn-arch__text')).toBeHidden();
     });
   }
   ```
   (The eyebrow's visible text is `[ 02 — TAG ]`; stripping brackets, dash, digits and spaces leaves the tag.)
7. Gate; `npx playwright test e2e/handoffs.spec.ts e2e/themes-rhythm.spec.ts e2e/sections.spec.ts
   e2e/header-ground.spec.ts e2e/moments.spec.ts e2e/render-cost.spec.ts e2e/a11y.spec.ts e2e/gates.spec.ts
   e2e/choreography.spec.ts`. Ledger row.

**Reduced motion, no JS, touch.** The arch is static inline CSS and markup: all three get the resting dome. The
scroll-driven settle only exists in the fx sheet (no-preference, timeline support).

**Bytes.** Home HTML plus about 210 B gz (markup) and `inlineCss` plus about 80 B net; `scroll-fx` plus about 30 B.
If home `html=` passes 32500, drop the second `<path>` and the `<text>` (trim 1 under "Budgets") and delete the
`.vn-arch__text` rules and the label assertions of step 6.

**Pitfalls.**
1. Clearance: the mask reaches down `0.564 * 15vw = 8.5vw` at the content's left edge; the section's top padding is
   `clamp(60px, 10vw, 140px)`, so the eyebrow stays clear at every width. If you change the viewBox height, redo
   this sum: the mask depth at horizontal fraction `x` from the centre (0 to 1) is `1 - sqrt(1 - x^2)` of the height.
2. R3: `#numeros` loses its animation in this task, on purpose. `#numeros > .vn-container` keeps `u-drift`.
3. In dark, `#numeros` has an ember `background-image` at its top; the mask covers part of it. That is intended.
4. `check:html` rejects duplicate ids: the curve id carries the locale, like the hero badge's path id.
5. R9: the header reads the section's `background-color`, not the SVG, so the flip to the Numbers ground still
   happens at the section's top edge, while the mask shows About's colour at the corners. That matches the wedge's
   behaviour today.

**Done when.**
- Listed specs green, including the edited ones.
- Manual frames at 1440 and 390, both themes: a clean dome between About and Números, no wedge triangle, label
  readable along the curve at 1440 and absent at 390; while scrolling in, the dome is deeper at first.

**Commit.** `feat(numbers): arch rising over About replaces the diagonal wedge`

---

## C6. About manifesto as a tall centred statement that inks in with scroll

**Goal.** The About headline becomes its own stage: about one viewport tall, centred, set large and tight (Era:
letter-spacing -0.024em, line-height .95), with the second paragraph as a small caption far below it. As the stage
crosses the viewport, the words go from faint to full ink one after another, tied to scroll. The lead paragraph and
the spec list follow in the existing two-column grid.

Contrast-safe inking: the text itself never changes colour or opacity. A veil in the section's ground colour sits
over each word (a pseudo-element) and fades out. Automated contrast checks read the real text colour.

**Files.** `src/components/home/About.astro`, `src/styles/sections/about.css`, `src/styles/fx/text.css`,
`src/scripts/scroll-fx.ts`, `src/styles/sections/render-cost.css` (seeds), `e2e/split-reveal.spec.ts` (new tests),
this file.

**Do not change.** The copy in `src/data/portfolio.ts`; `Words.astro`; the eyebrow; the awards block; the `data-enter`
values (`mask` on the `h2`, `lines` on the first paragraph: `e2e/lines-reveal.spec.ts` depends on both and on the
first paragraph's parent being the `[data-stagger]` element).

**Steps.**

1. `src/components/home/About.astro`, lines 23 to 32 today:
   ```astro
       <div class="vn-about-grid">
         <div>
           <h2 class="vn-type-h1 vn-about-statement" data-enter="mask">
             <Words text={c.about.statementPre} /><Words text={c.about.statementEm1} em /><Words text={c.about.statementMid} /><Words text={c.about.statementEm2} em tail={c.about.statementPost} />
           </h2>
           <div class="vn-about-prose" data-stagger>
             <p class="vn-type-lead" data-enter="lines">{c.about.p1}</p>
             <p class="vn-type-body vn-muted" data-enter>{c.about.p2}</p>
           </div>
         </div>
   ```
   become
   ```astro
       <div class="vn-about-stage">
         <h2 class="vn-type-h1 vn-about-statement" data-enter="mask">
           <Words text={c.about.statementPre} /><Words text={c.about.statementEm1} em /><Words text={c.about.statementMid} /><Words text={c.about.statementEm2} em tail={c.about.statementPost} />
         </h2>
         <p class="vn-type-body-sm vn-muted vn-about-cap" data-enter>{c.about.p2}</p>
       </div>

       <div class="vn-about-grid">
         <div class="vn-about-prose" data-stagger>
           <p class="vn-type-lead" data-enter="lines">{c.about.p1}</p>
         </div>
   ```
   The `<dl class="vn-spec-list" data-stagger>` that follows and the closing `</div>` of the grid stay as they are.
2. `src/styles/sections/about.css`: after the `.vn-about-statement em` rule (ends on line 16) add:
   ```css
     /* C6: the statement has its own stage, about one viewport tall, centred, with a small caption below. */
     .vn-about-stage {
       display: grid;
       align-content: center;
       justify-items: center;
       gap: var(--vn-space-8);
       min-height: min(92svh, 60rem);
       margin-block-end: var(--vn-space-9);
       text-align: center;
     }

     .vn-about-stage .vn-about-statement {
       max-width: 15em;
       margin: 0;
       font-size: clamp(2.5rem, 6.4vw, 6.5rem);
       line-height: .95;
       letter-spacing: -.024em;
     }

     .vn-about-cap { max-width: 38ch; }
   ```
3. `src/styles/fx/text.css`: inside the existing `@supports (animation-timeline: view())` block, inside its
   `@media`, after the `@keyframes vn-hair` line, add:
   ```css
       /* C6: the About statement inks in word by word while its stage crosses the viewport. A veil in the ground
          colour covers each word and fades out; the text keeps its real colour. --w (word index) and --ws (step,
          a percentage) are written by scroll-fx.ts; without them every word inks together. */
       .vn-about-stage { view-timeline: --st block; }
       .vn-about-statement .vn-w { position: relative; }
       .vn-about-statement .vn-w::after {
         content: ""; position: absolute; inset: -.1em -.02em; background: var(--g-bg); opacity: 0; pointer-events: none;
         animation-name: vn-ink; animation-timing-function: linear; animation-fill-mode: both; animation-timeline: --st;
         animation-range: cover calc(16% + var(--w, 0) * var(--ws, 0%)) cover calc(30% + var(--w, 0) * var(--ws, 0%));
       }
       @keyframes vn-ink { from { opacity: .84; } to { opacity: 0; } }
   ```
4. `src/scripts/scroll-fx.ts`: after the line `document.documentElement.dataset.scrollFx = tl ? 'tl' : 'base';`
   (line 21) add:
   ```ts
     // C6: index the words of the About statement for the scroll inking (fx/text.css). 26% of the stage's
     // cover range is shared between the words, so the last one is full ink while the statement is still on screen.
     const st = document.querySelector<HTMLElement>('.vn-about-statement');
     if (st && tl) {
       const ws = st.querySelectorAll<HTMLElement>('.vn-w');
       st.style.setProperty('--ws', `${(26 / Math.max(1, ws.length)).toFixed(2)}%`);
       ws.forEach((w, i) => w.style.setProperty('--w', String(i)));
     }
   ```
5. Seeds (R8): build, run `npx playwright test e2e/render-cost.spec.ts`. It fails for `quem-sou` and prints fresh
   `--ci` values per width; paste them into the six `#quem-sou{--ci:...}` entries of
   `src/styles/sections/render-cost.css` (lines 31 to 36). Re-run until green.
6. Tests, appended to `e2e/split-reveal.spec.ts`:
   ```ts
   test.describe('About statement stage', () => {
     const veil = (page: Page, i: 'first' | 'last') =>
       page.evaluate((k) => {
         const ws = document.querySelectorAll('.vn-about-statement .vn-w');
         return parseFloat(getComputedStyle(ws[k === 'first' ? 0 : ws.length - 1], '::after').opacity);
       }, i);
     // puts the stage at `p` of its view() cover range
     const cover = (page: Page, p: number) =>
       page.evaluate(async (q) => {
         const place = () => {
           const r = document.querySelector('.vn-about-stage')!.getBoundingClientRect();
           scrollTo({ top: scrollY + r.top - innerHeight + q * (innerHeight + r.height), behavior: 'instant' });
         };
         place();
         await new Promise((r) => setTimeout(r, 150));
         place();
         await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
       }, p);

     test('layout: tall, centred, caption below, no overflow', async ({ page }) => {
       for (const [w, h] of [[1440, 900], [390, 844], [320, 640]]) {
         await page.setViewportSize({ width: w, height: h });
         await page.goto('/en/');
         const m = await page.evaluate(() => {
           const s = document.querySelector('.vn-about-stage')!.getBoundingClientRect();
           const t = document.querySelector('.vn-about-statement')!.getBoundingClientRect();
           const c = document.querySelector('.vn-about-cap')!.getBoundingClientRect();
           return { sh: s.height, vh: innerHeight, mid: Math.abs((t.left + t.right) / 2 - innerWidth / 2), capBelow: c.top >= t.bottom, over: document.documentElement.scrollWidth - innerWidth };
         });
         expect(m.sh, `${w}`).toBeGreaterThanOrEqual(Math.min(m.vh * 0.9, 950));
         expect(m.mid, `${w}`).toBeLessThan(12);
         expect(m.capBelow, `${w}`).toBe(true);
         expect(m.over, `${w}`).toBeLessThanOrEqual(0);
       }
     });

     test('words ink in order with scroll and end at full ink', async ({ page }) => {
       await page.setViewportSize({ width: 1440, height: 900 });
       await page.goto('/');
       await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
       await cover(page, 0.08);
       expect(await veil(page, 'first')).toBeGreaterThan(0.8);
       expect(await veil(page, 'last')).toBeGreaterThan(0.8);
       await cover(page, 0.36);
       expect(await veil(page, 'first')).toBe(0);
       expect(await veil(page, 'last')).toBeGreaterThan(0.5);
       await cover(page, 0.6);
       expect(await veil(page, 'last')).toBe(0);
       // the real text never fades
       expect(await page.locator('.vn-about-statement .vn-w').evaluateAll((els) => els.every((e) => getComputedStyle(e).opacity === '1'))).toBe(true);
     });

     test('reduced motion: no veil at all', async ({ browser }) => {
       const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
       const page = await ctx.newPage();
       await page.goto('/');
       await page.waitForTimeout(1200);
       expect(await page.evaluate(() => getComputedStyle(document.querySelector('.vn-about-statement .vn-w')!, '::after').content)).toBe('none');
       await ctx.close();
     });
   });
   ```
   If `Page` is not imported in that file yet, add it to the `@playwright/test` import.
7. Gate; `npx playwright test e2e/split-reveal.spec.ts e2e/lines-reveal.spec.ts e2e/choreography.spec.ts
   e2e/sections.spec.ts e2e/render-cost.spec.ts e2e/gates.spec.ts e2e/a11y.spec.ts e2e/header-ground.spec.ts
   e2e/themes-rhythm.spec.ts`. Ledger row.

**Reduced motion, no JS, touch.** Layout is inline CSS: everyone gets the stage. The veil exists only in the fx sheet
(no-preference and timeline support). Touch gets the inking (it is scroll-driven, no pointer).

**Bytes.** Home `inlineCss` plus about 110 B gz; HTML plus about 40 B; `scroll-fx` plus about 190 B gz
(raise `"scroll-fx"` in `budget.json` to 3584 if the check fails, and update the Budgets table).

**Pitfalls.**
1. Never dim the text itself. An opacity or colour below 3:1 on a visible heading fails axe and Lighthouse
   accessibility, including when the heading is below the fold.
2. The veil uses `--g-bg`, set per theme on `#quem-sou` in `themes.css`. If the stage is ever moved out of
   `#quem-sou`, the veil turns transparent (no inking, no harm).
3. B1 fades and scales the words on entry; the veil is a child of the word and moves with it. Order of events at a
   normal scroll speed: the lines rise (B1) at 10% into the viewport while still veiled, then the inking runs.
4. R3: the `h2` and its words carry transitions (entrance), not animations; the veil's animation is on `::after`.
5. `min(92svh, 60rem)` depends on the viewport height; the seeds are measured at 800. Keep the 60rem cap so tall
   screens stay inside the 15% tolerance.
6. The first paragraph must stay a child of `.vn-about-prose[data-stagger]`.

**Done when.** Listed specs green; seeds updated; manual frames at 1440 and 390 in both themes show the statement
centred with words darkening left to right, top to bottom, as you scroll, and fully dark before it reaches the top
third.

**Commit.** `feat(about): centred statement stage that inks in word by word with scroll`

---

## C8. Edge-fill hover on outline buttons

**Goal.** Outline buttons (`.vn-btn--secondary`: hero "projects" ghost, service CTAs, contact secondary buttons,
drawer and 404 buttons) fill from the left edge over 0.8 s with the in-out curve while the label flips colour; on
leave the fill exits to the right. Same on keyboard focus. Where there is no hover or under reduced motion, the
existing instant colour swap stays.

**Files.** `src/styles/late/hover.css` (append), `e2e/chrome-fx.spec.ts` (new test), `budget.json` only if `late`
passes its cap, this file. Needs A5 and C7.

**Do not change.** Brand CSS; `.vn-btn--primary`, `.vn-btn--signal`, `.vn-btn--ghost`; the `.vn-arc` rules; the four
hover-colour rules at the top of `hover.css` (they remain the fallback).

**Steps.**

1. Append to `src/styles/late/hover.css`:
   ```css
   /* C8 edge fill (Era): outline buttons fill from the left edge, the label flips colour, the fill leaves to the
      right. --fill / --fill-fg default to the brand's inverse pair. Must stay after the hover-colour rules above:
      same specificity, later wins. */
   @media (hover: hover) and (prefers-reduced-motion: no-preference) {
     .vn-btn--secondary { position: relative; isolation: isolate; overflow: clip; }
     .vn-btn--secondary::before {
       content: ""; position: absolute; inset: -1px; z-index: -1;
       background: var(--fill, var(--vn-surface-inverse));
       transform: scaleX(0); transform-origin: 100% 50%;
       transition: transform .8s var(--vn-ease-in-out);
     }
     .vn-btn--secondary:is(:hover, :focus-visible):not(:disabled)::before { transform: scaleX(1); transform-origin: 0 50%; }
     .vn-btn--secondary:is(:hover, :focus-visible):not(:disabled) {
       background-color: transparent;
       border-color: var(--fill, var(--vn-surface-inverse));
       color: var(--fill-fg, var(--vn-text-on-inverse));
     }
     .vn-hero-btn-ghost { --fill: var(--hero-btn-fg); --fill-fg: var(--g-bg); }
     .vn-contact-secondary { --fill: var(--vn-ink); --fill-fg: var(--vn-cream); }
   }
   ```
2. Test, in `e2e/chrome-fx.spec.ts` inside the describe:
   ```ts
   test('outline buttons fill from the edge on hover and on keyboard focus', async ({ page }) => {
     await page.setViewportSize({ width: 1366, height: 800 });
     await page.goto('/');
     await page.waitForFunction(() => 'late' in document.documentElement.dataset);
     const btn = page.locator('.vn-hero-btn-ghost');
     const fill = () => btn.evaluate((e) => new DOMMatrix(getComputedStyle(e, '::before').transform).a);
     const color = () => btn.evaluate((e) => getComputedStyle(e).color);
     expect(await fill()).toBe(0);
     const rest = await color();
     await btn.hover();
     await expect.poll(fill, { timeout: 3000 }).toBe(1);
     await expect(btn).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
     await expect.poll(color).not.toBe(rest);
     await page.mouse.move(5, 5);
     await expect.poll(fill, { timeout: 3000 }).toBe(0);
     // keyboard parity
     for (let i = 0; i < 20; i++) {
       await page.keyboard.press('Tab');
       if (await page.evaluate(() => document.activeElement?.classList.contains('vn-hero-btn-ghost'))) break;
     }
     await expect.poll(fill, { timeout: 3000 }).toBe(1);
   });

   test('outline buttons keep the instant colour swap under reduced motion', async ({ page }) => {
     await page.emulateMedia({ reducedMotion: 'reduce' });
     await page.setViewportSize({ width: 1366, height: 800 });
     await page.goto('/');
     await page.waitForFunction(() => 'late' in document.documentElement.dataset);
     const btn = page.locator('.vn-hero-btn-ghost');
     expect(await btn.evaluate((e) => getComputedStyle(e, '::before').content)).toBe('none');
     await btn.hover();
     await expect.poll(() => btn.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
   });
   ```
3. Gate; `npx playwright test e2e/chrome-fx.spec.ts e2e/services-arc.spec.ts e2e/magnetic.spec.ts e2e/cursor.spec.ts
   e2e/signal-field.spec.ts e2e/gates.spec.ts e2e/a11y.spec.ts`. Ledger row.

**Reduced motion, no JS, touch.** The block is inside `(hover: hover) and (prefers-reduced-motion: no-preference)`.
Otherwise the A5 colour rules or the brand's hover apply. Without JS the brand hover applies.

**Bytes.** `late` plus about 170 B gz. Nothing inline.

**Pitfalls.**
1. `magnetic.ts` writes an inline `transition` on `[data-magnetic]` buttons, which wins over any `transition` you add
   to the button itself. That is why this spec adds no `transition` to the button: the colour flip uses the brand
   transition (0.4 s after C7). The fill's transition is on `::before`, which the inline style does not touch.
2. `overflow: clip` does not clip the focus outline (outlines are outside the box). Check `e2e/gates.spec.ts`
   target-size and focus tests still pass.
3. `isolation: isolate` plus `z-index: -1` keeps the fill above the button's own (transparent) background and under
   its label and icon. Without `isolation` the fill would slide under the section.
4. For about 0.3 s the label colour and the fill are out of step (label already flipped over the unfilled part).
   Era has the same. Do not try to fix it with `mix-blend-mode`: it breaks on the red contact band.

**Done when.** Both tests pass; listed specs green; manual check at 1440: hero "projects" button, a service CTA and
"WhatsApp" in the contact band fill left to right and empty to the right.

**Commit.** `feat(buttons): edge-fill hover on outline buttons`

---

## C5. Scroll rail with a live percentage

**Goal.** On wide screens the home page gets a rail on the left edge: a two-digit scroll percentage (00 to 99), a
hairline that fills downward, and a vertical "SCROLL ↓" cue. It is pure CSS (scroll timeline plus a registered
integer property driving a CSS counter), so scrolling costs no script. It replaces the 3 px top bar there. The top
bar stays on narrow screens, on other pages, without scroll timelines, and under reduced motion.

**Files.** `src/layouts/Base.astro`, new `src/styles/late/rail.css`, `src/scripts/late.ts`, new `e2e/rail.spec.ts`,
this file. Needs A5.

**Do not change.** `src/scripts/progress.ts`; the `.vn-scroll-progress` rules in `chrome.css`; `nav.ts`.

**Steps.**

1. `src/layouts/Base.astro`, line 169 today:
   ```astro
     <div class="vn-scroll-progress" id="vn-scroll-progress" aria-hidden="true"></div>
   ```
   Put directly **before** it (the CSS uses the adjacent-sibling order):
   ```astro
     {isHome && (
       <div class="vn-rail" aria-hidden="true" hidden>
         <span class="vn-rail__n"></span>
         <span class="vn-rail__line"><i></i></span>
         <span class="vn-rail__cue">Scroll ↓</span>
       </div>
     )}
   ```
   `hidden` keeps it out of the page until the late sheet shows it; without JS it never shows. `isHome` already
   exists in the frontmatter (line 45).
2. Create `src/styles/late/rail.css`:
   ```css
   /* late/rail.css: adopted on idle by late.ts into @layer site. C5 scroll rail (home, wide screens, scroll
      timelines, motion allowed). Longhand animation properties only (see R4 in docs/AWWWARDS-PLAN.md). */
   @media (min-width: 1200px) and (prefers-reduced-motion: no-preference) {
     @supports (animation-timeline: scroll()) {
       .vn-rail + .vn-scroll-progress { display: none; }
       .vn-rail {
         position: fixed; left: 14px; top: 50%; translate: 0 -50%; z-index: calc(var(--vn-z-nav) - 1);
         display: flex; flex-direction: column; align-items: center; gap: 12px;
         color: #fff; mix-blend-mode: difference; pointer-events: none;
         font: 500 11px/1 var(--vn-font-mono); letter-spacing: .2em;
         animation-name: vn-rail-o; animation-timing-function: linear; animation-fill-mode: both; animation-timeline: scroll(root);
       }
       .vn-rail__n { counter-reset: p var(--vn-p); animation-name: vn-rail-n; animation-timing-function: linear; animation-fill-mode: both; animation-timeline: scroll(root); }
       .vn-rail__n::after { content: counter(p, decimal-leading-zero); }
       .vn-rail__line { width: 1px; height: 96px; background: rgb(255 255 255 / .3); }
       .vn-rail__line i { display: block; width: 100%; height: 100%; background: #fff; transform-origin: 50% 0; animation-name: vn-rail-l; animation-timing-function: linear; animation-fill-mode: both; animation-timeline: scroll(root); }
       .vn-rail__cue { writing-mode: vertical-rl; text-transform: uppercase; }
       @keyframes vn-rail-n { to { --vn-p: 99; } }
       @keyframes vn-rail-l { from { scale: 1 0; } }
       /* the rail leaves before its middle reaches the red contact band (difference blending would turn it cyan) */
       @keyframes vn-rail-o { 0%, 82% { opacity: 1; } 89%, 100% { opacity: 0; } }
     }
   }
   ```
3. `src/scripts/late.ts`: import the file and register the integer property. The file becomes:
   ```ts
   import hover from '../styles/late/hover.css?inline';
   import rail from '../styles/late/rail.css?inline';

   export function init(): void {
     try {
       // --vn-p drives the rail's CSS counter; it must be a registered integer to interpolate.
       try {
         CSS.registerProperty({ name: '--vn-p', syntax: '<integer>', inherits: false, initialValue: '0' });
       } catch {
         /* already registered, or no Houdini: the number then jumps from 00 to 99 halfway, the line still fills */
       }
       const sh = new CSSStyleSheet();
       sh.replaceSync(`@layer site{${hover}${rail}}`);
       document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
       document.documentElement.dataset.late = '';
     } catch {
       /* no constructable stylesheets: the page keeps its inline styles */
     }
   }
   ```
   (Keep any import a previous task added; only add `rail`.)
4. Create `e2e/rail.spec.ts`:
   ```ts
   import { test, expect, type Page } from '@playwright/test';

   const late = (page: Page) => page.waitForFunction(() => 'late' in document.documentElement.dataset);
   const pct = (page: Page) => page.evaluate(() => Number(getComputedStyle(document.querySelector('.vn-rail__n')!).getPropertyValue('--vn-p')));
   const to = (page: Page, f: number) =>
     page.evaluate(async (q) => {
       scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * q, behavior: 'instant' });
       await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
     }, f);

   test.describe('scroll rail', () => {
     for (const route of ['/', '/en/']) {
       test(`wide screen ${route}: rail replaces the top bar and counts with scroll`, async ({ page }) => {
         await page.setViewportSize({ width: 1440, height: 900 });
         await page.goto(route);
         await late(page);
         const rail = page.locator('.vn-rail');
         await expect(rail).toBeVisible();
         await expect(rail).toHaveAttribute('aria-hidden', 'true');
         await expect(page.locator('#vn-scroll-progress')).toBeHidden();
         expect(await pct(page)).toBe(0);
         await to(page, 0.5);
         expect(await pct(page)).toBeGreaterThanOrEqual(48);
         expect(await pct(page)).toBeLessThanOrEqual(51);
         const line = await page.locator('.vn-rail__line i').evaluate((e) => parseFloat(getComputedStyle(e).scale.split(' ')[1] ?? '1'));
         expect(line).toBeGreaterThan(0.45);
         expect(line).toBeLessThan(0.55);
         // gone before the red band reaches the rail
         await page.evaluate(async () => {
           const r = document.querySelector('#contato')!.getBoundingClientRect();
           scrollTo({ top: scrollY + r.top - innerHeight / 2, behavior: 'instant' });
           await new Promise((res) => setTimeout(res, 200));
           const r2 = document.querySelector('#contato')!.getBoundingClientRect();
           scrollTo({ top: scrollY + r2.top - innerHeight / 2, behavior: 'instant' });
           await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
         });
         expect(Number(await rail.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThanOrEqual(0.05);
         expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
       });
     }

     test('narrow screen: no rail, the top bar works', async ({ page }) => {
       await page.setViewportSize({ width: 390, height: 844 });
       await page.goto('/');
       await late(page);
       await expect(page.locator('.vn-rail')).toBeHidden();
       await expect(page.locator('#vn-scroll-progress')).toBeVisible();
       await to(page, 0.5);
       const sx = await page.locator('#vn-scroll-progress').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
       expect(sx).toBeGreaterThan(0.4);
     });

     test('reduced motion: no rail', async ({ page }) => {
       await page.emulateMedia({ reducedMotion: 'reduce' });
       await page.setViewportSize({ width: 1440, height: 900 });
       await page.goto('/');
       await late(page);
       await expect(page.locator('.vn-rail')).toBeHidden();
       await expect(page.locator('#vn-scroll-progress')).toBeVisible();
     });

     test('other pages have no rail element', async ({ page }) => {
       await page.goto('/projetos/caato/');
       await expect(page.locator('.vn-rail')).toHaveCount(0);
       await page.goto('/privacidade/');
       await expect(page.locator('.vn-rail')).toHaveCount(0);
     });

     test('no JS: the rail stays hidden', async ({ browser }) => {
       const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
       const page = await ctx.newPage();
       await page.goto('/');
       await expect(page.locator('.vn-rail')).toBeHidden();
       await ctx.close();
     });
   });
   ```
5. Tuning rule for the fade: if the "gone before the red band" assertion fails, lower both percentages in
   `vn-rail-o` by the same amount (keep 7 points between them) until it passes on `/` and `/en/`. Re-check after C3
   and D1 land, because both make the page taller (their specs remind you).
6. Gate; `npx playwright test e2e/rail.spec.ts e2e/gates.spec.ts e2e/a11y.spec.ts e2e/interactions.spec.ts
   e2e/header-ground.spec.ts`. Ledger row.

**Reduced motion, no JS, touch.** Reduced motion: media query off, top bar as today. No JS: `hidden` attribute.
Touch phones: below 1200 px, top bar. A touch tablet in landscape above 1200 px gets the rail (no pointer needed).

**Bytes.** Home HTML plus about 110 B gz; `late` plus about 330 B gz; nothing inline.

**Pitfalls.**
1. R4 applies: longhands, no duration. The late sheet goes through the same minifier as the fx sheet.
2. `@property` is deliberately not used in the CSS file (its validity inside `@layer` is not uniform); the property is
   registered from script instead.
3. The rail appears when the late sheet is adopted (after idle). It is `position: fixed` and tiny, so it causes no
   layout shift; do not move its CSS inline to "fix" the late appearance.
4. `mix-blend-mode: difference` with white gives near-black on paper and creme, white on ink. On red it would give
   cyan, hence the fade-out and the home-only markup (case pages end with a red band that sits high on the page).
5. R9: the rail is not a section; the header flip ignores it.

**Done when.** `e2e/rail.spec.ts` green; listed specs green; manual frame at 1440: rail at the left edge reading
`00` at the top and about `50` mid-page, top bar absent; at 390 the top bar is there.

**Commit.** `feat(chrome): scroll rail with live percentage on wide screens`

---

## B2a. Cursor label pill with a 0.45 s expo-out lag

**Goal.** lamalama's label follows the pointer with `quickTo` over 0.45 s, `expo.out`: it lags and arrives without
overshoot. Ours hangs on a damped spring that overshoots. Replace the spring with an exponential follow whose time
constant matches that curve: `1 - 2^(-10 t / 0.45)` is `1 - e^(-t / tau)` with `tau = 0.45 / (10 ln 2) = 65 ms`.

**Files.** `src/scripts/cursor.ts`, `e2e/cursor.spec.ts` (one new test), this file.

**Do not change.** The state machine, the zones, the decode effect, the CSS string, the dot's `TAU_DOT_MS`, the
`SPRING` easing constant (it is a CSS curve used for scale pops, not the follow), `cursor.css`.

**Steps.**

1. `src/scripts/cursor.ts`, lines 8 and 9 today:
   ```ts
   const SPRING_K = 420; // pill/media spring stiffness (1/s^2)
   const SPRING_C = 25; // damping (1/s): a little overshoot, no wobble
   ```
   become
   ```ts
   const TAU_PILL_MS = 65; // pill/media follow: the time constant of a 0.45s expo-out (lamalama's quickTo)
   ```
2. Lines 86 to 92 today:
   ```ts
       // pill: damped spring, integrated in two half steps for stability on long frames
       for (let i = 0, h = ms / 2000; i < 2; i++) {
         vx += (SPRING_K * (tx - px) - SPRING_C * vx) * h;
         vy += (SPRING_K * (ty - py) - SPRING_C * vy) * h;
         px += vx * h;
         py += vy * h;
       }
   ```
   become
   ```ts
       // pill: exponential follow (lags, never overshoots); vx/vy are kept for the tilt and the settle test
       const b = 1 - Math.exp(-ms / TAU_PILL_MS);
       const qx = px;
       const qy = py;
       px += (tx - px) * b;
       py += (ty - py) * b;
       vx = ms ? ((px - qx) / ms) * 1000 : 0;
       vy = ms ? ((py - qy) / ms) * 1000 : 0;
   ```
   Also update the header comment on lines 4 and 5 ("hang on a damped spring above it (they lag, overshoot and
   tilt)") to "follow it with an exponential lag (they trail and tilt, never overshoot)".
3. Test, in `e2e/cursor.spec.ts` inside `test.describe('cursor: state machine', ...)`, after "a data-cursor-label
   element shows the pill". Read the top of that spec first and reuse its helper that loads the cursor (the tests
   there move the mouse twice and wait for `.vn-cursor`); the body is:
   ```ts
   test('the pill trails the pointer and arrives without overshoot', async ({ page }) => {
     await page.setViewportSize({ width: 1366, height: 800 });
     await page.goto('/');
     await page.mouse.move(300, 400);
     await page.mouse.move(320, 400);
     await expect(page.locator('.vn-cursor')).toBeAttached();
     await page.waitForTimeout(700); // settle at x = 320
     const xs = await page.evaluate(async () => {
       const pill = document.querySelector<HTMLElement>('.vn-cursor__pill')!;
       const out: number[] = [];
       // one jump, dispatched on an element (the handler calls closest() on the event target, so not on document)
       document.body.dispatchEvent(new PointerEvent('pointermove', { clientX: 720, clientY: 400, bubbles: true, pointerType: 'mouse' }));
       const t0 = performance.now();
       while (performance.now() - t0 < 900) {
         await new Promise((r) => requestAnimationFrame(r));
         out.push(parseFloat(pill.style.translate));
       }
       return out;
     });
     expect(xs[2]).toBeLessThan(700);                    // it lags at first
     expect(Math.max(...xs)).toBeLessThanOrEqual(720.5); // never past the target
     expect(xs.at(-1)!).toBeGreaterThan(719);            // and it arrives
   });
   ```
4. Gate; `npx playwright test e2e/cursor.spec.ts e2e/cursor-zones.spec.ts e2e/magnetic.spec.ts`. Ledger row.

**Reduced motion, no JS, touch.** Unchanged: the chunk is not loaded in any of them.

**Bytes.** `cursor` shrinks by 30 to 60 B gz (cap 3072 stays; the chunk is at 3035, so check it).

**Pitfalls.**
1. `vx` and `vy` are still read by the tilt (`TILT`) and by the "live" test near line 98. Keep them updated as in
   the snippet, or the loop never stops.
2. The pointermove listener is on `document`; the test dispatches one synthetic event on `document.body`, which
   bubbles to it. `page.mouse.move` with `steps` would feed intermediate targets and hide the lag.

**Done when.** New test green, cursor specs green, `check:budget` shows `cursor` under 3072.

**Commit.** `feat(cursor): label pill follows with a 0.45s expo-out lag`

---

## D5. Numbers roll like a counter

**Goal.** Every figure in Números rolls into place digit by digit, like an odometer: the four big stats ("8+",
"40+", "11", "5") and the eight impact metrics ("+76%", "−4,5%", "13+"...). Today only plain integers count up and
the decimals are skipped. The real text never changes; an `aria-hidden` overlay carries the reels and is removed at
the end. Also: each stat label gets a hairline above it so the four labels align on one rule.

**Files.** `src/scripts/count.ts` (rewrite), `src/components/home/Numbers.astro`, `src/styles/sections/numbers.css`,
`budget.json`, `e2e/choreography.spec.ts` (one new test), this file.

**Do not change.** How `count.ts` is loaded (`main.ts`, on idle, when `#numeros` is within one viewport, not under
reduced motion); the `.is-counting` and `.vn-count` rules in `numbers.css` (lines 31 and 32); the values in
`portfolio.ts`.

**Steps.**

1. `src/components/home/Numbers.astro`, line 45 today:
   ```astro
               <span class="vn-impact-card__metric">{imp.metric}</span>
   ```
   becomes
   ```astro
               <span class="vn-impact-card__metric" data-count>{imp.metric}</span>
   ```
2. Replace the whole of `src/scripts/count.ts` with:
   ```ts
   // D5: the [data-count] figures roll in like an odometer once they are on screen. The real text never changes
   // (screen readers and layout keep the final value); an aria-hidden overlay holds one reel per digit and is
   // removed when the reels stop. Each reel is 0-9 twice, so every digit travels at least one full turn.
   const STYLE =
     '[data-count]{position:relative}' +
     '.vn-od{display:inline-block;height:1lh;vertical-align:bottom;clip-path:inset(0 -.25em)}' +
     '.vn-od>span{display:block;transition:transform 1.6s cubic-bezier(.25,1,.5,1);transition-delay:calc(var(--c)*70ms)}' +
     '.vn-od i{display:block;height:1lh;font-style:inherit}';

   export function init(root: Element): void {
     try {
       const sh = new CSSStyleSheet();
       sh.replaceSync(STYLE);
       document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh];
     } catch {
       return; // no constructable stylesheets: the figures simply stay as they are
     }
     const io = new IntersectionObserver((entries) => {
       for (const { isIntersecting, target } of entries) {
         if (!isIntersecting) continue;
         io.unobserve(target);
         const txt = (target.textContent ?? '').trim();
         if (!/\d/.test(txt) || txt.length > 8) continue; // words and long strings are left alone
         const ghost = document.createElement('span');
         ghost.className = 'vn-count';
         ghost.setAttribute('aria-hidden', 'true');
         const reels: HTMLElement[] = [];
         for (const ch of txt) {
           if (ch < '0' || ch > '9') {
             ghost.append(ch);
             continue;
           }
           const od = document.createElement('span');
           od.className = 'vn-od';
           const reel = document.createElement('span');
           reel.style.setProperty('--c', String(reels.length));
           reel.dataset.to = ch;
           for (let k = 0; k < 20; k++) {
             const d = document.createElement('i');
             d.textContent = String(k % 10);
             reel.append(d);
           }
           od.append(reel);
           ghost.append(od);
           reels.push(reel);
         }
         target.append(ghost);
         target.classList.add('is-counting');
         // two frames, so the reels are painted at 0 before they are sent to their digit
         requestAnimationFrame(() =>
           requestAnimationFrame(() => {
             for (const r of reels) r.style.transform = `translateY(-${(10 + Number(r.dataset.to)) * 5}%)`;
           }),
         );
         setTimeout(() => {
           ghost.remove();
           target.classList.remove('is-counting');
         }, 1600 + reels.length * 70 + 150);
       }
     }, { rootMargin: '0px 0px -10% 0px' });
     root.querySelectorAll('[data-count]').forEach((el) => io.observe(el));
   }
   ```
3. `src/styles/sections/numbers.css`, the `.vn-stat-hero__lbl` rule (lines 34 to 36 today):
   ```css
     .vn-stat-hero__lbl {
       color: var(--vn-ref-sand-500);
     }
   ```
   becomes
   ```css
     .vn-stat-hero__lbl {
       color: var(--vn-ref-sand-500);
       padding-block-start: var(--vn-space-3);
       border-block-start: 1px solid var(--vn-line-on-dark);
     }
   ```
   and in the `.vn-stat-hero` rule (lines 20 to 23) add `align-content: start;` so labels of different length keep
   their rule at the same height.
4. `budget.json`: add `"count": 1024` to `lazyChunks`.
5. Test, in `e2e/choreography.spec.ts` after "stats count up on an aria-hidden overlay; the real number never
   changes" (that test must keep passing unchanged):
   ```ts
   test('impact metrics roll digit by digit, decimals and signs included', async ({ page }) => {
     await page.setViewportSize({ width: 1366, height: 900 });
     await page.goto('/');
     await settle(page);
     const all = page.locator('#numeros .vn-impact-card__metric[data-count]');
     await expect(all).toHaveCount(8);
     const el = all.filter({ hasText: '4,5' });
     const finalText = (await el.evaluate((e) => e.firstChild!.textContent))!.trim();
     await el.scrollIntoViewIfNeeded();
     const ghost = el.locator('.vn-count');
     await expect(ghost).toHaveAttribute('aria-hidden', 'true');
     await expect(ghost.locator('.vn-od')).toHaveCount(2); // 4 and 5; the sign, comma and % are plain text
     await expect.poll(() => ghost.locator('.vn-od > span').first().evaluate((e) => (e as HTMLElement).style.transform)).toBe('translateY(-70%)');
     expect(await el.evaluate((e) => e.firstChild!.textContent!.trim())).toBe(finalText);
     await expect(ghost).toHaveCount(0, { timeout: 5000 });
     await expect(el).toHaveText(finalText);
   });
   ```
6. Gate; `npx playwright test e2e/choreography.spec.ts e2e/moments.spec.ts e2e/render-cost.spec.ts
   e2e/hover-fx.spec.ts e2e/a11y.spec.ts e2e/gates.spec.ts`. If `render-cost` prints new seeds for `numeros`, paste
   them. Ledger row.

**Reduced motion, no JS, touch.** The chunk is never requested under reduced motion (`choreography.spec.ts` has a
test for it) and cannot run without JS: figures are static text. Touch gets the roll.

**Bytes.** `count` from about 475 to about 800 B gz; `inlineCss` plus about 45 B; HTML plus about 40 B.

**Pitfalls.**
1. `1lh` (one line-height) needs Chrome 109, Safari 16.4, Firefox 120. Older browsers ignore the `height`
   declarations and show all twenty digits stacked for 1.6 s inside an absolutely positioned overlay; acceptable,
   but do not replace `lh` with `em` (the display face has a line-height below 1 and digits would be cut).
2. `clip-path: inset(0 -.25em)` clips the reel vertically but lets the italic overhang out sideways. `overflow`
   would cut the slanted glyphs.
3. The overlay is `position: absolute; inset: 0` (existing `.vn-count` rule), so its host must be positioned: the
   adopted sheet sets `position: relative` on every `[data-count]`. Both hosts are grid items, so they are blocks.
4. `hover-fx.ts` puts a spotlight `::after` on `.vn-impact-card` (the card, not the metric). No overlap.
5. The first child of the host must remain the real text node; the existing test reads `firstChild.textContent`.
   Always `append` the overlay, never `prepend`.

**Done when.** Both count tests green; listed specs green; `check:budget` passes with `count` capped; manual frame:
scrolling into Números, digits spin and stop left to right, "−4,5%" keeps its sign and comma still.

**Commit.** `feat(numbers): odometer roll for stats and impact metrics, ruled stat labels`

---

## D1. Footer closing moment: wordmark and Palmas time

**Goal.** The page ends on a full-width "voaneves." wordmark (italic display face, red dot) that rises through a
mask as the footer scrolls in, and the footer row gains "Palmas, TO · 14:32", the live local time in Palmas
(time zone `America/Araguaina`, UTC−3). Both are extras: without JS the wordmark is absent and the time reads
"UTC−3".

**Files.** `src/layouts/Base.astro`, new `src/styles/late/footer.css`, `src/scripts/late.ts`,
`src/styles/fx/handoff.css`, new `e2e/footer.spec.ts`, this file. Needs A5.

**Do not change.** The existing footer links and credit; `.vn-site-footer__inner`'s `u-rise` animation; `footer.css`
(inline).

**Steps.**

1. `src/layouts/Base.astro`, footer (lines 255 to 266 today). Line 256 is
   `<div class="vn-container vn-site-footer__inner">`. Directly **before** it add:
   ```astro
       <p class="vn-foot-mark" aria-hidden="true" hidden><span>voaneves<i>.</i></span></p>
   ```
   Then, inside `.vn-site-footer__inner`, between the credit `<div data-enter="left">...</div>` (line 257) and
   `<div class="vn-site-footer__links" data-enter="right">` (line 258), add:
   ```astro
         <p class="vn-type-micro vn-foot-time" data-enter><span>Palmas, TO</span> · <span data-vn-clock>UTC−3</span></p>
   ```
2. Create `src/styles/late/footer.css`:
   ```css
   /* late/footer.css: adopted on idle by late.ts into @layer site. D1 footer wordmark (shown only once this sheet
      is in: the element carries the hidden attribute). */
   .vn-foot-mark {
     display: block;
     margin: 0 0 var(--vn-space-7);
     padding-block: .06em .14em; /* room for the italic's ascenders and descenders inside the clip */
     overflow: clip;
     text-align: center;
     white-space: nowrap;
     font: italic 900 clamp(4rem, 20.5vw, 24rem) / .8 var(--vn-font-display);
     font-variation-settings: "opsz" 144, "WONK" 1;
     letter-spacing: -.045em;
     color: var(--vn-text);
   }
   .vn-foot-mark span { display: inline-block; }
   .vn-foot-mark i { font-style: inherit; color: var(--vn-signal-ink); }
   ```
3. Size rule: build, open `/` at 1440 px wide, and in the console run
   `document.querySelector('.vn-foot-mark span').getBoundingClientRect().width / innerWidth` after the web fonts
   are in (`document.documentElement.classList.contains('vn-fonts')`). The target is 0.92 to 0.98. If it is outside,
   replace `20.5vw` with `20.5 * 0.95 / ratio` (two decimals) and re-check at 1440 and at 390.
4. `src/scripts/late.ts`: add `import footer from '../styles/late/footer.css?inline';`, append `${footer}` inside the
   `replaceSync` template string, and after `document.documentElement.dataset.late = '';` add:
   ```ts
       // D1: Palmas local time in the footer (the static "UTC−3" stays if the time zone is unknown)
       const clock = document.querySelector<HTMLElement>('[data-vn-clock]');
       if (clock) {
         try {
           const f = new Intl.DateTimeFormat(document.documentElement.lang, { timeZone: 'America/Araguaina', hour: '2-digit', minute: '2-digit', hour12: false });
           const tick = () => { clock.textContent = f.format(new Date()); };
           tick();
           setInterval(tick, 30_000);
         } catch {
           /* keep the static offset */
         }
       }
   ```
5. `src/styles/fx/handoff.css`, inside the block, after the line that starts `.vn-site-footer__inner { --r: 4rem;`
   (line 22 today) add:
   ```css
       /* D1: the footer wordmark rises through its own clip while the footer scrolls in (--h is the footer's timeline). */
       .vn-foot-mark span { animation-name: u-mark; animation-timing-function: cubic-bezier(.25, 1, .5, 1); animation-fill-mode: backwards; animation-timeline: --h; animation-range: entry 0% entry 100%; }
   ```
   and next to the other keyframes add `@keyframes u-mark { from { translate: 0 72%; } }`.
6. Create `e2e/footer.spec.ts`:
   ```ts
   import { test, expect, type Page } from '@playwright/test';

   const late = (page: Page) => page.waitForFunction(() => 'late' in document.documentElement.dataset);
   const bottom = (page: Page) =>
     page.evaluate(async () => {
       for (let i = 0; i < 3; i++) {
         scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
         await new Promise((r) => setTimeout(r, 200));
       }
     });

   test.describe('footer closing moment', () => {
     for (const [route, w] of [['/', 1440], ['/en/', 1440], ['/', 390], ['/projetos/caato/', 1366], ['/', 320]] as const) {
       test(`wordmark spans the page and never overflows ${route} @${w}`, async ({ page }) => {
         await page.setViewportSize({ width: w, height: 900 });
         await page.goto(route);
         await late(page);
         await bottom(page);
         const mark = page.locator('.vn-foot-mark');
         await expect(mark).toBeVisible();
         await expect(mark).toHaveAttribute('aria-hidden', 'true');
         const m = await page.evaluate(() => {
           const s = document.querySelector('.vn-foot-mark span')!.getBoundingClientRect();
           return { ratio: s.width / innerWidth, over: document.documentElement.scrollWidth - innerWidth };
         });
         expect(m.ratio).toBeGreaterThan(0.8);
         expect(m.ratio).toBeLessThan(1.02);
         expect(m.over).toBeLessThanOrEqual(0);
       });
     }

     test('wordmark rises with scroll and rests at the page end', async ({ page }) => {
       await page.setViewportSize({ width: 1440, height: 900 });
       await page.goto('/');
       await late(page);
       await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
       await bottom(page);
       const y = () => page.locator('.vn-foot-mark span').evaluate((e) => getComputedStyle(e).translate);
       expect(['none', '0px', '0px 0px']).toContain(await y());
       await page.evaluate(() => scrollBy({ top: -220, behavior: 'instant' }));
       await page.waitForTimeout(100);
       expect(await y()).not.toBe('none');
     });

     test('Palmas time is live and correct', async ({ page }) => {
       await page.goto('/en/');
       await late(page);
       const clock = page.locator('[data-vn-clock]');
       await expect(clock).toHaveText(/^\d{2}:\d{2}$/);
       const want = await page.evaluate(() => new Intl.DateTimeFormat('en', { timeZone: 'America/Araguaina', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()));
       const got = (await clock.textContent())!;
       const mins = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
       expect(Math.abs(mins(got) - mins(want)) % 1439).toBeLessThanOrEqual(1);
     });

     test('no JS: no wordmark, static offset', async ({ browser }) => {
       const ctx = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL });
       const page = await ctx.newPage();
       await page.goto('/');
       await expect(page.locator('.vn-foot-mark')).toBeHidden();
       await expect(page.locator('[data-vn-clock]')).toHaveText('UTC−3');
       await ctx.close();
     });
   });
   ```
7. Gate; `npx playwright test e2e/footer.spec.ts e2e/handoffs.spec.ts e2e/chrome-fx.spec.ts e2e/gates.spec.ts
   e2e/a11y.spec.ts e2e/header-ground.spec.ts e2e/choreography.spec.ts e2e/rail.spec.ts`. If `rail.spec.ts` fails on
   "gone before the red band", apply the tuning rule of C5 step 5. Ledger row.

**Reduced motion, no JS, touch.** Reduced motion: the wordmark is shown static (late sheet loads, fx sheet does
not). No JS: no wordmark, "UTC−3". Touch: same as desktop.

**Bytes.** HTML plus about 130 B gz on every page; `late` plus about 380 B gz; `scroll-fx` plus about 70 B gz.

**Pitfalls.**
1. The footer has `overflow-x: clip` and the wordmark its own `overflow: clip`; the reflow tests at 320 to 768 px in
   `e2e/gates.spec.ts` must stay green. Never use `overflow: hidden` here (it would make a scroll container and break
   the view timeline lookup).
2. R3: `.vn-site-footer__inner` keeps `u-rise`. The wordmark is a sibling, and the animation is on its inner span.
3. The footer grows when the late sheet arrives. It is the last element, so nothing below it shifts; a visitor
   already at the very bottom sees the page extend. Acceptable.
4. `e2e/handoffs.spec.ts` test 9 ("Sinal set") measures the contact container's exit and the footer inner's rise; the
   taller footer changes neither selector. If its numeric thresholds fail, report the measured values instead of
   loosening them.
5. The clock span is a `<span>`, not a `<time>`: its fallback text is not a valid time string.

**Done when.** `e2e/footer.spec.ts` green; listed specs green; manual frame at the page end, 1440 and 390, both
themes: wordmark edge to edge with a red dot, time shown.

**Commit.** `feat(footer): full-width wordmark rising through a mask and Palmas local time`

---

## D2. Contact band: larger mobile title, idle drift in the signal field

**Goal.** (a) On phones the contact title is set larger: it fills the measure like on desktop. (b) When no pointer
is over the band, the dot field does not sit still: after 1.2 s a slow wandering point makes the dots swell and lean
as if something moved under them. It stops when the band leaves the screen. The owner loves this band: no layout or
colour change.

**Files.** `src/styles/sections/contact.css`, `src/styles/sections/responsive.css`, `src/scripts/signal-field.ts`,
`e2e/signal-field.spec.ts` (one new test), `e2e/gates.spec.ts` only if the reflow rule below says so, `budget.json`,
this file.

**Do not change.** The band's colours, copy, buttons; how the chunk is loaded (`main.ts`: on idle, `motionOK()`,
band within one viewport, so never on touch and never under reduced motion); the press shockwave.

**Steps.**

1. `src/styles/sections/contact.css`: after the rule `.vn-contact-band .vn-contact-title { ... }` (lines 44 to 48)
   add:
   ```css
     @media (max-width: 600px) {
       .vn-contact-band .vn-contact-title { font-size: clamp(3.25rem, 16.5vw, 6rem); }
     }
   ```
2. `src/styles/sections/responsive.css`, lines 104 to 106: delete the rule
   ```css
       .vn-contact-title {
         font-size: clamp(2.5rem, 11vw, 4rem);
       }
   ```
   (it never applied: the rule in `contact.css` has higher specificity).
3. Fit rule: build and run `npx playwright test e2e/gates.spec.ts -g reflow`. If any width overflows, or if at
   390 px either title line wraps (check: `.vn-contact-l1` height is more than 1.3 times its font size), lower
   `16.5vw` in steps of 0.5 until both hold for `/` and `/en/`.
4. `src/scripts/signal-field.ts`.
   - After line 9 (`const D = 0.8; // damping per frame`) add:
     ```ts
     const IDLE_MS = 1200; // with no pointer over the band for this long, the field starts to drift on its own
     ```
   - Line 26 today: `let px = -1e4, py = -1e4, raf = 0, last = 0;` becomes
     ```ts
     let px = -1e4, py = -1e4, raf = 0, last = 0;
     let idleAt = performance.now(), vis = false, drift = false;
     ```
   - The `flag` function (lines 28 to 30) becomes:
     ```ts
     const flag = () => {
       if (!dbg) return;
       const w = window as unknown as Record<string, unknown>;
       w.__vnFieldRunning = !!raf;
       w.__vnFieldDrift = drift;
     };
     ```
   - In `step` (starts line 61): directly after `let e = 0;` add:
     ```ts
       // D2: no pointer over the band: after IDLE_MS a slow wandering point takes its place
       drift = px < -9e3 && vis && t - idleAt > IDLE_MS;
       const ax = drift ? W * (0.5 + 0.38 * Math.sin(t * 0.00037)) : px;
       const ay = drift ? H * (0.5 + 0.32 * Math.sin(t * 0.00053 + 1.3)) : py;
     ```
     and in the loop below change `const dx = px - (i % cols + 0.5) * G, dy = py - (((i / cols) | 0) + 0.5) * G;`
     to use `ax` and `ay` instead of `px` and `py`.
   - Near the end of `step`, `raf = e > 0 ? requestAnimationFrame(step) : 0;` becomes:
     ```ts
       // keep ticking while idle and on screen (waiting for, or running, the drift); otherwise stop when settled
       raf = e > 0 || (px < -9e3 && vis) ? requestAnimationFrame(step) : 0;
     ```
   - The `pointerleave` handler: `() => { px = py = -1e4; go(); }` becomes
     `() => { px = py = -1e4; idleAt = performance.now(); go(); }`.
   - Before the last line (`new ResizeObserver(size).observe(band);`) add:
     ```ts
     new IntersectionObserver(([en]) => {
       vis = en.isIntersecting;
       if (vis) {
         idleAt = performance.now();
         go();
       }
     }).observe(band);
     ```
5. `budget.json`: lower `"signal-field"` from 2560 to 1792 (measured about 1400 after this task).
6. Test, in `e2e/signal-field.spec.ts` inside the `for (const route ...)` describe, after "the field reacts to the
   pointer, then the rAF loop goes idle" (which must keep passing unchanged: there the pointer rests over the band,
   so there is no drift and the loop still stops):
   ```ts
   test('with no pointer over the band the field drifts, and stops when the band leaves the screen', async ({ page }) => {
     await page.setViewportSize({ width: 1366, height: 800 });
     await page.goto(`${route}?vn-debug`);
     await page.waitForLoadState('networkidle');
     await page.mouse.move(600, 20); // a real move (motionOK chunks load); it stays over the header, not the band
     await page.locator('#contato').scrollIntoViewIfNeeded();
     const canvas = page.locator('#contato canvas.vn-sf');
     await expect(canvas).toHaveCount(1);
     await page.waitForFunction(() => (window as unknown as { __vnFieldDrift?: boolean }).__vnFieldDrift === true, undefined, { timeout: 5000 });
     const a = await canvas.evaluate((cv: HTMLCanvasElement) => cv.toDataURL());
     await page.waitForTimeout(500);
     const b = await canvas.evaluate((cv: HTMLCanvasElement) => cv.toDataURL());
     expect(b).not.toBe(a);
     await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
     await page.waitForFunction(() => (window as unknown as { __vnFieldRunning?: boolean }).__vnFieldRunning === false, undefined, { timeout: 4000 });
   });
   ```
   If the header covers part of the band at that scroll position and the pointer ends up over the band, move the
   pointer to `(600, 20)` again after the scroll.
7. Gate; `npx playwright test e2e/signal-field.spec.ts e2e/gates.spec.ts e2e/cursor-trail-optout.spec.ts
   e2e/a11y.spec.ts e2e/render-cost.spec.ts` (paste new `contato` seeds if printed). Ledger row.

**Reduced motion, no JS, touch.** The chunk never loads in those cases: the band is static. The title size is plain
CSS for everyone.

**Bytes.** `signal-field` plus about 160 B gz; inline CSS about plus 10 B net.

**Pitfalls.**
1. The loop now runs continuously while the band is visible and the pointer is elsewhere. It must stop off screen
   (the IntersectionObserver) and in a background tab (the existing `visibilitychange` handler cancels it; `go()`
   restarts it on return). Check both by hand once: `__vnFieldRunning` in the console with `?vn-debug`.
2. `t` in `step` and `performance.now()` share a time origin; do not use `Date.now()` for `idleAt`.
3. R8: `#contato` is a deferred section and R9 reads its colour: neither is touched.

**Done when.** The new test and the existing signal-field tests are green; reflow tests green; manual frame at 390:
"Bora fazer" fills the line; at 1440 the dots visibly breathe when the mouse rests outside the band.

**Commit.** `feat(contact): larger mobile title and idle drift in the signal field`

---

## C9. Hero badge turns with scroll

**Goal.** The round badge on the portrait keeps its slow 18 s spin and also turns 200 degrees while the hero
scrolls away (Era's logo badge rotates with scroll).

**Files.** `src/components/home/Hero.astro`, `src/styles/sections/hero.css`, `src/styles/fx/parallax.css`,
`e2e/parallax.spec.ts` (one new test), this file. After C2.

**Do not change.** `.vn-hero-badge__svg`'s `animation: vn-spin 18s linear infinite` (R3: the scroll turn goes on a
new wrapper, not on the svg); the badge wrapper's intro from C2; `hero-fx.ts` (it writes `transform` on
`.vn-hero-badge`).

**Steps.**

1. `src/components/home/Hero.astro`, lines 112 to 122 today:
   ```astro
         <div class="vn-hero-badge" aria-hidden="true">
           <svg viewBox="0 0 120 120" width="112" height="112" class="vn-hero-badge__svg">
             ...
           </svg>
           <span class="vn-hero-badge__center">VN</span>
         </div>
   ```
   Wrap the `<svg>...</svg>` element (and only it) in `<span class="vn-hero-badge__turn">` ... `</span>`.
2. `src/styles/sections/hero.css`, the rule on lines 307 to 310:
   ```css
     .vn-hero-badge__svg {
       fill: var(--vn-cream);
       animation: vn-spin 18s linear infinite;
     }
   ```
   becomes
   ```css
     .vn-hero-badge__svg {
       display: block; /* no inline gap inside the new wrapper */
       fill: var(--vn-cream);
       animation: vn-spin 18s linear infinite;
     }
   ```
3. `src/styles/fx/parallax.css`, inside the block, after the `@keyframes vn-pt` line add:
   ```css
       /* C9: the badge turns with scroll (wrapper), on top of its time-based spin (the svg inside). Identity at scrollY 0. */
       @keyframes vn-bt { to { rotate: 200deg; } }
       .vn-hero-badge__turn { animation-name: vn-bt; animation-timing-function: linear; animation-fill-mode: both; animation-timeline: scroll(root); animation-range: 0 100svh; }
   ```
4. Test, appended to `e2e/parallax.spec.ts`:
   ```ts
   test('hero badge turns with scroll and keeps its time-based spin', async ({ page }) => {
     await page.setViewportSize({ width: 1440, height: 900 });
     await ready(page);
     const turn = page.locator('.vn-hero-badge__turn');
     expect(['none', '0deg']).toContain(await turn.evaluate((e) => getComputedStyle(e).rotate));
     await page.evaluate(() => scrollTo({ top: 450, behavior: 'instant' }));
     await raf2(page);
     const deg = parseFloat(await turn.evaluate((e) => getComputedStyle(e).rotate));
     expect(deg).toBeGreaterThan(90);
     expect(deg).toBeLessThan(110);
     expect(await page.locator('.vn-hero-badge__svg').evaluate((e) => getComputedStyle(e).animationName)).toBe('vn-spin');
     const box = await page.locator('.vn-hero-badge').evaluate((e) => [e.clientWidth, e.clientHeight]);
     expect(box).toEqual([110, 110]); // 112 minus the 1px border on each side: the wrapper did not change the badge's size
   });
   ```
   (`ready` and `raf2` exist at the top of that spec. If `ready` loads `/` without setting a viewport, keep the
   `setViewportSize` line before it.)
5. Gate; `npx playwright test e2e/parallax.spec.ts e2e/hero.spec.ts e2e/gates.spec.ts e2e/handoffs.spec.ts`. Ledger
   row.

**Reduced motion, no JS, touch.** No fx sheet under reduced motion or without JS: no turn. Below 720 px the badge is
hidden. Under reduced motion the time spin is already off (`responsive.css`).

**Bytes.** HTML plus about 25 B gz; inline plus about 10 B; `scroll-fx` plus about 50 B.

**Pitfalls.** The badge is a grid (`place-items: center`) and `.vn-hero-badge__center` is absolutely positioned; the
new span becomes the grid item. If the "VN" is no longer centred, the svg is not `display: block`.

**Done when.** New test green; manual frame: scroll 300 px and the ring of text has clearly turned.

**Commit.** `feat(hero): badge rotation tied to scroll on top of its spin`

---

## D4. Mobile service cards open like a frame; the marquee follows scroll speed

**Goal.** (a) Below 900 px, where the sticky stack is off, each service card opens from an inset rounded frame to
its full size as it enters (scroll-driven clip). The owner loves the cards: content and layout do not change. (b)
The expertise marquee speeds up while the page is scrolling fast and eases back to its normal pace.

**Files.** `src/styles/fx/moments.css`, `src/scripts/scroll-fx.ts`, `e2e/moments.spec.ts` (two new tests), this file.

**Do not change.** `services.css` (the sticky stack from 900 px up and its `vn-svc-under` animation);
`src/scripts/marquee.ts` (the pause button); `expertise.css`.

**Steps.**

1. `src/styles/fx/moments.css`, inside the `@supports` block and its `@media`, after the `html.js .vn-journey-card`
   rule add:
   ```css
       /* D4: below the sticky-stack breakpoint each service card opens like a frame while it enters.
          No card has an animation at these widths (services.css only animates from 900px up). */
       @media (max-width: 899px) {
         @keyframes vn-frame { from { clip-path: inset(12% 9% round var(--vn-radius-2xl)); } }
         .vn-service-card { animation-name: vn-frame; animation-timing-function: cubic-bezier(.25, 1, .5, 1); animation-fill-mode: backwards; animation-timeline: view(); animation-range: entry 0% entry 80%; }
         .vn-service-card:focus-within { animation: none; }
       }
   ```
2. `src/scripts/scroll-fx.ts`: at the end of `init()` (after the `[data-enter=lines]` loop) add:
   ```ts
     // D4: the marquee rows speed up with the page's scroll speed and ease back (playbackRate only: no layout, and
     // a paused row stays paused). Skipped sections have no animations yet, so this is a no-op until they render.
     const rows = document.querySelectorAll('.vn-marquee-stack .vn-marquee__track');
     if (rows.length) {
       let ly = scrollY, lt = performance.now(), boost = 1, mraf = 0;
       const rate = (r: number) => rows.forEach((el) => el.getAnimations().forEach((a) => { a.playbackRate = r; }));
       const ease = () => {
         boost += (1 - boost) * 0.08;
         const done = Math.abs(boost - 1) < 0.02;
         rate(done ? 1 : boost);
         mraf = done ? 0 : requestAnimationFrame(ease);
       };
       addEventListener('scroll', () => {
         const now = performance.now();
         const v = Math.abs(scrollY - ly) / Math.max(16, now - lt); // px per ms
         ly = scrollY;
         lt = now;
         boost = Math.min(5, Math.max(boost, 1 + v * 1.6));
         if (!mraf) mraf = requestAnimationFrame(ease);
       }, { passive: true });
       mq.addEventListener('change', () => mq.matches && rate(1));
     }
   ```
   (`mq` is the existing reduced-motion media query object declared earlier in `init()`.)
3. Tests, appended to `e2e/moments.spec.ts` inside `test.describe('moments, no-preference', ...)`:
   ```ts
   test('mobile: a service card opens from an inset frame as it enters', async ({ page }) => {
     await page.setViewportSize({ width: 390, height: 844 });
     await page.goto('/');
     await ready(page);
     const card = page.locator('.vn-service-card').nth(1);
     const clip = (p: number) =>
       page.evaluate(async (q) => {
         const el = document.querySelectorAll('.vn-service-card')[1];
         const place = () => { const r = el.getBoundingClientRect(); scrollTo({ top: scrollY + r.top - innerHeight + q * Math.min(r.height, innerHeight), behavior: 'instant' }); };
         place();
         await new Promise((r) => setTimeout(r, 150));
         place();
         await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
         return getComputedStyle(el).clipPath;
       }, p);
     expect(await clip(0.05)).toMatch(/^inset\(/);
     expect(await clip(0.95)).toBe('none');
     await card.locator('a').focus();
     await expect.poll(() => card.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
   });

   test('the marquee speeds up while scrolling and eases back to 1', async ({ page }) => {
     await page.setViewportSize({ width: 1366, height: 900 });
     await page.goto('/');
     await ready(page);
     await page.locator('.vn-marquee-stack').scrollIntoViewIfNeeded();
     const rate = () => page.evaluate(() => Math.max(...[...document.querySelectorAll('.vn-marquee-stack .vn-marquee__track')].flatMap((e) => e.getAnimations().map((a) => a.playbackRate))));
     await expect.poll(rate).toBe(1);
     await page.evaluate(async () => {
       for (let i = 0; i < 6; i++) {
         scrollBy({ top: i % 2 ? -160 : 200, behavior: 'instant' });
         await new Promise((r) => requestAnimationFrame(r));
       }
     });
     expect(await rate()).toBeGreaterThan(1.5);
     await expect.poll(rate, { timeout: 4000 }).toBe(1);
   });
   ```
4. Gate; `npx playwright test e2e/moments.spec.ts e2e/interactions.spec.ts e2e/gates.spec.ts e2e/scroll-fx.spec.ts
   e2e/services-arc.spec.ts e2e/choreography.spec.ts`. Ledger row. If `check:budget` fails on `scroll-fx`, set its
   cap to 3584 and update the Budgets table.

**Reduced motion, no JS, touch.** Neither effect exists without the fx chunk. Touch phones are the target of (a).

**Bytes.** `scroll-fx` plus about 330 B gz.

**Pitfalls.**
1. R3: from 900 px up `.vn-service-card` has `vn-svc-under`; the new rule is inside `max-width: 899px`, so the two
   never meet. Do not widen the media query.
2. The card's children enter with `[data-enter]` transitions while the card's clip opens; both are on screen at the
   same time and that is intended. `:focus-within { animation: none }` keeps a focused link fully visible (2.4.11).
3. The marquee pause button and the stack's `:hover` pause set `animation-play-state`; `playbackRate` does not
   un-pause. `e2e/interactions.spec.ts` ("marquee pause/resume") must stay green.
4. `e2e/gates.spec.ts` reads `document.getAnimations()` under reduced motion; the fx chunk is not loaded there, so the
   listener is never attached.

**Done when.** Both new tests green; listed specs green; manual frame at 390: a card grows from a rounded inset
frame as it scrolls in.

**Commit.** `feat(services): frame-open entry on mobile; marquee follows scroll speed`

---

## D3. Portrait colour blooms once on touch

**Goal.** On touch devices the grayscale portrait has a hidden colour layer that only appears when the visitor taps
it; most never find it. After the visitor's first scroll or touch anywhere, when the portrait is at least 60% on
screen, three soft blooms colour most of it, once. The colour persists (the mask only accumulates), and tapping and
dragging still paint. Nothing happens on load, so Lighthouse (which never scrolls or touches) measures no change.

**Files.** `src/scripts/hero.ts`, `src/scripts/hero-fx.ts`, `e2e/hero.spec.ts` (one new test), this file.

**Do not change.** The fine-pointer branch of `hero.ts`; the `painter`, `stroke`, `fine` functions; the image element
(never a filter or opacity change on it: the colour is drawn on the canvas above it).

**Steps.**

1. `src/scripts/hero.ts`, the `else` branch (lines 28 to 36 today):
   ```ts
     } else {
       // Must be set before the gesture starts: sideways drags paint, vertical swipes still scroll.
       wrap.style.touchAction = 'pan-y pinch-zoom';
       wrap.addEventListener(
         'pointerdown',
         (e) => void import('./hero-fx').then((m) => m.touch(wrap, canvas, img, e)),
         { once: true },
       );
     }
   ```
   becomes
   ```ts
     } else {
       // Must be set before the gesture starts: sideways drags paint, vertical swipes still scroll.
       wrap.style.touchAction = 'pan-y pinch-zoom';
       let started = false;
       // One entry point: a tap on the portrait (e) paints where the finger is; without e the colour blooms by itself.
       const start = (e?: PointerEvent) => {
         if (started) return;
         started = true;
         removeEventListener('scroll', arm);
         removeEventListener('touchstart', arm);
         void import('./hero-fx').then((m) => m.touch(wrap, canvas, img, e, !e));
       };
       // D3: after the visitor's first scroll or touch, bloom once when the portrait is mostly on screen.
       const arm = () => {
         removeEventListener('scroll', arm);
         removeEventListener('touchstart', arm);
         const io = new IntersectionObserver((es) => {
           if (!es.some((x) => x.isIntersecting)) return;
           io.disconnect();
           start();
         }, { threshold: 0.6 });
         io.observe(wrap);
       };
       wrap.addEventListener('pointerdown', (e) => start(e), { once: true });
       addEventListener('scroll', arm, { passive: true });
       addEventListener('touchstart', arm, { passive: true });
     }
   ```
   (`pointerdown` fires before `touchstart`, so a first tap on the portrait takes the manual path.)
2. `src/scripts/hero-fx.ts`, function `touch` (starts line 288). Its signature
   `export function touch(wrap: HTMLElement, canvas: HTMLCanvasElement, img: HTMLImageElement, first?: PointerEvent) {`
   becomes
   `export function touch(wrap: HTMLElement, canvas: HTMLCanvasElement, img: HTMLImageElement, first?: PointerEvent, auto = false) {`
   and its last line `if (first) onDown(first, false);` becomes
   ```ts
     if (first) onDown(first, false);
     else if (auto) {
       // D3: three blooms down the portrait, 180 ms apart, so most of it turns to colour once
       [0.3, 0.55, 0.8].forEach((fy, i) =>
         setTimeout(() => {
           const r = wrap.getBoundingClientRect();
           onDown({ clientX: r.left + r.width * (i === 1 ? 0.42 : 0.58), clientY: r.top + r.height * fy } as PointerEvent, false);
         }, i * 180),
       );
     }
   ```
   Also update the comment above the function: add "With `auto` it blooms by itself once (D3)."
3. Test, in `e2e/hero.spec.ts` after "touch: tapping the portrait blooms colour, with a tap caption" (which must
   keep passing unchanged):
   ```ts
   test('touch: the colour blooms by itself after the first scroll, not on load', async ({ browser }) => {
     const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL: test.info().project.use.baseURL });
     const page = await ctx.newPage();
     const fx: string[] = [];
     page.on('request', (rq) => /\/_astro\/hero-fx\./.test(rq.url()) && fx.push(rq.url()));
     await page.goto('/?vn-debug');
     await page.waitForLoadState('load');
     await page.waitForTimeout(1500);
     expect(fx).toEqual([]); // nothing on load
     await expect(page.locator('.vn-hero-portrait__canvas')).toBeHidden();
     await page.locator('[data-vn-portrait-wrap]').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
     await expect(page.locator('.vn-hero-portrait__canvas')).toBeVisible({ timeout: 5000 });
     await settled(page);
     expect(await revealed(page)).toBeGreaterThan(0.2);
     // the image itself is untouched
     await expect(page.locator('.vn-hero-portrait__img')).toHaveCSS('opacity', '1');
     await ctx.close();
   });
   ```
   (`settled` and `revealed` are helpers defined near line 100 of that spec.) If the portrait is already centred at
   load at this viewport, so that `scrollIntoView` causes no scroll event, add
   `await page.evaluate(() => scrollBy({ top: 30, behavior: 'instant' }));` before the `toBeVisible` line.
4. Gate; `npx playwright test e2e/hero.spec.ts e2e/gates.spec.ts e2e/parallax.spec.ts`. Lighthouse mobile on `/`
   (command in C2 step 4) must exit 0. Ledger row.

**Reduced motion, no JS, touch.** `hero.ts` returns early under reduced motion (line 12): no bloom. No JS: static
grayscale portrait. Fine pointers: unchanged (the brush).

**Bytes.** First-load JS plus about 90 B gz; `hero-fx` plus about 90 B gz.

**Pitfalls.**
1. The canvas is `display: none` on touch (`responsive.css`) until `onDown` sets `canvas.style.display = 'block'`.
   The existing touch test asserts it is hidden after load: never start the bloom on load or on idle.
2. `onDown` counts taps and fades the caption after the third. The three automatic blooms use up that count, so the
   "tap to reveal" caption fades right after the bloom. That is intended: the reveal has happened.
3. Do not call `start()` from a timer or from `IntersectionObserver` alone: Lighthouse mobile emulates touch, and a
   visual change after load would lengthen its Speed Index.

**Done when.** New test green, existing touch test green, Lighthouse mobile exits 0; manual check on a phone or in
device emulation: after the first swipe the portrait turns to colour in three soft waves and stays coloured.

**Commit.** `feat(hero): portrait colour blooms once on touch after the first scroll`

---

## C3. Jornada pinned on desktop: vertical scroll carries the cards sideways

**Risk: high (large test surface). Droppable:** to drop it, revert this task's commit; nothing else depends on it
(B4 only needs to know whether it landed).

**Goal.** On desktop the career cards are a pinned horizontal chapter, as on Era: the section's head scrolls by,
then the card row sticks to the viewport and normal vertical scrolling slides the eight cards right to left, behind
them an oversized ghost word ("jornada" / "journey") drifting at a slower speed. When the last card has arrived the
page continues. There is no scroll hijacking: the pin is `position: sticky` inside a tall runway and the motion is a
CSS scroll-driven animation on the compositor. Everywhere else (touch, widths up to 1080 px, short windows, reduced
motion, no JS, browsers without scroll timelines) the swipe carousel of today stays, untouched.

Owner constraints honoured: no inner scrollbar, no double scroll (in pinned mode the track is not a scroll
container at all).

**How pinned mode is decided.** All its CSS lives in the fx sheet, inside a top-level
`@supports (animation-timeline: view())` block (dropped by `scroll-fx.ts` when unsupported) and a media query
`(min-width: 1081px) and (min-height: 720px) and (hover: hover) and (pointer: fine) and
(prefers-reduced-motion: no-preference)`. The fx chunk only loads with JS and without reduced motion. So the mode
needs no flag: `journey.ts` asks the browser, `getComputedStyle(track).animationName === 'vn-jpin'`.

**Behaviour table.**

| Thing | Carousel mode (today) | Pinned mode |
|---|---|---|
| Track | horizontal scroll container, snap | not scrollable; translated by the runway's view timeline |
| Wheel, trackpad, keyboard page scroll | scrolls the page | scrolls the page, which moves the cards |
| Counter `01 / 08` | from `scrollLeft` | from the runway's scroll progress |
| Progress bar | `transform` written by JS | CSS animation on the same timeline (overrides the inline transform) |
| Prev / next buttons, ArrowLeft / ArrowRight on the focused track | `track.scrollTo` one card | `window.scrollTo` to the page position of that card (smooth; instant under reduced motion) |
| Mouse drag | scrolls the track, inertia, snap | scrolls the page by the drag distance times the scroll-to-travel ratio; no snap |
| Touch | native swipe | not available (pinned mode requires a fine pointer) |
| Card depth animation (`view(inline)`) | on | off (the cards are not in an inline scroller any more) |
| Header ground flip (R9), nav active link | `#jornada` | unchanged: the header line stays inside `#jornada` for the whole pin |
| Anchor jump to `#jornada` | section top | section top (the head); the pin starts one head-height later |
| Anchor jump to a later section | n/a | lands correctly; the smooth scroll passes through the pin and the cards sweep by |
| Find-in-page hit inside an off-screen card | browser scrolls the track | browser scrolls the page to the pin; the card may be off to the side. Known limit; the cards hold no links or controls, so keyboard focus is never lost in them |

**Files.** `src/components/home/Journey.astro`, `src/styles/sections/journey.css`, new
`src/styles/fx/journey-pin.css`, `src/scripts/scroll-fx.ts`, `src/scripts/journey.ts`, `budget.json`,
`e2e/journey.spec.ts`, `e2e/moments.spec.ts`, `e2e/lines-reveal.spec.ts`, `e2e/render-cost.spec.ts`, new
`e2e/journey-pinned.spec.ts`, this file.

**Do not change.** The cards' markup and copy; the head (eyebrow, `h2`, subtitle) and its `data-enter` values; the
track's `data-vn-journey`, `tabindex`, `role`, `aria-label`, `data-cursor-label`; `#jornada`'s `u-shut` entry and the
`u-drift` exit of `#jornada > .vn-container:first-of-type` in `handoff.css`; `src/styles/fx/moments.css`;
`render-cost.css` (the pinned seed goes in the fx file).

**Steps.**

1. `src/components/home/Journey.astro`. Three moves: the controls leave the head, the track and the progress bar get
   two wrappers, and a ghost word is added. Lines 30 to 97 today (from the first `<div class="vn-container">` to the
   `vn-journey-progress` line) become:
   ```astro
     <div class="vn-container">
       <div class="vn-sec-split">
         <div data-stagger>
           <p class="vn-eyebrow" data-enter><span aria-hidden="true">[ {eyebrowNum} — </span>{eyebrowTag}<span aria-hidden="true"> ]</span></p>
           <h2 class="vn-type-h2 vn-split-title" data-enter="mask"><Words text={titlePre} /><em><Words text={titleEm} /></em></h2>
           <p class="vn-type-body vn-muted vn-sec-sub" data-enter="lines">{c.journey.subtitle}</p>
         </div>
       </div>
     </div>

     <div class="vn-journey-run">
       <div class="vn-journey-pin">
         <p class="vn-journey-ghost" aria-hidden="true" hidden>{eyebrowTag}</p>
         <div class="vn-container">
           <div class="vn-journey-controls" data-enter>
             ...the four children exactly as today: hint span, count span, prev button, next button...
           </div>
         </div>

         <div class="vn-journey-track" ...all attributes as today...>
           ...cards as today...
         </div>

         <div class="vn-container">
           <div class="vn-journey-progress" aria-hidden="true"><span data-journey-bar></span></div>
         </div>
       </div>
     </div>

     <div class="vn-container">
       <details class="vn-archive-details" data-enter>
         ...as today...
       </details>
     </div>
   ```
   In other words: (a) cut `<div class="vn-journey-controls" data-enter>...</div>` out of `.vn-sec-split`; (b) open
   `<div class="vn-journey-run"><div class="vn-journey-pin">` before the track; (c) put the ghost `<p>` and the
   controls (in their own `.vn-container`) first inside the pin; (d) move the `vn-journey-progress` div out of the
   last container into its own `.vn-container` right after the track, then close the pin and the run; (e) the last
   container keeps only the `<details>`. The ghost carries `hidden`, so it shows nowhere until the pinned CSS turns
   it on.
2. `src/styles/sections/journey.css`, the `.vn-journey-controls` rule (lines 3 to 7):
   ```css
     .vn-journey-controls {
       display: flex;
       align-items: center;
       gap: var(--vn-space-2);
     }
   ```
   becomes
   ```css
     .vn-journey-controls {
       display: flex;
       align-items: center;
       justify-content: flex-end;
       gap: var(--vn-space-2);
       margin-block-end: var(--vn-space-4);
     }
   ```
3. Create `src/styles/fx/journey-pin.css`:
   ```css
   /* C3: fx/journey-pin.css, adopted by src/scripts/scroll-fx.ts into @layer site (do not wrap it in @layer yourself).
      Pinned horizontal Jornada. Everything is inside one top-level @supports block, so it is dropped where scroll
      timelines are missing, and inside one media query, so touch, small or short windows and reduced motion keep the
      swipe carousel. Longhand animation properties only, no duration (see R4 in docs/AWWWARDS-PLAN.md). */
   @supports (animation-timeline: view()) {
     @media screen and (min-width: 1081px) and (min-height: 720px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
       #jornada {
         /* side padding of the page container, and the distance the row travels: --j-n cards of 360px with 16px
            gaps, plus both paddings, minus the viewport */
         --j-side: calc(max(0px, (100vw - var(--vn-layout-container-max)) / 2) + clamp(var(--vn-layout-pad-x-min), 5vw, var(--vn-layout-pad-x-max)));
         --j-travel: calc(var(--j-n, 8) * 376px - 16px + 2 * var(--j-side) - 100vw);
         /* seed for content-visibility while the section is not rendered: see step 7 for the first number */
         --ci: calc(760px + 100svh + 1.25 * var(--j-travel));
       }
       /* the runway: one viewport for the pin plus 1.25 px of scroll per px of travel (Era: 4000 for 3100) */
       .vn-journey-run { height: calc(100svh + 1.25 * var(--j-travel)); view-timeline: --jr block; }
       .vn-journey-pin {
         position: sticky; top: 0; height: 100svh; overflow: clip;
         display: flex; flex-direction: column; justify-content: center;
         padding-block-start: var(--nav-h, 73px);
       }
       .vn-journey-pin > * { position: relative; z-index: 1; }
       #jornada .vn-journey-track {
         overflow-x: visible; width: max-content; min-width: 100%; scroll-snap-type: none;
         padding-block: var(--vn-space-2) var(--vn-space-5); margin-block-end: 0;
         animation-name: vn-jpin; animation-timing-function: linear; animation-fill-mode: both;
         animation-timeline: --jr; animation-range: contain 0% contain 100%;
       }
       /* the cards are no longer inside an inline scroller: their depth animation has no timeline to follow */
       html.js #jornada .vn-journey-card { animation-name: none; }
       #jornada .vn-journey-progress > span {
         animation-name: vn-jbar; animation-timing-function: linear; animation-fill-mode: both;
         animation-timeline: --jr; animation-range: contain 0% contain 100%;
       }
       /* Era's oversized word behind the row, drifting slower than the cards */
       #jornada .vn-journey-ghost {
         display: block; position: absolute; z-index: 0; left: 0; bottom: 4svh; margin: 0;
         font: italic 900 clamp(12rem, 30vw, 30rem) / .8 var(--vn-font-display);
         font-variation-settings: "opsz" 144, "WONK" 1; letter-spacing: -.045em; text-transform: lowercase; white-space: nowrap;
         color: color-mix(in srgb, currentColor 8%, transparent); pointer-events: none;
         animation-name: vn-jghost; animation-timing-function: linear; animation-fill-mode: both;
         animation-timeline: --jr; animation-range: cover 0% cover 100%;
       }
       @keyframes vn-jpin { to { translate: calc(100vw - 100%) 0; } }
       @keyframes vn-jbar { from { transform: scaleX(.125); } to { transform: scaleX(1); } }
       @keyframes vn-jghost { from { translate: 10vw 0; } to { translate: -24vw 0; } }
     }
   }
   ```
   Notes for the reader: `translate` percentages refer to the element's own width, and the track is `max-content`
   wide, so `calc(100vw - 100%)` moves it exactly until its right edge meets the viewport's right edge whatever the
   number of cards; `--j-n` only sets how much vertical scroll that takes. `contain 0% contain 100%` on a subject
   taller than the viewport is exactly the stretch during which the sticky child is stuck.
4. `src/scripts/scroll-fx.ts`: add `import journeyPin from '../styles/fx/journey-pin.css?inline';` after the other
   imports and append `${journeyPin}` at the end of the template string in `S.replaceSync(...)`, after `${cases}`.
   After the `adoptedStyleSheets` line add (Safari has no scroll anchoring, and the section above a hash target just
   grew):
   ```ts
     // C3: adopting the sheet makes #jornada taller; a page opened on a later #hash is put back on its target
     if (tl && location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
   ```
5. `src/scripts/journey.ts`.
   - After `if (!cards.length) return;` (line 11) add:
     ```ts
       // C3 pinned mode: the fx sheet (fx/journey-pin.css) translates the track with the page scroll. Ask the
       // browser instead of duplicating its media query; re-checked on resize and when the fx sheet arrives.
       const run = track.closest<HTMLElement>('.vn-journey-run');
       let pin = false;
       const span = () => Math.max(1, run!.offsetHeight - innerHeight); // page scroll that carries the whole row
       const runTop = () => run!.getBoundingClientRect().top + scrollY;
       const pinP = () => Math.min(1, Math.max(0, (scrollY - runTop()) / span()));
     ```
   - In `update` (line 24), make its first lines:
     ```ts
       const update = () => {
         if (pin) {
           const idx = Math.round(pinP() * (cards.length - 1));
           if (count && idx !== shown) count.textContent = `${pad(idx + 1)} / ${pad(cards.length)}`;
           shown = idx;
           return; // the bar is driven by CSS on the same timeline
         }
     ```
     and leave the rest of the function as it is.
   - Line 39 today: `if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); update(); }).observe(track);`
     and the two lines after it (`measure();` `update();`) become:
     ```ts
       const mode = () => {
         pin = !!run && getComputedStyle(track).animationName === 'vn-jpin';
         measure();
         update();
       };
       if ('ResizeObserver' in window) new ResizeObserver(mode).observe(track);
       addEventListener('resize', mode, { passive: true });
       new MutationObserver(mode).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scroll-fx'] });
       addEventListener('scroll', () => {
         if (pin && !raf) raf = requestAnimationFrame(() => { raf = 0; update(); });
       }, { passive: true });
       mode();
     ```
     (`raf` is the variable declared on line 35 for the track's own scroll listener; move its `let raf = 0;`
     declaration above this block if needed.)
   - `go` (lines 44 to 48) becomes:
     ```ts
       const go = (dir: 1 | -1) => {
         stop();
         const i = Math.min(Math.max(shown + dir, 0), cards.length - 1);
         if (pin) scrollTo({ top: runTop() + (i / (cards.length - 1)) * span(), behavior: behavior() });
         else track.scrollTo({ left: snaps[i], behavior: behavior() });
       };
     ```
   - Drag. Add `let startY = 0;` next to `let startScroll = 0;`. In the `pointerdown` handler add
     `startY = scrollY;` after `startScroll = track.scrollLeft;`. The `pointermove` body
     `track.scrollLeft = startScroll - (e.clientX - startX);` becomes:
     ```ts
         if (pin) scrollTo({ top: startY + (startX - e.clientX) * (span() / Math.max(1, track.offsetWidth - innerWidth)), behavior: 'instant' });
         else track.scrollLeft = startScroll - (e.clientX - startX);
     ```
     In `end`, directly after `dragging = false;` add `if (pin) return stop();`.
6. `budget.json`: add `"journey": 1792` to `lazyChunks`; set `"scroll-fx": 3584` if not already.
7. Seeds and the pin's minimum height (two measurements, both on a build of this task, in Chrome at 1366 x 800
   and 1440 x 900, on `/` and `/en/`, after `document.documentElement.dataset.scrollFx === 'tl'`):
   - Tallest card: `Math.max(...[...document.querySelectorAll('.vn-journey-card')].map((c) => c.offsetHeight))`.
     Call it `H`. The pin needs `73 + 44 + 16 + 8 + H + 24 + 18` px (header, controls row, its margin, track
     padding, card, track padding, progress row), that is `H + 183`. Rule: if `H + 183` is above 720, replace
     `min-height: 720px` in the media query by `H + 183` rounded up to the next multiple of 20, and state the value
     in your report. If that value is above 800, also add `flex-basis: 440px;` to a new rule
     `#jornada .vn-journey-card { ... }` inside the block and change `376px` to `456px` in `--j-travel`, then
     measure again (wider cards are shorter).
   - Seed: run `npx playwright test e2e/render-cost.spec.ts` after step 8's edit. For `jornada` at 1366 and 1100 it
     prints `real`. Set the `760px` in the fx file's `--ci` to `real(1366) - 800 - 1.25 * travel(1366)`, where
     `travel(1366) = 8 * 376 - 16 + 2 * 68.3 - 1366 = 1762.6`, rounded to 10. Re-run until green at both widths.
8. Existing tests to adapt (pinned mode is active in desktop Playwright contexts from 1081 px wide):
   - `e2e/journey.spec.ts`: change `test.use({ viewport: { width: 1366, height: 900 } });` to
     `test.use({ viewport: { width: 1024, height: 900 } });` and add above the describe the comment
     `// 1024 wide: the swipe carousel. The pinned desktop mode is covered by journey-pinned.spec.ts.` In "mouse drag
     moves the track and snaps to a card on release", change the three x offsets `box.x + 900`, `box.x + 700`,
     `box.x + 500` to `box.x + 800`, `box.x + 600`, `box.x + 400`.
   - `e2e/moments.spec.ts`, "journey cards scale by inline position on the track": change
     `await page.setViewportSize({ width: 1280, height: 900 });` to `{ width: 1024, height: 900 }`.
   - `e2e/lines-reveal.spec.ts`, "built inline scroll-driven animations keep a name and a scroll/view timeline": in
     the `sel` array replace `'.vn-journey-card'` with `'.vn-journey-track'`.
   - `e2e/render-cost.spec.ts`: inside the `for (const path of ['/', '/en/'])` loop, directly after
     `await page.goto(path);` add
     `await page.waitForFunction(() => document.documentElement.dataset.scrollFx !== undefined);`
     (the pinned height only exists once the fx sheet is in; without the wait the measurement would be a race).
9. Create `e2e/journey-pinned.spec.ts`:
   ```ts
   import { test, expect, type Page } from '@playwright/test';

   // C3: pinned horizontal Jornada (desktop, fine pointer, scroll timelines). Carousel mode: journey.spec.ts.
   const ready = async (page: Page, url = '/') => {
     await page.goto(url);
     await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
     await page.evaluate(() => document.documentElement.classList.add('vn-cv-off')); // real heights everywhere
     await expect(page.locator('[data-vn-journey]')).toHaveAttribute('data-ready', '', { timeout: 10_000 }).catch(async () => {
       await page.locator('#jornada').scrollIntoViewIfNeeded(); // journey.ts loads when the section nears
       await expect(page.locator('[data-vn-journey]')).toHaveAttribute('data-ready', '');
     });
   };
   const geo = (page: Page) =>
     page.evaluate(() => {
       const run = document.querySelector<HTMLElement>('.vn-journey-run')!;
       const top = run.getBoundingClientRect().top + scrollY;
       return { top, span: run.offsetHeight - innerHeight, h: run.offsetHeight, vh: innerHeight, vw: document.documentElement.clientWidth };
     });
   const at = async (page: Page, p: number) => {
     const g = await geo(page);
     await page.evaluate(async (y) => {
       scrollTo({ top: y, behavior: 'instant' });
       await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
     }, g.top + p * g.span);
     return g;
   };
   const cardsX = (page: Page) =>
     page.locator('.vn-journey-card').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.right]; }));

   test.describe('journey pinned', () => {
     test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

     test('mode: sticky pin in a tall runway, track on a view timeline, ghost shown, no inner scroller', async ({ page }) => {
       await ready(page);
       const m = await page.evaluate(() => {
         const t = document.querySelector<HTMLElement>('[data-vn-journey]')!;
         const cs = getComputedStyle(t);
         const ghost = document.querySelector<HTMLElement>('.vn-journey-ghost')!;
         return {
           anim: cs.animationName, ox: cs.overflowX, tl: t.getAnimations().some((a) => a.timeline instanceof ViewTimeline),
           pin: getComputedStyle(document.querySelector('.vn-journey-pin')!).position,
           cardAnim: getComputedStyle(document.querySelector('.vn-journey-card')!).animationName,
           ghost: getComputedStyle(ghost).display, ghostHidden: ghost.getAttribute('aria-hidden'),
           scrollable: t.scrollWidth - t.clientWidth,
         };
       });
       expect(m.anim).toBe('vn-jpin');
       expect(m.tl).toBe(true);
       expect(m.ox).toBe('visible');
       expect(m.pin).toBe('sticky');
       expect(m.cardAnim).toBe('none');
       expect(m.ghost).toBe('block');
       expect(m.ghostHidden).toBe('true');
       expect(m.scrollable).toBeLessThanOrEqual(1);
       const g = await geo(page);
       expect(g.h).toBeGreaterThan(g.vh + 1500);
     });

     test('vertical scroll carries the row: first card at the start, last card fully in at the end', async ({ page }) => {
       await ready(page);
       const g = await at(page, 0);
       const lead = await page.locator('#jornada .vn-eyebrow').evaluate((e) => e.getBoundingClientRect().left);
       let xs = await cardsX(page);
       expect(Math.abs(xs[0][0] - lead)).toBeLessThanOrEqual(2);
       expect(xs.at(-1)![1]).toBeGreaterThan(g.vw);
       expect(await page.locator('.vn-journey-pin').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(0);
       await at(page, 0.5);
       const mid = await cardsX(page);
       expect(mid[0][0]).toBeLessThan(xs[0][0] - 300);
       expect(await page.locator('.vn-journey-pin').evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBe(0);
       await at(page, 1);
       xs = await cardsX(page);
       expect(xs.at(-1)![1]).toBeLessThanOrEqual(g.vw + 1); // if this fails after cards were added or removed, fix --j-n in fx/journey-pin.css
       expect(xs.at(-1)![1]).toBeGreaterThan(g.vw - 200);
       expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
     });

     test('counter and bar follow the scroll', async ({ page }) => {
       await ready(page);
       const count = page.locator('[data-journey-count]');
       const bar = () => page.locator('[data-journey-bar]').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).a);
       await at(page, 0);
       await expect(count).toHaveText(/^01 \/ 08$/);
       expect(await bar()).toBeCloseTo(0.125, 1);
       await at(page, 0.5);
       await expect(count).toHaveText(/^0[45] \/ 08$/);
       await at(page, 1);
       await expect(count).toHaveText(/^08 \/ 08$/);
       expect(await bar()).toBeCloseTo(1, 1);
     });

     test('next button and arrow keys scroll the page to the next card', async ({ page }) => {
       await ready(page);
       const g = await at(page, 0);
       await page.locator('[data-journey-next]').click();
       await expect(page.locator('[data-journey-count]')).toHaveText(/^02 \//, { timeout: 4000 });
       await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(g.top + g.span / 7 - 6);
       await page.locator('[data-vn-journey]').focus();
       await page.keyboard.press('ArrowRight');
       await expect(page.locator('[data-journey-count]')).toHaveText(/^03 \//, { timeout: 4000 });
       await page.keyboard.press('ArrowLeft');
       await expect(page.locator('[data-journey-count]')).toHaveText(/^02 \//, { timeout: 4000 });
       expect(await page.locator('[data-vn-journey]').evaluate((e) => e.scrollLeft)).toBe(0);
     });

     test('mouse drag scrolls the page, a vertical wheel over the row scrolls the page', async ({ page }) => {
       await ready(page);
       const g = await at(page, 0.2);
       const y0 = await page.evaluate(() => scrollY);
       const box = (await page.locator('.vn-journey-card').nth(2).boundingBox())!;
       await page.mouse.move(box.x + 40, box.y + 80);
       await page.mouse.down();
       await page.mouse.move(box.x - 260, box.y + 80, { steps: 8 });
       await page.mouse.up();
       const travel = await page.locator('[data-vn-journey]').evaluate((e) => (e as HTMLElement).offsetWidth - innerWidth);
       const want = y0 + 300 * (g.span / travel);
       await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(want - 40);
       expect(await page.evaluate(() => scrollY)).toBeLessThan(want + 40);
       const y1 = await page.evaluate(() => scrollY);
       await page.mouse.wheel(0, 300);
       await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y1 + 100);
     });

     test('header ground and active nav link stay on Jornada through the pin; a later anchor lands', async ({ page }) => {
       await ready(page);
       await page.waitForSelector('.vn-navbar[data-flip]');
       await at(page, 0.5);
       await expect.poll(() => page.evaluate(() => {
         const nav = document.querySelector<HTMLElement>('.vn-navbar')!;
         return nav.style.getPropertyValue('--vn-surface') === getComputedStyle(document.querySelector('#jornada')!).backgroundColor;
       })).toBe(true);
       await expect(page.locator('.vn-navbar__link[data-nav-hash="jornada"]')).toHaveClass(/is-active/);
       await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
       await page.locator('.vn-navbar__link[data-nav-hash="projetos"]').click();
       await expect.poll(() => page.evaluate(() => {
         const r = document.getElementById('projetos')!.getBoundingClientRect();
         return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.15;
       }), { timeout: 10_000 }).toBe(true);
     });

     test('english has the same pinned chapter', async ({ page }) => {
       await ready(page, '/en/');
       expect(await page.locator('[data-vn-journey]').evaluate((e) => getComputedStyle(e).animationName)).toBe('vn-jpin');
       await expect(page.locator('.vn-journey-ghost')).toHaveText(/journey/i);
     });
   });

   test.describe('journey pinned: fallbacks keep the carousel', () => {
     const carousel = async (page: Page) => {
       const t = page.locator('[data-vn-journey]');
       expect(await t.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
       expect(await t.evaluate((e) => getComputedStyle(e).overflowX)).toBe('auto');
       await expect(page.locator('.vn-journey-ghost')).toBeHidden();
       expect(await page.locator('.vn-journey-pin').evaluate((e) => getComputedStyle(e).position)).toBe('static');
     };

     test('reduced motion', async ({ browser }) => {
       const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
       const page = await ctx.newPage();
       await page.goto('/');
       await page.waitForTimeout(1200);
       await carousel(page);
       await ctx.close();
     });

     test('no scroll timelines (CSS.supports stub)', async ({ browser }) => {
       const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
       const page = await ctx.newPage();
       await page.addInitScript(() => {
         const s = CSS.supports.bind(CSS);
         CSS.supports = ((a: string, b?: string) => (/animation-timeline/.test(a) ? false : b === undefined ? s(a) : s(a, b))) as typeof CSS.supports;
       });
       await page.goto('/');
       await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('base');
       await carousel(page);
       await ctx.close();
     });

     test('touch, narrow and short windows', async ({ browser }) => {
       for (const opts of [
         { viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true },
         { viewport: { width: 1024, height: 900 } },
         { viewport: { width: 1440, height: 600 } },
       ]) {
         const ctx = await browser.newContext({ reducedMotion: 'no-preference', baseURL: test.info().project.use.baseURL, ...opts });
         const page = await ctx.newPage();
         await page.goto('/');
         await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
         await carousel(page);
         await ctx.close();
       }
     });

     test('no JS', async ({ browser }) => {
       const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
       const page = await ctx.newPage();
       await page.goto('/');
       await carousel(page);
       await ctx.close();
     });
   });
   ```
   If step 7 raised the minimum height above 900, raise the viewport height of the first describe to that value
   plus 60.
10. Gate; `npx playwright test e2e/journey-pinned.spec.ts e2e/journey.spec.ts e2e/moments.spec.ts
    e2e/lines-reveal.spec.ts e2e/render-cost.spec.ts e2e/handoffs.spec.ts e2e/header-ground.spec.ts e2e/gates.spec.ts
    e2e/a11y.spec.ts e2e/choreography.spec.ts e2e/sections.spec.ts e2e/cursor-zones.spec.ts e2e/scroll-fx.spec.ts
    e2e/rail.spec.ts`. If `rail.spec.ts` fails on "gone before the red band", apply C5 step 5 (the page is now
    taller). Then both Lighthouse runs (C2 step 4) must exit 0. Ledger row.

**Reduced motion, no JS, touch.** All three keep the carousel exactly as today (see "How pinned mode is decided").
The only change they see is the controls row sitting directly above the cards instead of beside the heading.

**Bytes.** HTML plus about 70 B gz; inline plus about 25 B; `scroll-fx` plus about 420 B gz; `journey` plus about
330 B gz.

**Pitfalls.**
1. R8: `#jornada` has paint containment, so the wide track cannot cause horizontal page overflow; the pin's
   `overflow: clip` also clips the ghost. Never use `overflow: hidden` on the pin or the run: it would create a scroll
   container and the sticky child would stop sticking to the viewport.
2. R3: `#jornada` (`u-shut`), its first container (`u-drift`) and the cards already animate. This task animates
   the track, the bar's span and the ghost, none of which had an animation, and turns the cards' animation off by
   name with a more specific selector (`html.js #jornada .vn-journey-card`) so the two existing rules lose.
3. `src/styles/fx/moments.css` adds bottom padding and a negative margin to `.vn-journey-track` for the cards' entry
   offset; the pinned rule resets both through its higher specificity (`#jornada .vn-journey-track`). Leave
   `moments.css` alone.
4. `100vw` includes a classic scrollbar (about 15 px on Windows): at the end of the pin the last card's right
   padding is that much narrower. Accepted; do not chase it with JS.
5. `journey.ts` loads only when `#jornada` is within one viewport, and the fx sheet may arrive before or after it.
   That is why `mode()` also runs from a `MutationObserver` on `data-scroll-fx`.
6. `--ci` in the fx file overrides the inline seed only while the fx sheet is adopted, which is exactly when the
   section is tall. Before the sheet arrives the inline seed is right. Do not copy the pinned seed into
   `render-cost.css`.
7. The `u-shut` entry clip on `#jornada` runs over the first viewport of entry and is `backwards`-filled, so it is
   gone long before the pin starts.
8. B4 (smooth wheel) calls nothing here, but its scroll writes pass through the pin; its spec tests that.
9. If a card is ever added, the last test of "vertical scroll carries the row" tells you to update `--j-n`.

**Done when.**
- `e2e/journey-pinned.spec.ts` green (12 tests), the adapted specs green, the rest of step 10 green.
- Both Lighthouse runs exit 0.
- Frame captures at 1440 x 900, both themes, every 400 px of scroll through the section: head scrolls out, the row
  sticks under the header, cards slide left at a steady rate, the ghost word drifts slower, the bar fills, then the
  archive block scrolls in. At 390 and with reduced motion: the swipe carousel as before.

**Commit.** `feat(journey): pinned horizontal chapter driven by vertical scroll on desktop`

---

## B3. Page transition: cover, counter, reveal, with the thumbnail morph kept

**Risk: medium. Droppable:** revert the commit; C2's `--t0` default of `0s` then applies.

**Goal.** lamalama's route change, done with cross-document view transitions and no navigation hijacking. When an
in-site link is followed and the next document is ready: the old page is wiped away upward over 0.65 s (sine-out),
leaving an ink ground; a large counter runs from 0 to 100 at the bottom left; after a 0.25 s hold the new page is
revealed from the bottom up over 0.65 s (quart-out). Total 1.55 s. On home to case and case to home the project
thumbnail still flies to the case hero image, above the ink, over 1.2 s.

**How it is scoped away from the theme toggle.** The theme toggle (`src/scripts/theme.ts`) starts a *same-document*
view transition and adopts its own unlayered rules on `::view-transition-old(root)` / `-new(root)`. Our new rules
must never apply to it. Two independent locks:
1. The at-rule declares a type: `@view-transition { navigation: auto; types: nav; }`. Every new pseudo-element rule
   is prefixed with `:root:active-view-transition-type(nav)`. `document.startViewTransition()` in `theme.ts` passes
   no types, so the selector does not match during a theme toggle.
2. The counter is shown through a class, `html.vn-vt`, that the inline head script sets in a `pagereveal` listener
   only when the event carries a `viewTransition`, and removes when that transition finishes.

**Support and fallback.** Cross-document view transitions with typed at-rules: Chrome and Edge 126+, Safari 18.2+.
Firefox has no cross-document transitions: plain navigation, nothing shown. A browser that has cross-document
transitions but not `:active-view-transition-type()` drops the typed rules as invalid selectors and gets today's
250 ms fade and 450 ms morph, which stay in the sheet untyped. Reduced motion: the at-rule is inside
`prefers-reduced-motion: no-preference`, so no transition at all.

**Files.** `src/styles/sections/transitions.css` (rewritten), `src/layouts/Base.astro`, `e2e/projects.spec.ts` (three
new tests), this file.

**Do not change.** `src/scripts/theme.ts`; the six `[data-vt="..."]` rules; `data-vt` in `Projects.astro` and
`CaseStudyPage.astro`; `astro.config.mjs` (it hashes the inline head script from the source by itself). Do not give
`.vn-navbar` a `view-transition-name` (it would float above the cover with the wrong colours; decided against).

**Steps.**

1. Replace the whole of `src/styles/sections/transitions.css` with:
   ```css
   /* Page transitions: cross-document view transitions, motion-safe only. The at-rule declares the type "nav";
      every rule for the long transition is scoped with :active-view-transition-type(nav), so the theme toggle's
      same-document transition (src/scripts/theme.ts, no types) never matches them. */
   @media (prefers-reduced-motion: no-preference) {
     @view-transition {
       navigation: auto;
       types: nav;
     }
   }

   /* Integer behind the 0-100 counter. Top level and unlayered, so it is registered before any script runs. */
   @property --vn-n {
     syntax: "<integer>";
     inherits: false;
     initial-value: 0;
   }

   @layer site {
     /* The counter element (Base.astro) exists on every page and shows only while html.vn-vt is set. */
     .vn-vt-count { display: none; }

     @media (prefers-reduced-motion: no-preference) {
       /* Engines without typed transitions: the short fade and morph, as before. */
       ::view-transition-old(root),
       ::view-transition-new(root) {
         animation-duration: 250ms;
       }

       ::view-transition-group(*) {
         animation-duration: 450ms;
         animation-timing-function: var(--vn-ease-out);
       }

       /* Typed navigation: 0.65s cover (sine-out), 0.25s hold, 0.65s reveal (quart-out) = 1.55s.
          41.9% = 0.65 / 1.55 and 58.1% = 0.90 / 1.55. */
       :root:active-view-transition-type(nav)::view-transition,
       :root:active-view-transition-type(nav)::view-transition-group(root) {
         background: #0a0a0a;
       }

       :root:active-view-transition-type(nav)::view-transition-old(root) {
         animation: vn-nav-out 1.55s linear both;
         mix-blend-mode: normal;
       }

       :root:active-view-transition-type(nav)::view-transition-new(root) {
         animation: vn-nav-in 1.55s linear both;
         mix-blend-mode: normal;
       }

       /* The shared thumbnail flies above the ink for most of the transition. */
       :root:active-view-transition-type(nav)::view-transition-group(*) {
         animation-duration: 1.2s;
         animation-timing-function: cubic-bezier(.76, 0, .24, 1);
       }

       @keyframes vn-nav-out {
         from { clip-path: inset(0); animation-timing-function: cubic-bezier(.61, 1, .88, 1); }
         41.9%, to { clip-path: inset(0 0 100% 0); }
       }

       @keyframes vn-nav-in {
         from, 58.1% { clip-path: inset(100% 0 0 0); animation-timing-function: cubic-bezier(.25, 1, .5, 1); }
         to { clip-path: inset(0); }
       }

       /* Counter: a live element of the new document with its own transition name. A new-state image is live, so
          the CSS counter keeps running inside it. */
       html.vn-vt { --t0: .9s; } /* the hero opening (C2) waits for the reveal */

       html.vn-vt .vn-vt-count {
         display: block;
         position: fixed;
         left: 5vw;
         bottom: 5vh;
         z-index: 300;
         view-transition-name: vn-count;
         font: italic 900 clamp(4rem, 14vw, 12rem) / 1 var(--vn-font-display);
         color: #f4ead4;
         counter-reset: n var(--vn-n);
         animation: vn-count .9s cubic-bezier(.25, 1, .5, 1) both;
       }

       .vn-vt-count::after { content: counter(n); }

       :root:active-view-transition-type(nav)::view-transition-new(vn-count) {
         animation: vn-count-o 1.55s linear both;
       }

       @keyframes vn-count { to { --vn-n: 100; } }

       @keyframes vn-count-o {
         from { opacity: 0; }
         12%, 56% { opacity: 1; }
         68%, to { opacity: 0; }
       }
     }

     /* Static per-slug names (CSP forbids inline styles). Row thumbnail and case hero image share them. */
     [data-vt="mte"] { view-transition-name: project-mte; }
     [data-vt="dashboards"] { view-transition-name: project-dashboards; }
     [data-vt="caato"] { view-transition-name: project-caato; }
     [data-vt="mota-godinho"] { view-transition-name: project-mota-godinho; }
     [data-vt="boas-obras"] { view-transition-name: project-boas-obras; }
     [data-vt="midflow"] { view-transition-name: project-midflow; }
   }
   ```
2. `src/layouts/Base.astro`, inline head script (lines 149 to 162). Inside the IIFE, directly after the line
   `document.documentElement.classList.add('js');`, add (no comments inside the script: they would be shipped):
   ```js
         addEventListener('pagereveal', (e) => {
           if (!e.viewTransition) return;
           document.documentElement.classList.add('vn-vt');
           e.viewTransition.finished.finally(() => document.documentElement.classList.remove('vn-vt'));
         });
   ```
   Above the `<script is:inline>` tag add the Astro comment
   `{/* pagereveal: marks the document while a navigation view transition reveals it (page counter, hero delay). */}`.
3. `src/layouts/Base.astro`, line 268 today is `<script>import '../scripts/main.ts';</script>`. Directly before it
   add:
   ```astro
     <div class="vn-vt-count" aria-hidden="true"></div>
   ```
4. Tests, appended to `e2e/projects.spec.ts`:
   ```ts
   const record = () => {
     addEventListener('pagereveal', (e) => {
       const vt = (e as unknown as { viewTransition?: { types: Set<string>; ready: Promise<void> } }).viewTransition;
       sessionStorage.setItem('vtTypes', vt ? [...vt.types].join(',') : 'none');
       vt?.ready.then(() =>
         sessionStorage.setItem('vtAnims', document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? '').join(',')),
       );
     });
   };

   test('navigation transition is typed: cover, counter and reveal run, then everything is cleared', async ({ page }) => {
     await page.addInitScript(record);
     await page.setViewportSize({ width: 1366, height: 800 });
     await page.goto('/');
     const row = page.locator('.vn-project-row[href="/projetos/caato/"]');
     await row.scrollIntoViewIfNeeded();
     await row.click();
     await page.waitForURL('**/projetos/caato/');
     await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vtTypes'))).toBe('nav');
     await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vtAnims') ?? '')).toContain('vn-nav-in');
     const anims = (await page.evaluate(() => sessionStorage.getItem('vtAnims')))!;
     expect(anims).toContain('vn-nav-out');
     expect(anims).toContain('vn-count');
     // afterwards: class gone, counter hidden, page usable
     await expect(page.locator('html')).not.toHaveClass(/vn-vt/, { timeout: 5000 });
     await expect(page.locator('.vn-vt-count')).toBeHidden();
     await expect(page.locator('h1')).toBeVisible();
   });

   test('the theme toggle keeps its own reveal: no navigation rules, no counter', async ({ page }) => {
     await page.setViewportSize({ width: 1366, height: 800 });
     await page.goto('/projetos/caato/');
     const names = () => page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? ''));
     await page.locator('#vn-theme-toggle').click();
     await expect.poll(async () => (await names()).some((n) => n === 'vn-dusk' || n === 'vn-dawn')).toBe(true);
     const seen = await names();
     expect(seen).not.toContain('vn-nav-in');
     expect(seen).not.toContain('vn-nav-out');
     expect(seen).not.toContain('vn-count');
     await expect(page.locator('html')).not.toHaveClass(/vn-vt/);
     await expect(page.locator('.vn-vt-count')).toBeHidden();
   });

   test.describe('reduced motion', () => {
     test.use({ reducedMotion: 'reduce' });
     test('navigation has no view transition', async ({ page }) => {
       await page.addInitScript(record);
       await page.goto('/');
       const row = page.locator('.vn-project-row[href="/projetos/caato/"]');
       await row.scrollIntoViewIfNeeded();
       await row.click();
       await page.waitForURL('**/projetos/caato/');
       await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vtTypes'))).toBe('none');
       await expect(page.locator('.vn-vt-count')).toBeHidden();
     });
   });
   ```
   (`test.describe('reduced motion', ...)` already exists once in that file; add the new test inside the existing
   block instead of opening a second one.)
5. Run the existing guard tests for the toggle: `npx playwright test e2e/theme.spec.ts e2e/themes-rhythm.spec.ts
   e2e/thorough-themes.spec.ts e2e/interactions.spec.ts`. They must pass without edits; that is the proof the toggle
   is unchanged ("to dark runs vn-dusk and vn-spin", "to light runs vn-dawn", "no view-transition animation and the
   switch is instant").
6. Visual check of the cover colour (the one thing a test cannot see): in Chrome DevTools, Animations panel, set
   speed to 10%, click a project row. Between the wipe and the reveal the screen must be ink (`#0a0a0a`) with the
   thumbnail flying and the cream counter at the bottom left. If the ground shows the page colour instead of ink,
   neither pseudo-element painted its background: report it; do not replace the mechanism.
7. Gate; `npx playwright test e2e/projects.spec.ts e2e/case-scroll.spec.ts e2e/gates.spec.ts e2e/a11y.spec.ts
   e2e/seo.spec.ts e2e/hero.spec.ts`; `npm test` (it includes the CSP tests on `dist`). Ledger row.

**Reduced motion, no JS, touch.** Reduced motion: none. No JS: the transition still runs (it is CSS), without the
counter and without the hero delay (the class is set by script). Touch: same as desktop.

**Bytes.** Home `inlineCss` plus about 330 B gz; HTML plus about 420 B gz in total (CSS, head script, counter
element). If home `html=` passes 32500, apply trim 2 under "Budgets": delete the `@property` rule, the
`html.vn-vt .vn-vt-count` rule, the two `.vn-vt-count` rules, the `::view-transition-new(vn-count)` rule, both counter
keyframes, the counter element and the `vn-count` assertion; keep the head script (the hero delay uses it).

**Pitfalls.**
1. Do not use `:active-view-transition-type(nav)` to show the counter. That selector also matches in the *outgoing*
   document while it is captured, and the counter would be painted on the old page and frozen on screen until the
   next page arrives. The class from `pagereveal` exists only in the incoming document.
2. `e2e/projects.spec.ts` ("built CSS: @view-transition only inside the no-preference block") parses the built CSS:
   the at-rule must stay directly inside the `@media (prefers-reduced-motion: no-preference)` block, as written.
3. The old rules for `::view-transition-old(root)` and `-new(root)` (250 ms) stay untyped as the fallback. Because
   the theme sheet in `theme.ts` is unlayered it keeps beating them, as today.
4. `@property` must stay at the top level of the file. Inside `@layer` or `@media` some engines ignore it, and the
   counter would then jump from 0 to 100.
5. Every in-site navigation now takes 1.55 s, including the language switch, the case pager and Back. To shorten
   it later, change the three `1.55s` values and the two percentages together; to remove the hold only, use `1.3s`,
   `50%` and `50%`.
6. `document.getAnimations()` lists animations on view-transition pseudo-elements; `themes-rhythm.spec.ts` already
   relies on that.
7. R10: the head script stays one `<script is:inline>` block. After the build, `npm test` checks the CSP hashes.

**Done when.** The three new tests green; the toggle specs of step 5 green without edits; step 6 observed; gate
green.

**Commit.** `feat(transitions): typed page transition with cover, counter and reveal`

---

## C1. Preloader on the first home visit of a session

**Risk: high (Speed Index). Droppable:** revert the commit; the hero opening (C2) is then the whole intro.

**Goal.** Era opens behind a curtain. Ours, on the first page of a browser session when that page is the home: an
ink curtain covers the viewport at the first frame; two mono words slide apart from the centre while a hairline
between them draws; after 0.25 s the curtain lifts upward with an arched lower edge over 0.65 s, and the hero
opening (C2) plays as it clears. The page underneath is fully painted from the first frame, so LCP is not delayed
(LCP does not consider occlusion). What it can hurt is Lighthouse's Speed Index, which measures what is visible:
hence the short timings and the measured decision rule below.

It is honest: shown once per session, on a first visit, to everyone including test tools. Nothing detects
Lighthouse or automation.

**Files.** `src/layouts/Base.astro`, `src/styles/sections/hero.css`, new `e2e/preloader.spec.ts`, this file. After C2.

**Do not change.** The hero markup; `after-lcp.ts`; anything that would hide or delay the content under the
curtain (no `opacity`, `visibility` or `display` change on `main`, the navbar or the hero).

**Steps.**

1. `src/layouts/Base.astro`, line 117 today: `<html lang={htmlLang}>` becomes
   ```astro
   <html lang={htmlLang} data-pre={isHome ? '' : undefined}>
   ```
2. Same file, inline head script. After the closing `}` of the existing `try { ... } catch { ... }` statement and
   before the `})();` line, add:
   ```js
         try {
           if (!sessionStorage.getItem('vn-seen')) {
             sessionStorage.setItem('vn-seen', '1');
             if ('pre' in document.documentElement.dataset && !matchMedia('(prefers-reduced-motion:reduce)').matches) document.documentElement.classList.add('vn-pre');
           }
         } catch {}
   ```
   (Its own `try`: the existing `catch` resets the theme to light, which must not happen because storage threw
   here.)
3. Same file, directly after the skip link (line 168, `<a class="vn-skip-link" ...>`), add:
   ```astro
     {isHome && (
       <div class="vn-pre" aria-hidden="true"><b>Victor</b><i></i><b>Neves</b></div>
     )}
   ```
4. `src/styles/sections/hero.css`: before the closing `}` of `@layer site` (after the C2 block) add:
   ```css
     /* C1 preloader: first home visit of a session (class vn-pre from the head script). The page under it is
        painted from the first frame; the curtain only covers it, then lifts with an arched lower edge. */
     .vn-pre { display: none; }

     @media (prefers-reduced-motion: no-preference) {
       html.vn-pre { --t0: .45s; } /* the hero opening starts as the curtain clears */

       html.vn-pre .vn-pre {
         position: fixed;
         inset: 0;
         z-index: 300;
         display: flex;
         align-items: center;
         justify-content: center;
         gap: 1.5rem;
         background: #0a0a0a;
         color: #f4ead4;
         pointer-events: none;
         font: 500 .8125rem / 1 var(--vn-font-mono);
         letter-spacing: .3em;
         text-transform: uppercase;
         animation: vn-pre-up .65s cubic-bezier(.5, 0, .1, 1) .25s forwards;
       }

       .vn-pre b { font-weight: 500; animation: vn-pre-l .9s cubic-bezier(.25, 1, .5, 1) both; }
       .vn-pre b:last-child { animation-name: vn-pre-r; }
       .vn-pre i { width: 12vw; height: 1px; background: currentColor; transform-origin: 0 50%; animation: vn-pre-bar .5s cubic-bezier(.25, 1, .5, 1) both; }

       @keyframes vn-pre-up {
         from { clip-path: inset(0 round 0); }
         to { clip-path: inset(0 0 100% 0 round 0 0 50% 50% / 0 0 16vh 16vh); visibility: hidden; }
       }
       @keyframes vn-pre-l { to { translate: -9vw 0; } }
       @keyframes vn-pre-r { to { translate: 9vw 0; } }
       @keyframes vn-pre-bar { from { scale: 0 1; } }
     }
   ```
5. Create `e2e/preloader.spec.ts`:
   ```ts
   import { test, expect } from '@playwright/test';

   test.describe('preloader', () => {
     test.use({ viewport: { width: 1366, height: 800 }, reducedMotion: 'no-preference' });

     for (const route of ['/', '/en/']) {
       test(`first home visit ${route}: curtain at the first frame, content painted under it, gone within 1.5s`, async ({ page }) => {
         await page.goto(route, { waitUntil: 'commit' });
         await page.waitForSelector('html.vn-pre');
         const first = await page.evaluate(() => {
           const pre = document.querySelector('.vn-pre')!;
           const cs = getComputedStyle(pre);
           const h1 = document.querySelector('h1.vn-hero__title')!;
           return { display: cs.display, pe: cs.pointerEvents, hidden: pre.getAttribute('aria-hidden'), h1Opacity: getComputedStyle(h1).opacity, h1Vis: getComputedStyle(h1).visibility };
         });
         expect(first.display).toBe('flex');
         expect(first.pe).toBe('none');
         expect(first.hidden).toBe('true');
         expect(first.h1Opacity).toBe('1');
         expect(first.h1Vis).toBe('visible');
         await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.vn-pre')!).visibility), { timeout: 3000 }).toBe('hidden');
         // LCP was recorded while the curtain was still up: the content was painted under it
         const lcp = await page.evaluate(() => new Promise<number>((res) => {
           new PerformanceObserver((l) => res(l.getEntries().at(-1)!.startTime)).observe({ type: 'largest-contentful-paint', buffered: true });
         }));
         expect(lcp).toBeLessThan(900);
         // the page is usable: a click goes through to the hero
         await page.locator('.vn-hero__actions a').first().click();
       });
     }

     test('second page view in the same session: no curtain', async ({ page }) => {
       await page.goto('/');
       await page.waitForSelector('html.vn-pre');
       await page.reload();
       await page.waitForLoadState('domcontentloaded');
       expect(await page.evaluate(() => document.documentElement.classList.contains('vn-pre'))).toBe(false);
       await expect(page.locator('.vn-pre')).toBeHidden();
     });

     test('a session that starts on another page never shows it', async ({ page }) => {
       await page.goto('/privacidade/');
       await expect(page.locator('.vn-pre')).toHaveCount(0);
       await page.goto('/');
       expect(await page.evaluate(() => document.documentElement.classList.contains('vn-pre'))).toBe(false);
     });

     test('reduced motion and no JS: no curtain', async ({ browser }) => {
       for (const opts of [{ reducedMotion: 'reduce' as const }, { javaScriptEnabled: false }]) {
         const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, ...opts });
         const page = await ctx.newPage();
         await page.goto('/');
         await expect(page.locator('.vn-pre')).toBeHidden();
         await ctx.close();
       }
     });
   });
   ```
6. Run the whole e2e suite once (`npx playwright test`): every test that opens the home in a fresh context now
   starts under a 0.9 s curtain. It has `pointer-events: none`, so clicks and hovers pass through. If a test that
   takes a screenshot or compares pixels in the first second fails, add to that test, before `goto`,
   `await page.addInitScript(() => sessionStorage.setItem('vn-seen', '1'));` and a comment
   `// start as a returning visitor: no preloader`. Do not add it globally.
7. Lighthouse decision rule. Run both forms (C2 step 4), each of them twice. Read `speed-index` and `performance`
   for `/` and `/en/` from the six desktop and six mobile reports.
   - Pass: both commands exit 0 on both rounds, and the median desktop Speed Index of `/` is at most 800 ms.
   - If it fails: (a) set the delay `.25s` to `0s` and the duration `.65s` to `.5s`, and `--t0` to `.2s`; re-run.
     (b) If it still fails: change the timing function to `cubic-bezier(.16, 1, .3, 1)` (the lift is then
     front-loaded); re-run. (c) If it still fails: revert the task (all five steps) and report the numbers; C2 alone
     is the intro.
   Write the measured numbers and which variant shipped into the ledger row's Notes.

**Reduced motion, no JS, touch.** Reduced motion: the head script does not set the class, and the rules are inside
`no-preference`. No JS: the class is never set; `.vn-pre { display: none }`. Touch: same as desktop.

**Bytes.** Home `inlineCss` plus about 290 B gz; home HTML plus about 470 B gz in total (CSS, markup, head script).
If home `html=` passes 32500, apply trim 3 under "Budgets" (remove the two `<b>` elements and their three rules).

**Pitfalls.**
1. The words must stay small. A large text block in the curtain would become the LCP element and could change the
   LCP time.
2. Without the explicit `from` in `vn-pre-up`, `clip-path` cannot interpolate from `none` and the curtain would
   vanish in one frame.
3. `visibility: hidden` in the last keyframe switches at the very end (visibility interpolates as "visible until
   1"), and `forwards` keeps it. That removes the curtain from hit-testing and from screenshots without any script.
4. The curtain's `z-index: 300` is above the navbar (50) and the drawer (200) and below the cursor (9999).
5. B3 sets `--t0: .9s` on `html.vn-vt`; a document cannot be both (a navigation arrival is never the first page of
   a session), so the two values never compete.
6. R10: one `<script is:inline>` block, no comments inside it.

**Done when.** `e2e/preloader.spec.ts` green; full e2e suite green; the Lighthouse rule of step 7 passes with the
variant recorded; manual frames at 0, 0.3, 0.6, 0.9 s, 1440 and 390, both themes.

**Commit.** `feat(intro): session-first preloader curtain on the home page`

---

## B4. Smooth wheel on fine pointers

**Risk: high (interaction). Droppable:** revert the commit; nothing depends on it.

**Goal.** lamalama runs Lenis: each wheel notch eases the page toward its target with `1 - 2^(-10 t)` over about 1 s.
We hand-write the same feel for mouse wheels only: a wheel event moves a target, and each frame the page covers a
fixed fraction of the remaining distance (time constant 144 ms, which is that curve). Everything else stays native:
touch, trackpads and precision wheels (small deltas), keyboard, scrollbar drag, anchor jumps, find-in-page, Ctrl
or Shift wheel, and wheels over anything that scrolls on its own.

**Loading.** The module is imported on the first `wheel` event of a fine-pointer, motion-allowed visitor (that first
notch scrolls natively). Lighthouse never wheels, so it pays nothing, and the non-passive wheel listener the
technique needs is never present during an audit.

**Kill switches.** `localStorage.setItem('vn-smooth', '0')` turns it off for a visitor at once (checked on each
wheel). `data-native-scroll` on any element makes wheels over it native. To disable it for everyone, delete the
registration line in `main.ts` (step 2).

**Files.** New `src/scripts/smooth.ts`; `src/scripts/main.ts`; `budget.json`; `e2e/gates.spec.ts` (regex); new
`e2e/smooth-wheel.spec.ts`; this file.

**Do not change.** `journey.ts`; `nav.ts`; any CSS (the brand's `scroll-behavior: smooth` on `html` stays; this
module always scrolls with `behavior: 'instant'`).

**Steps.**

1. Create `src/scripts/smooth.ts`:
   ```ts
   // B4: smooth mouse wheel (side-effect module, loaded by the first wheel event on fine pointers, see main.ts).
   // A wheel notch moves a target; each frame the page covers a fixed share of what is left: 1 - e^(-dt / TAU),
   // the same curve as Lenis's 1 - 2^(-10 t) over one second. Only real mouse wheels are smoothed.
   const TAU = 144; // ms
   const MIN_DELTA = 40; // px per event; smaller steps come from a trackpad or a precision wheel: left native
   const mq = matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)');
   const dbg = location.search.includes('vn-debug');

   let target = 0; // where the page is heading
   let cur = 0; // where we last put it (fractional)
   let set = -1; // scrollY right after our last write, -1 while idle
   let raf = 0;
   let last = 0;

   const max = () => document.documentElement.scrollHeight - innerHeight;
   const flag = () => {
     if (dbg) (window as unknown as Record<string, unknown>).__vnSmooth = !!raf;
   };
   const disabled = () => {
     try {
       return localStorage.getItem('vn-smooth') === '0';
     } catch {
       return false;
     }
   };

   // True when the wheel is over something that can scroll by itself in that direction, or that opted out.
   function inner(t: EventTarget | null, dy: number): boolean {
     for (let n = t as Element | null; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
       if (n.hasAttribute('data-native-scroll')) return true;
       if (n.scrollHeight > n.clientHeight + 1) {
         const o = getComputedStyle(n).overflowY;
         if ((o === 'auto' || o === 'scroll') && (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true;
       }
     }
     return false;
   }

   function stop(): void {
     cancelAnimationFrame(raf);
     raf = 0;
     set = -1;
     flag();
   }

   function tick(now: number): void {
     const dt = Math.min(64, now - last);
     last = now;
     target = Math.min(Math.max(target, 0), max()); // the page may have grown or shrunk (deferred sections)
     cur += (target - cur) * (1 - Math.exp(-dt / TAU));
     if (Math.abs(target - cur) < 0.5) cur = target;
     scrollTo({ top: cur, behavior: 'instant' });
     set = scrollY;
     if (cur === target) return stop();
     raf = requestAnimationFrame(tick);
   }

   function onWheel(e: WheelEvent): void {
     if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.deltaMode === 2) return;
     const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
     // horizontal intent, a trackpad-sized step, the kill switch, an open dialog or an inner scroller: stay native
     if (Math.abs(e.deltaX) > Math.abs(dy) || Math.abs(dy) < MIN_DELTA || disabled() || document.querySelector('dialog[open]') || inner(e.target, dy)) {
       if (raf) stop();
       return;
     }
     e.preventDefault();
     if (!raf) {
       cur = target = scrollY;
       last = performance.now();
       raf = requestAnimationFrame(tick);
       flag();
     }
     target += dy;
   }

   // A scroll we did not write while animating (scroll anchoring when a deferred section renders above, a
   // programmatic jump) shifts the animation by the same amount instead of fighting it.
   function onScroll(): void {
     if (!raf || set < 0) return;
     const d = scrollY - set;
     if (Math.abs(d) > 1) {
       cur += d;
       target += d;
       set = scrollY;
     }
   }

   const opts = { passive: false } as const;
   function on(): void {
     addEventListener('wheel', onWheel, opts);
     addEventListener('scroll', onScroll, { passive: true });
     // the visitor took over: keys (arrows, space, page keys, find), a press (scrollbar, link, drag), a hash jump
     addEventListener('keydown', stop);
     addEventListener('pointerdown', stop);
     addEventListener('hashchange', stop);
   }
   function off(): void {
     stop();
     removeEventListener('wheel', onWheel, opts);
     removeEventListener('scroll', onScroll);
     removeEventListener('keydown', stop);
     removeEventListener('pointerdown', stop);
     removeEventListener('hashchange', stop);
   }

   if (mq.matches) on();
   mq.addEventListener('change', () => (mq.matches ? on() : off()));
   export {};
   ```
2. `src/scripts/main.ts`: at the end of the `// --- module registrations ---` block, after the `magnetic` line, add:
   ```ts
     // B4: smooth mouse wheel, loaded by the first wheel event on fine pointers (that first notch stays native).
     motionOK() && addEventListener('wheel', () => motionOK() && void import('./smooth'), { once: true, passive: true });
   ```
3. `budget.json`: add `"smooth": 768` to `lazyChunks`.
4. `e2e/gates.spec.ts`, the reduced-motion test: in the regex
   `/\/_astro\/(cursor|cursor-trail|magnetic|signal-field|hero-fx|scroll-fx)\./` add `|smooth` after `scroll-fx`.
5. Create `e2e/smooth-wheel.spec.ts`:
   ```ts
   import { test, expect, type Page } from '@playwright/test';

   const CHUNK = /\/_astro\/smooth\./;
   const track = (page: Page) => {
     const hits: string[] = [];
     page.on('request', (r) => CHUNK.test(r.url()) && hits.push(r.url()));
     return hits;
   };
   const y = (page: Page) => page.evaluate(() => scrollY);
   const running = (page: Page) => page.evaluate(() => (window as unknown as { __vnSmooth?: boolean }).__vnSmooth === true);
   // first notch loads the module (and scrolls natively); wait for the page to rest
   const arm = async (page: Page) => {
     await page.mouse.move(700, 400);
     await page.mouse.wheel(0, 100);
     await page.waitForResponse((r) => CHUNK.test(r.url()));
     let prev = -1;
     await expect.poll(async () => { const v = await y(page); const same = v === prev; prev = v; return same; }, { intervals: [150] }).toBe(true);
   };

   test.describe('smooth wheel', () => {
     test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });

     test('lazy: nothing before the first wheel, loaded by it', async ({ page }) => {
       const hits = track(page);
       await page.goto('/?vn-debug');
       await page.waitForLoadState('networkidle');
       await page.mouse.move(700, 400);
       await page.mouse.move(720, 420);
       await page.waitForTimeout(500);
       expect(hits).toEqual([]);
       await arm(page);
       expect(hits.length).toBe(1);
     });

     test('a wheel notch eases the page to exactly its target', async ({ page }) => {
       await page.goto('/?vn-debug');
       await arm(page);
       const y0 = await y(page);
       await page.mouse.wheel(0, 400);
       await page.waitForTimeout(60);
       const mid = await y(page);
       expect(mid).toBeGreaterThan(y0);
       expect(mid).toBeLessThan(y0 + 380); // still on its way after 60 ms
       expect(await running(page)).toBe(true);
       await expect.poll(() => running(page), { timeout: 4000 }).toBe(false);
       expect(Math.abs((await y(page)) - (y0 + 400))).toBeLessThanOrEqual(1);
     });

     test('small deltas (trackpad), Shift and Ctrl wheels stay native', async ({ page }) => {
       await page.goto('/?vn-debug');
       await arm(page);
       await page.mouse.wheel(0, 20);
       expect(await running(page)).toBe(false);
       await page.keyboard.down('Shift');
       await page.mouse.wheel(0, 300);
       await page.keyboard.up('Shift');
       expect(await running(page)).toBe(false);
     });

     test('keys and anchor links take over at once and land where they should', async ({ page }) => {
       await page.goto('/?vn-debug');
       await arm(page);
       await page.mouse.wheel(0, 600);
       await page.keyboard.press('End');
       expect(await running(page)).toBe(false);
       await expect.poll(() => page.evaluate(() => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) <= 2), { timeout: 8000 }).toBe(true);
       await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
       await page.mouse.wheel(0, 500);
       await page.locator('.vn-navbar__link[data-nav-hash="servicos"]').click();
       await expect.poll(() => page.evaluate(() => {
         const r = document.getElementById('servicos')!.getBoundingClientRect();
         return r.top < innerHeight * 0.6 && r.bottom > innerHeight * 0.15;
       }), { timeout: 10_000 }).toBe(true);
       expect(await running(page)).toBe(false);
     });

     test('scroll-driven animations follow the smoothed scroll', async ({ page }) => {
       await page.goto('/?vn-debug');
       await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollFx)).toBe('tl');
       await arm(page);
       await page.mouse.wheel(0, 300);
       await expect.poll(() => running(page), { timeout: 4000 }).toBe(false);
       expect(await page.locator('.vn-hero__inner').evaluate((e) => getComputedStyle(e).translate)).not.toBe('none');
     });

     test('a wheel over an inner scroller or an opted-out element is native; the kill switch works', async ({ page }) => {
       await page.goto('/?vn-debug');
       await arm(page);
       await page.evaluate(() => {
         const b = document.createElement('div');
         b.id = 'probe';
         Object.assign(b.style, { position: 'fixed', left: '100px', top: '200px', width: '300px', height: '200px', overflowY: 'auto', background: '#fff', zIndex: '999' });
         b.innerHTML = '<div style="height:2000px"></div>'.replace('style="height:2000px"', '');
         (b.firstElementChild as HTMLElement).style.height = '2000px';
         document.body.append(b);
       });
       const y0 = await y(page);
       await page.mouse.move(200, 300);
       await page.mouse.wheel(0, 300);
       await expect.poll(() => page.evaluate(() => document.getElementById('probe')!.scrollTop)).toBeGreaterThan(100);
       expect(await running(page)).toBe(false);
       expect(await y(page)).toBe(y0);
       await page.evaluate(() => { document.getElementById('probe')!.remove(); localStorage.setItem('vn-smooth', '0'); });
       await page.mouse.move(700, 400);
       await page.mouse.wheel(0, 300);
       expect(await running(page)).toBe(false);
       await expect.poll(() => y(page)).toBeGreaterThan(y0 + 100); // native scrolling still works
     });

     test('journey: a vertical wheel over the cards scrolls the page', async ({ page }) => {
       await page.goto('/?vn-debug');
       await arm(page);
       await page.locator('[data-vn-journey]').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
       await page.waitForTimeout(300);
       const box = (await page.locator('[data-vn-journey]').boundingBox())!;
       const y0 = await y(page);
       await page.mouse.move(700, Math.min(850, Math.max(120, box.y + 80)));
       await page.mouse.wheel(0, 300);
       await expect.poll(() => y(page)).toBeGreaterThan(y0 + 200);
     });
   });

   test.describe('smooth wheel is never loaded', () => {
     test('under reduced motion', async ({ browser }) => {
       const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL });
       const page = await ctx.newPage();
       const hits = track(page);
       await page.goto('/');
       await page.mouse.move(700, 400);
       await page.mouse.wheel(0, 300);
       await page.waitForTimeout(600);
       expect(hits).toEqual([]);
       await ctx.close();
     });

     test('on touch devices', async ({ browser }) => {
       const ctx = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, baseURL: test.info().project.use.baseURL });
       const page = await ctx.newPage();
       const hits = track(page);
       await page.goto('/');
       await page.evaluate(() => scrollTo(0, 400));
       await page.waitForTimeout(600);
       expect(hits).toEqual([]);
       await ctx.close();
     });
   });
   ```
   In the probe test, the two-line `innerHTML` dance only exists to avoid a `style` attribute in injected markup
   (the page's CSP forbids it); simplify it to
   `const c = document.createElement('div'); c.style.height = '2000px'; b.append(c);` when you write the file.
6. Gate; `npx playwright test e2e/smooth-wheel.spec.ts e2e/journey.spec.ts e2e/journey-pinned.spec.ts
   e2e/gates.spec.ts e2e/interactions.spec.ts e2e/render-cost.spec.ts e2e/handoffs.spec.ts e2e/cursor.spec.ts`
   (`journey-pinned.spec.ts` only if C3 landed). Then both Lighthouse runs (C2 step 4): they must exit 0, and
   `check:budget` must show `smooth` outside every first-load set. Ledger row.
7. Manual check on a real mouse and a real trackpad (the automated wheel has neither inertia nor a precision
   mode): a mouse notch glides for about a second and stops; a two-finger trackpad scroll feels exactly as on a site
   without this module; middle-button autoscroll and dragging the scrollbar work; a wheel while the theme toggle
   animates does not break it. If trackpad scrolling feels different from native, raise `MIN_DELTA` to 60 and
   re-check; if it still does, drop the task.

**Reduced motion, no JS, touch.** Never loaded in any of them (`motionOK()` plus the wheel trigger). If reduced
motion is switched on at runtime, the media query listener removes every listener.

**Bytes.** New lazy chunk `smooth`, about 620 B gz; first-load JS plus about 60 B gz.

**Pitfalls.**
1. The brand sets `scroll-behavior: smooth` on `html`. Every write here uses `behavior: 'instant'`; a plain
   `scrollTo(0, y)` would be smoothed again by the browser and stutter.
2. R8: deferred sections change height when they render. `max()` is read every frame, and `onScroll` shifts the
   animation when scroll anchoring moves the page; do not "simplify" that into cancelling the animation, or scrolling
   up through the page stops dead at each section.
3. CSS scroll-driven animations (hand-offs, the pinned Jornada, the rail) read the real scroll position, which this
   module writes once per frame, so they stay in step. They are not composited-only while the wheel is being
   smoothed; `e2e/gates.spec.ts` CLS and the long-task budget are not affected because nothing here runs at load.
4. A non-passive `wheel` listener is why the module must never be imported at load or on idle: keep the trigger.
5. `journey.ts` in pinned mode calls `window.scrollTo` (buttons, drag). `pointerdown` and `keydown` stop this
   module first, so the two never write in the same frame.
6. The mobile drawer is a `<dialog>`; while one is open, wheels are native (`dialog[open]` check).

**Done when.** `e2e/smooth-wheel.spec.ts` green; listed specs green; Lighthouse exits 0 on both forms; step 7 done
and described in the report.

**Commit.** `feat(scroll): smooth mouse wheel on fine pointers, native everywhere else`

---

## B2b. The fluid trail distorts the images it passes over

**Risk: high (visual seams). Droppable:** revert the commit; the ink trail is unchanged by the other tasks.

**Goal.** On lamalama the cursor's fluid field displaces the page under it. DOM content cannot be displaced, so we
do the cheapest faithful version for the elements where it shows: images. While the trail's WebGL loop runs, for
each participating image near the pointer, the trail canvas (already fixed over the page) redraws that image at its
exact on-screen rectangle, sampled through the solver's velocity field, with an alpha that follows the flow's
strength. Still water shows the real DOM image untouched; moving water shows the displaced copy on top of it.
Outside images, and in the Canvas2D fallback, the red ink trail stays as it is.

**Which images.** Project thumbnails on the home (`.vn-project-row__media.is-done img`, six of them) and the case
hero image (`.vn-case-media img`). Not the hero portrait: it is grayscale through a CSS filter, with a persistent
colour brush on a canvas above it and a 3D tilt; a WebGL copy would show the wrong colours.

**Files.** `src/scripts/cursor-trail.ts`, `budget.json`, `e2e/cursor-trail.spec.ts` (new describe), this file.

**Do not change.** The solver passes and their constants; the ink colours and the `data-trail="off"` behaviour; the
Canvas2D fallback; how the chunk is loaded (`main.ts`: first pointer move, `motionOK()`); `cursor.ts`.

**Steps.**

1. `src/scripts/cursor-trail.ts`, constants (lines 9 to 21). Change line 13:
   `const OUT_PX = 2; // CSS px per canvas pixel (the canvas is upscaled by the compositor)` to
   ```ts
   const OUT_PX = 1; // CSS px per canvas pixel: the canvas now also redraws images, which must not look soft
   const OUT_MAX = 1920; // ...capped across, so very wide windows do not pay for it
   const WARP_T = 0.07; // seconds of flow an image is displaced by
   const WARP_SEL = '.vn-project-row__media.is-done img, .vn-case-media img';
   ```
   and in `resize` (line 227) change `const [cw, ch] = grid(OUT_PX);` to `const [cw, ch] = grid(OUT_PX, OUT_MAX);`.
   Leave the Canvas2D `grid(OUT_PX * 2)` call as it is.
2. The `Renderer` interface (lines 28 to 33) gains one optional method, and a type next to it:
   ```ts
   interface WarpItem {
     img: HTMLImageElement;
     box: DOMRect; // the clipping frame (the image's parent)
     rect: DOMRect; // the image itself, transforms included
   }
   interface Renderer {
     resize(): void;
     frame(x0: number, y0: number, x1: number, y1: number, dt: number, ink: number[]): void;
     warp?(items: WarpItem[], top: number): number; // WebGL only: redraw images through the flow; returns how many
     clear(): void;
     destroy(): void;
   }
   ```
3. The `FS` object (lines 66 to 88): add one program after `o`:
   ```ts
     // image through the flow: A = velocity, B = the image; I = image rect in screen uv (x, y, w, h; y up),
     // S = 1 / sim size, k = seconds. Alpha follows the flow, so still water leaves the real image showing.
     x: `${H}uniform vec4 I;uniform vec2 S;uniform float k;void main(){vec2 f=texture2D(A,v).xy*S*k;float a=smoothstep(.0015,.01,length(f));
   vec2 p=(v-f-I.xy)/I.zw;gl_FragColor=vec4(texture2D(B,clamp(p,0.,1.)).rgb*a,a);}`,
   ```
4. Inside `webgl()`, after the `swap` helper (line 211), add the texture cache and the pass:
   ```ts
     // B2b: one texture per participating image, uploaded lazily (at most one upload per frame)
     const tex = new WeakMap<HTMLImageElement, WebGLTexture>();
     const texAll: WebGLTexture[] = [];
     let uploaded = false;
     const texOf = (img: HTMLImageElement): WebGLTexture | null => {
       const have = tex.get(img);
       if (have) return have;
       if (uploaded || !img.complete || !img.naturalWidth) return null;
       uploaded = true;
       const t = gl.createTexture()!;
       gl.bindTexture(gl.TEXTURE_2D, t);
       gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
       try {
         gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
       } catch {
         gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
         gl.deleteTexture(t);
         return null; // a tainted or undecodable image never takes part
       }
       gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
       tex.set(img, t);
       texAll.push(t);
       return t;
     };
     const warp = (items: WarpItem[], top: number): number => {
       uploaded = false;
       let n = 0;
       // layout viewport without the scrollbar: the canvas is exactly this wide
       const vw = document.documentElement.clientWidth;
       const vh = innerHeight;
       const kx = canvas.width / vw;
       const ky = canvas.height / vh;
       gl.enable(gl.SCISSOR_TEST);
       gl.enable(gl.BLEND);
       gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied output over the ink
       for (const it of items) {
         const x0 = Math.max(it.box.left, 0);
         const x1 = Math.min(it.box.right, vw);
         const y0 = Math.max(it.box.top, top); // never over the sticky header
         const y1 = Math.min(it.box.bottom, vh);
         if (x1 <= x0 || y1 <= y0) continue;
         const t = texOf(it.img);
         if (!t) continue;
         gl.scissor(Math.floor(x0 * kx), Math.floor((vh - y1) * ky), Math.ceil((x1 - x0) * kx), Math.ceil((y1 - y0) * ky));
         run('x', null, vel[0], { t } as Tgt, {
           I: [it.rect.left / vw, 1 - it.rect.bottom / vh, it.rect.width / vw, it.rect.height / vh],
           S: [1 / vel[0].w, 1 / vel[0].h],
           k: [WARP_T],
         });
         n++;
       }
       gl.disable(gl.SCISSOR_TEST);
       gl.disable(gl.BLEND);
       return n;
     };
   ```
   In `free` (line 123), after `dropAll();` add `texAll.forEach((t) => gl.deleteTexture(t));`. In the returned
   object (line 251), add `warp,` after `resize,`.
5. Controller (below line 338). Add next to the other module-level variables:
   ```ts
   let warpImgs: HTMLImageElement[] = [];
   let warpN = 0;
   let navBottom = 0;
   let lastScroll = 0;
   const onScroll = () => {
     lastScroll = performance.now();
   };

   // Images near the pointer, with their frame and their own rect (transforms included), at most three.
   function warpItems(now: number): WarpItem[] {
     if (now - lastScroll < 140) return []; // the page is moving and the canvas is a frame behind it
     if (warpN++ % 30 === 0) {
       warpImgs = [...document.querySelectorAll<HTMLImageElement>(WARP_SEL)];
       navBottom = document.querySelector('.vn-navbar')?.getBoundingClientRect().bottom ?? 0;
     }
     const out: WarpItem[] = [];
     for (const img of warpImgs) {
       const box = img.parentElement!.getBoundingClientRect();
       if (px < box.left - 160 || px > box.right + 160 || py < box.top - 160 || py > box.bottom + 160) continue;
       out.push({ img, box, rect: img.getBoundingClientRect() });
       if (out.length === 3) break;
     }
     return out;
   }
   ```
   In `tick`, directly after `r.frame(qx, qy, px, py, dt, ink);` add:
   ```ts
     if (r.warp) flag('__vnTrailWarp', nodye ? 0 : r.warp(warpItems(now), navBottom));
   ```
   In `stop()`, after `flag('__vnTrailRunning', false);` add `flag('__vnTrailWarp', 0);`. In `start()`, after the
   `resize` listener line, add `addEventListener('scroll', onScroll, { passive: true });`, and in `off()` add
   `removeEventListener('scroll', onScroll);`. In `onMove`, where the loop is started (`if (!raf) {`), add
   `warpN = 0;` so the image list is refreshed at the start of each run.
6. `budget.json`: lower `"cursor-trail"` from 9216 to 6144.
7. Tests, appended to `e2e/cursor-trail.spec.ts`:
   ```ts
   test.describe('trail: image distortion', () => {
     test.use({ viewport: { width: 1440, height: 900 } });
     const w = (page: Page, k: string) => page.evaluate((key) => (window as unknown as Record<string, unknown>)[key], k);
     const sweep = async (page: Page, sel: string) => {
       const box = (await page.locator(sel).first().boundingBox())!;
       const y = box.y + box.height / 2;
       for (let i = 0; i <= 12; i++) await page.mouse.move(box.x + 10 + ((box.width - 20) * i) / 12, y + (i % 2 ? 6 : -6));
     };

     test('a project thumbnail is redrawn through the flow while the pointer crosses it, and released after', async ({ page }) => {
       await page.goto('/?vn-debug');
       await page.mouse.move(300, 300);
       await expect(page.locator('canvas.vn-cursor-trail')).toHaveCount(1);
       test.skip((await w(page, '__vnTrailMode')) !== 'webgl', 'no WebGL on this machine: the ink fallback has no image pass');
       const media = page.locator('.vn-project-row__media').first();
       await media.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
       await expect(media).toHaveClass(/is-done/, { timeout: 8000 });
       await page.waitForTimeout(300); // let the scroll guard (140 ms) pass
       await sweep(page, '.vn-project-row__media');
       await expect.poll(async () => { await sweep(page, '.vn-project-row__media'); return w(page, '__vnTrailWarp'); }, { timeout: 6000 }).toBeGreaterThanOrEqual(1);
       // away from any image: no image pass
       await page.mouse.move(40, 500);
       await page.mouse.move(60, 520);
       await expect.poll(() => w(page, '__vnTrailWarp')).toBe(0);
       // and the loop still settles
       await expect.poll(() => w(page, '__vnTrailRunning'), { timeout: 6000 }).toBe(false);
     });

     test('the case hero image takes part; the hero portrait never does', async ({ page }) => {
       await page.goto('/projetos/caato/?vn-debug');
       await page.mouse.move(300, 300);
       await expect(page.locator('canvas.vn-cursor-trail')).toHaveCount(1);
       test.skip((await w(page, '__vnTrailMode')) !== 'webgl', 'no WebGL on this machine');
       await page.locator('.vn-case-media').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
       await page.waitForTimeout(300);
       await expect.poll(async () => { await sweep(page, '.vn-case-media'); return w(page, '__vnTrailWarp'); }, { timeout: 6000 }).toBeGreaterThanOrEqual(1);
       await page.goto('/?vn-debug');
       await page.mouse.move(300, 300);
       await expect(page.locator('canvas.vn-cursor-trail')).toHaveCount(1);
       await sweep(page, '.vn-hero-portrait');
       await page.waitForTimeout(300);
       expect(await w(page, '__vnTrailWarp')).toBe(0);
     });

     test('Canvas2D fallback: ink only, no image pass, no errors', async ({ page }) => {
       const errors: string[] = [];
       page.on('pageerror', (e) => errors.push(e.message));
       await page.goto('/?vn-debug&vn-trail=2d');
       await page.mouse.move(300, 300);
       await expect(page.locator('canvas.vn-cursor-trail')).toHaveCount(1);
       const media = page.locator('.vn-project-row__media').first();
       await media.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
       await page.waitForTimeout(300);
       await sweep(page, '.vn-project-row__media');
       expect(await w(page, '__vnTrailWarp')).toBeFalsy();
       expect(errors).toEqual([]);
     });
   });
   ```
   If the file already declares a helper named `w`, reuse it instead of redeclaring.
8. Gate; `npx playwright test e2e/cursor-trail.spec.ts e2e/cursor-trail-optout.spec.ts e2e/cursor.spec.ts
   e2e/themes-rhythm.spec.ts e2e/projects.spec.ts e2e/parallax.spec.ts`. Ledger row.
9. Visual acceptance (this is the point of the task; the tests only prove the pass runs). In Chrome at 1440 x 900,
   both themes, record the screen while moving the pointer in slow and fast strokes over a project thumbnail and
   over the case hero image, then step through the frames:
   - the image visibly smears and wobbles along the stroke and settles back within about two seconds;
   - at rest it is pixel-identical to before (the canvas is clear when the loop stops);
   - no rectangle, edge or brightness step is visible where the copy meets the real image;
   - nothing is drawn over the sticky header or outside the image's frame.
   Decision rule: a visible seam or a colour step means the copy does not match the DOM image. First check the
   rect mapping at a window with a classic scrollbar (the code uses `clientWidth` for that reason). If a faint
   softness of the copy is the only flaw, keep it. If a hard edge remains, change the alpha ramp in the shader from
   `smoothstep(.0015,.01,...)` to `smoothstep(.003,.02,...)` (less of the copy is shown). If it is still visible,
   revert the task and report with two frames attached.

**Reduced motion, no JS, touch.** The chunk never loads in any of them. Without half-float render targets the
WebGL path is not used and the Canvas2D ink has no image pass.

**Bytes.** `cursor-trail` from about 4100 to about 5200 B gz (cap lowered to 6144). Nothing first-load, nothing
inline.

**Pitfalls.**
1. Everything else in this file normalises by `innerWidth`, which includes a classic scrollbar; the canvas is
   `clientWidth` wide. The image pass must use `clientWidth`, as written, or the copy sits up to 15 px off at the
   right edge. Do not "unify" the two.
2. `run()` draws a full-canvas quad; the scissor rectangle is what confines the pass to the image's frame. It must
   be disabled again afterwards, or the solver's own passes (other framebuffers) get clipped.
3. The image's own rect includes its transforms: the parallax scale of 1.18 and drift from `fx/parallax.css`, the
   hover zoom, the case hero's scroll zoom. The frame is the parent's rect. Reading both each frame is what keeps
   the copy aligned; do not cache them across frames.
4. A thumbnail that is still entering has an animated clip on its frame; it only takes part once it is `.is-done`
   (R7), which is in the selector.
5. Rounded corners of the frame (14 px, 24 px on the case hero) are not masked. The copy only shows where the water
   moves; if a square corner ever shows in the frames of step 9, report it rather than adding a mask (the cap is
   lowered and a rounded-rect mask costs about 150 B).
6. Textures are 1600 x 800 RGBA, about 5 MB of GPU memory each, at most six on the home. They are released in
   `free()`, which runs on `pagehide`, on context loss and when the media query turns off.
7. `OUT_PX` goes from 2 to 1, so the ink is now drawn at four times the pixels (capped at 1920 across). The ink
   tests in this spec ("the ink is actually on screen", "plain alpha blending") must stay green; if the first one
   needs a slightly different sample position because the grain is finer, adjust the position, not the threshold.

**Done when.** The three new tests green (or skipped with the stated reason on a machine without WebGL, in which
case run them once on a machine that has it); listed specs green; `check:budget` passes with the lowered cap;
step 9 done with frames attached to the report.

**Commit.** `feat(cursor): fluid trail displaces project thumbnails and the case hero image`

---

# Final verification (E1 to E4)

Run after the last task, on the exact commit that will ship. Use PowerShell 7.

## 1. Full gate

```powershell
npm run lint && npm run build && npm run check:budget && npm run check:html && npm test
```

Then check by hand against the "Budgets" table: every `lazyChunks` entry in `budget.json` equals the "Proposed cap"
column (or the row's task was dropped and the cap was never raised); `lazyJsGzMaxBytes` is the measured lazy total
plus 5%, rounded up to a multiple of 256, and no higher than 23040; `inlineCssGzMaxBytes`, `htmlGzMaxBytes` and
`firstLoadJsGzMaxBytes` are still 14336, 32768 and 8192. Update the table's "Cap today" column and tick the outline.

## 2. Full e2e

```powershell
npx playwright test
npx playwright test --repeat-each=2 e2e/journey-pinned.spec.ts e2e/smooth-wheel.spec.ts e2e/preloader.spec.ts e2e/projects.spec.ts e2e/cursor-trail.spec.ts
```

Zero failures and zero flaky tests on the second command. Specs added by this pass: `rail`, `footer`,
`journey-pinned`, `preloader`, `smooth-wheel`, plus new tests in `gates`, `chrome-fx`, `lines-reveal`, `hero`,
`sections`, `split-reveal`, `choreography`, `signal-field`, `parallax`, `moments`, `projects`, `cursor`,
`cursor-trail`.

## 3. Motion checks by frame capture

Serve the build (`npx wrangler pages dev dist --port 8788`) and capture with Chrome (DevTools device toolbar for the
phone sizes; Rendering panel to emulate reduced motion and to force the colour scheme; "Disable JavaScript" in the
command menu). For each row capture frames at the listed moments and compare with the task's "Done when".

| Moment | Viewports | Variants | What to look for |
|---|---|---|---|
| First load of `/` in a new window: 0, 0.3, 0.6, 0.9, 1.5, 2.5 s | 1440 x 900, 390 x 844 | light, dark; pt-BR, en | Curtain at frame 0 with the name, lead and portrait already drawn under it (capture once with the curtain's `display` forced off in DevTools to confirm); arch lift; strip and strap wipe; CTAs rise; chips and badge pop; static by 2.5 s |
| Reload in the same tab | 1440 x 900 | light | No curtain; hero opening only |
| Scroll 0 to 100 svh in 100 px steps | 1440 x 900 | light, dark | Hero inner sinks, scrim darkens, portrait zooms, badge turns; rail percentage rises |
| About statement, stage at 10%, 35%, 60% of its pass | 1440 x 900, 390 x 844 | light, dark; en | Words ink in order; all dark by 60%; caption below |
| About to Números | 1440 x 900, 390 x 844 | light, dark | Dome deep at first, settling; label on the curve at 1440 only; no wedge |
| Números entering | 1440 x 900 | dark | Digits roll, signs and commas still; labels ruled |
| Jornada, every 400 px through the section | 1440 x 900, 1366 x 768 | light, dark; en | Head out, row pins under the header, cards slide, ghost word drifts slower, bar fills, counter runs 01 to 08, archive follows. At 1366 x 768 either pinned and fully visible or the carousel, never a cut-off card |
| Jornada | 390 x 844, 1024 x 768 | light | Swipe carousel, controls above the cards, no inner scrollbar |
| Services | 390 x 844 | light, dark | Each card opens from an inset frame |
| Outline buttons: hover in, hold, hover out; Tab focus | 1440 x 900 | light, dark | Fill from the left, out to the right; label flips; focus ring visible |
| Contact band, pointer resting outside it for 3 s | 1440 x 900 | light | Dots breathe; stops when scrolled away |
| Contact title | 390 x 844, 320 x 640 | pt-BR, en | Fills the line, no overflow, two lines |
| Page end | 1440 x 900, 390 x 844 | light, dark | Wordmark edge to edge, red dot, rises as the footer enters; Palmas time correct |
| Click a project row; click "next project"; language switch; Back | 1440 x 900, 390 x 844 | light, dark | Wipe up to ink, counter 0 to 100, thumbnail flies (row to case only), reveal from below; about 1.5 s |
| Theme toggle, on the home and on a case page | 1440 x 900 | to dark, to light | The circular reveal and the dawn arch exactly as before the pass; no counter, no ink cover |
| Mouse wheel: three notches down, one up | 1440 x 900 | light | Glides and stops; pinned Jornada, hand-offs and rail stay in step |
| Pointer strokes over a thumbnail and the case hero | 1440 x 900 | light, dark | Image smears and settles; no seam; ink elsewhere |
| Cursor pill over a labelled button after a fast move | 1440 x 900 | light | Trails, arrives, no overshoot |
| Phone: first swipe | 390 x 844 touch | light | Portrait blooms to colour in three waves and stays |
| Whole page, top to bottom | 1440 x 900, 390 x 844 | reduced motion; light, dark; pt-BR, en | No curtain, no opening, no rail, carousel Jornada, static statement in full ink, static arch, static wordmark, instant navigation, native wheel; every text visible |
| Whole page, top to bottom | 1440 x 900, 390 x 844 | JavaScript off; light | Same as reduced motion, plus: no wordmark, "UTC−3", top progress bar static; nothing hidden, nothing unstyled that should be styled |

## 4. Lighthouse, local

```powershell
npm run build
$env:LHCI_FORM='mobile';  npx --yes @lhci/cli autorun --config=lighthouserc.cjs
$env:LHCI_FORM='desktop'; npx --yes @lhci/cli autorun --config=lighthouserc.cjs
```

Both must exit 0: 100 in the four categories on the five URLs, LCP at most 1200 ms (mobile) and 800 ms (desktop),
CLS at most 0.01, TBT at most 50 ms, median of three runs. Run each command a second time; a single failing round is
a failure. From the reports in `.lighthouseci/`, record for `/` on both forms: performance score, LCP, Speed Index,
TBT, CLS, and the LCP element (it must be the `h1` or the portrait image, never the preloader or the counter).

If a round fails, the tasks most likely responsible, in this order, and what to do:

1. C1 preloader (Speed Index): apply its step 7 ladder; last resort, revert C1.
2. C2 hero opening (Speed Index): apply its step 4 ladder.
3. A5 or C5 (a request or a paint just after load): confirm in the report's network table that `late.*.js` starts
   after `load`; if the rail's appearance registers as a late paint on desktop, move its opacity keyframe to start
   at 0 for the first 2% of scroll so nothing is drawn at the top of the page.
4. HTML weight (LCP through transfer size): apply the trims under "Budgets".

## 5. After the deploy

1. The deploy workflow run for the final commit is green, including its production Lighthouse job.
2. `https://voaneves.com/` and `https://voaneves.com/en/` serve the new build: the HTML contains `vn-rail` and
   `vn-foot-mark` (`curl -s https://voaneves.com/ | Select-String 'vn-foot-mark' -Quiet` prints True), and
   `https://voaneves.com/projetos/caato/` contains `vn-vt-count`.
3. Response headers still carry the CSP with hashes and no `unsafe-inline` for scripts
   (`curl -sI https://voaneves.com/ | Select-String 'content-security-policy'`), and the browser console on `/`,
   `/en/` and a case page shows no CSP violation and no error, after a full scroll, a theme toggle and one
   navigation.
4. Lighthouse against production, both forms, on `/`, `/en/` and `/projetos/caato/`:
   ```powershell
   npx --yes lighthouse https://voaneves.com/ --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./.lighthouseci/prod-home-mobile.json
   npx --yes lighthouse https://voaneves.com/ --preset=desktop --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./.lighthouseci/prod-home-desktop.json
   ```
   100 in the four categories on each. One retry is allowed for network noise; two misses on the same URL is a
   failure and reopens section 4's list.
5. On a real phone and a real desktop: first visit shows the curtain once; the second page view does not; a project
   opens with the transition and Back returns with it; the theme toggle still reveals in a circle.
6. Tick E1 to E4 in the outline and record the commit hash next to each finished task.
