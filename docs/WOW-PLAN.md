# WOW-PLAN: voaneves.com, from good to "Site of the Day" level

Status: ready to run, one subtask at a time per executor. Date: 2026-11-14.
Repo: `D:\GitHub\site` (Astro 7 static, `@voaneves/brand` 1.0.0). Brand spec: `D:\GitHub\brand\PLAN.md` B7-B10, D5.
Rule for every executor: **do not touch git** (no add, commit, branch or push). Do not edit files owned by another subtask
that is still open. Never write Claude/AI in any file.

**Standard gate** (every subtask must pass it before it is reported done):

```
npm run build && npm run check:budget && npm run check:html && npm test && npx playwright test
```

---

## 0. Art direction

**Statement.** The site works like an editorial broadsheet that runs on signal. Type is oversized, set in Fraunces italic
WONK 900 against Schibsted roman, with line breaks chosen on purpose ("Victor / *Neves.*"). Chapters alternate between Tinta
and Creme and are cut with clip-path wipes. Each section opens with a numbered mono eyebrow, `[ 01 — Quem sou ]`. The red
Sinal dot from the logo (`03-logo.md`: ink disc, V cutout, red dot) is the one recurring motion motif. It shows up as the
period after the name, the cursor dot, the trail, the active nav marker, the scroll-progress head and the dots of the contact
field. Everything else stays still. Motion is scroll-driven CSS first and JS second, and it never delays the paint of
the hero or the LCP. Copy is short and first person, and uses numbers instead of adjectives. Essence: **"Sinal, não ruído."**

**Moodboard: what we take from each reference**

- **lamalama.com**: the cursor. A fluid WebGL trail plus a pill label that morphs over its targets (see §2, W14/W15).
- **mendo.nl**: editorial scale, with display type that fills the measure and quiet grotesk body text.
- **extrafazant.nl**: playful microcopy (404, form hints, cursor labels such as "Bora?").
- **zrk.technology**: a crosshair HUD in mono showing live `X 0412 · Y 0233` in the hero corner, plus technical rules and grids.
- **franshalsmuseum.nl**: Tinta/Creme chapter alternation and clip-path image reveals with a slow zoom on hover.
- **dontboardme.com**: confident colour blocks, used here for the Sinal contact band as the climax.
- **bruno-simon.com**: one lazy interactive easter egg, the "signal field" canvas in #contato.
- **sondaven.com**: bracketed eyebrow labels and split headlines that use weight and italic contrast.
- **era-residence.com**: deliberately broken display lines, generous whitespace, sticky stacked cards.

---

## 1. Gates and budgets (hard, non-negotiable)

| Gate | Target | How it is checked |
|---|---|---|
| Lighthouse, 4 categories | 100 mobile + 100 desktop on `/`, `/en/`, `/privacidade/`, `/en/privacy/`, `/projetos/caato/` | `lighthouserc.cjs` (W17 adds the case URL) |
| LCP | ≤ 1200 ms mobile, ≤ 800 ms desktop | LHCI assertions |
| CLS | ≤ 0.01 | LHCI + `e2e/gates.spec.ts` (PerformanceObserver while scrolling the whole page) |
| TBT | ≤ 50 ms | LHCI |
| axe | 0 violations, light + dark, 390 and 1366 px, tags wcag2a/aa, 21a/aa, 22aa | `e2e/a11y.spec.ts` |
| WCAG 2.2 AA extras | target size, focus not obscured, reflow 320-768, text spacing | `e2e/gates.spec.ts` (W6) |
| Reduced-motion parity | no running animations with duration > 0; no lazy motion chunks requested; all content visible | `e2e/gates.spec.ts` |
| HTML per page | ≤ 35 KB gz | `check:budget` |
| Inline CSS per page | ≤ 14 KB gz (now 9.5). **Working cap 13 KB** to keep headroom | `check:budget` |
| First-load JS (ours) | ≤ 8 KB gz, **max over pages** of entry + static imports | `check:budget` (W1) |
| Lazy JS, total | ≤ 9 KB gz | `check:budget` |
| Lazy chunk `cursor` | ≤ 1.5 KB gz | `check:budget` |
| Lazy chunk `cursor-trail` | ≤ 4 KB gz | `check:budget` |
| Lazy chunk `magnetic` | ≤ 0.6 KB gz | `check:budget` |
| Lazy chunk `signal-field` | ≤ 2.5 KB gz | `check:budget` |
| Preload fonts | ≤ 60 KB | `check:budget` |

Motion rules that apply to every subtask:
- Animate only `transform`/`translate`/`scale`/`rotate`, `opacity` and `clip-path`. Never animate layout properties, `filter` or `box-shadow`. The status pulse may use 3 iterations, per B7.
- No animation, hidden state or delayed paint on the hero `h1`, the hero sub-copy or the LCP image (`main_1.webp`).
- Hidden reveal states only under `html.js` **and** `@media (prefers-reduced-motion: no-preference)`. Without JS everything is visible.
- Scroll-driven effects go inside `@supports (animation-timeline: view())`. The IntersectionObserver fallback adds `.is-in`.
- CSP: no `style=""` attributes in markup, because Astro hashes inline `<style>` and `<script>` only. Setting styles from JS through the CSSOM (`el.style.x`, `setProperty`) is fine. No inline event handlers. Dynamic imports are `'self'`, so they are fine.
- No frameworks or new runtime deps. Dev deps are allowed only if the subtask names them.
- All new copy must be bilingual (pt-br + en). Labels repeat visible text (B8).

---

## 2. Subtasks

### File ownership after the foundation

```
src/styles/site.css                 -> imports + @font-face + base only (owner W2, then frozen)
src/styles/sections/<name>.css      -> one owner per file (see each subtask)
src/scripts/main.ts                 -> entry, loader (owner W3; later subtasks may append ONE import/loader line each)
src/scripts/<module>.ts             -> one owner per file
src/components/home/<Section>.astro -> one owner per file (created by W4)
src/components/HomePage.astro       -> composition only (owner W4, then frozen)
src/layouts/Base.astro              -> owner W3 in phase 1; W6 only for the html.js head line; frozen afterwards
src/i18n/ui.ts, src/data/portfolio.ts -> owner W5 in phase 1; FROZEN in phase 2 (put new strings in a per-component
                                       `const L = { 'pt-br': {...}, en: {...} }` map inside the component)
e2e/<topic>.spec.ts                 -> one owner per file
```

`main.ts` is the only shared file in phase 2. Each subtask adds exactly one line in the block marked
`// --- module registrations ---`. If an edit collides, re-read the file and append again.

### Phase 1: foundation (W1-W5 run in parallel; W6 starts after W2+W3+W4 are done)

#### W1: Budget script that splits first-load and lazy JS
- **Files:** `scripts/check-budget.mjs`, `scripts/lib/js-graph.mjs` (new), `budget.json`, `tests/budget.test.mjs` (new).
- **Spec:**
  - `js-graph.mjs` exports `entryScripts(html)`. It returns the `/_astro/*.js` srcs of `<script type="module" src>` and `<link rel="modulepreload">`, plus the bytes of inline `<script type="module">` blocks.
  - It also exports `staticImports(code)`. This returns the `./x.js` specifiers from `import … from"./x.js"` and `import"./x.js"`, and **excludes** `import("./x.js")`.
  - First-load set per page = entries plus their transitive static imports. The script reports the **max** over pages against `firstLoadJsGzMaxBytes`.
  - Lazy set = every `_astro/*.js` that is not in any first-load set. The script sums them against `lazyJsGzMaxBytes`.
  - It matches each lazy chunk to `lazyChunks` by basename prefix (`^cursor\.`, `^cursor-trail\.`, `^magnetic\.`, `^signal-field\.`; note `cursor\.` must not match `cursor-trail.`).
  - It fails if a named lazy chunk is over budget, **or if it appears in a first-load set**, which proves it stays lazy. A named chunk that does not exist yet is a warning, not a failure. W17 switches this to a failure.
  - `budget.json` adds `"lazyJsGzMaxBytes": 9216` and `"lazyChunks": {"cursor":1536,"cursor-trail":4096,"magnetic":614,"signal-field":2560}`. It also adds `"inlineCssGzWarnBytes": 13312`, which warns but does not fail.
- **Acceptance:** `tests/budget.test.mjs` unit-tests `entryScripts`/`staticImports` on fixture strings (static, dynamic, side-effect import, inline module). The standard gate passes, and the output prints `first-load max=… lazy total=…`.

#### W2: Split site.css into per-section files
- **Files:** `src/styles/site.css`, `src/styles/sections/*.css` (new).
- **Spec:**
  - Keep L1-3 brand `@import`s first. Add `@import "./sections/<name>.css";` lines **directly after them**, before any `@font-face`, because `@import` must precede other rules.
  - Each section file wraps its content in `@layer site { … }`.
  - Move the existing comment-delimited blocks verbatim into: `chrome.css` (L112-228: progress, navbar, drawer), `hero.css` (229), `about.css` (485), `numbers.css` (555), `expertise.css` (669), `journey.css` (736), `projects.css` (865), `services.css` (913), `faq.css` (968), `contact.css` (1014), `case.css` (1077), `footer.css` (1197) and `cursor.css` (1218-end).
  - The base rules L55-111 stay in `site.css` inside `@layer site`.
  - Create empty placeholders `motion.css`, `transitions.css`, `theme-vt.css` and `signal-field.css`, each containing `@layer site {}` with an owner comment.
- **Acceptance:**
  - Pure move, zero rule changes. In each built HTML, inline CSS gz differs from the pre-split build by at most 1%. Record both numbers in the report.
  - The standard gate passes. Screenshots of `/` at 1366 and 390 before and after match (`toHaveScreenshot` is not required; a manual compare of two PNGs in `test-results/` is enough).

#### W3: Split the Base.astro script into modules and fix the Base bugs
- **Files:** `src/layouts/Base.astro`, `src/scripts/{main,theme,drawer,progress,reveal,nav,marquee,journey,hero}.ts` (new), `src/scripts/lazy.ts` (new).
- **Spec:**
  - Replace the `<script>` at L275-556 with `<script>import '../scripts/main.ts';</script>`. Each concern from the current script moves verbatim into its module and exports `init()`.
  - `lazy.ts` exports these helpers:
    - `onIdle(cb)`: `load`, then `requestIdleCallback` with `{timeout:2000}`, falling back to `setTimeout(…,200)`.
    - `onFirstPointer(cb)`: one `pointermove`, `{once:true, passive:true}`.
    - `motionOK()`: `matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches`.
  - `main.ts` calls the `init`s and holds the comment block `// --- module registrations ---`.
  - **Delete** the static cursor markup at L266-273, including the hardcoded `caato.webp`. W15 creates the cursor DOM from JS. Leave the cursor *feature* off until W15; the old cursor code is removed, not ported.
  - Bug fixes:
    - (a) The CV links at L239/L258 use `PORTFOLIO[locale].contact.cvUrl`. On `en` the label reads "CV PDF (PT)", because only `cv-pt.pdf` exists.
    - (b) The JSON-LD strings (jobTitle, descriptions, offer names) come from locale data. Put the localized literals in a new `src/i18n/seo.ts` map, `{ 'pt-br': {...}, en: {...} }`. Set `inLanguage` to the page locale.
- **Acceptance:**
  - Theme, drawer, marquee, journey and progress e2e still pass. First-load JS is ≤ the current 2.2 KB gz + 0.3 KB.
  - `/en/` JSON-LD contains no Portuguese strings. Add a test in `e2e/seo.spec.ts` (new, owned by W3) that parses `script[type="application/ld+json"]` on `/en/` and asserts `inLanguage === 'en'`, and that no value contains "ção" or "você".
  - The standard gate passes.

#### W4: Split HomePage into section components and fix the home bugs
- **Files:** `src/components/HomePage.astro`, `src/components/home/{Hero,About,Numbers,Expertise,Journey,Projects,Services,Faq,Contact}.astro` (new), `src/data/contact.ts` (new).
- **Spec:**
  - Each `<section>` moves verbatim into its component, with props `{ locale }`. `HomePage.astro` only imports and composes them.
  - Fixes:
    - (a) L60 label: `locale === 'en' ? 'WORK' : 'PROJETOS'`.
    - (b) `contact.ts` exports `WHATSAPP_NUMBER = '5563999999337'` and `waLink(text)`. Services uses `waLink(srv.waMessage)`. Nothing else hardcodes the number. Grep `src/` for `5563999999337` and expect one hit, in `contact.ts`.
  - Add `data-section="NN"` to each section (01 About … 08 Contact) for the eyebrows in phase 2.
- **Acceptance:** The rendered HTML of `/` and `/en/` is unchanged apart from the fixes. Diff `dist/index.html` before and after, ignoring hashes. The standard gate passes.

#### W5: Remaining i18n bugs and the route parity test
- **Files:** `src/components/CaseStudyPage.astro`, `src/pages/404.astro`, `src/i18n/ui.ts`, `src/data/portfolio.ts` (only if needed), `tests/routes.test.mjs` (new).
- **Spec:**
  - CaseStudyPage L22/L130 aria-labels come from `ui.ts` (`breadcrumbLabel`, `projectNavLabel`, pt: "Trilha de navegação", "Navegação entre projetos").
  - The 404 page takes all its strings from `ui.ts`, with pt first and an en block wrapped in `lang="en"`. The new playful copy (extrafazant tone) is:
    - pt: "Sinal perdido. Essa página saiu do mapa."
    - en: "Signal lost. This page is off the map."
  - `routes.test.mjs` imports `ROUTE_PAIRS` and the slugs from `portfolio.ts`. Since portfolio.ts is TS, read it with a regex on `slug: '…'`, or move the slug list to `src/data/slugs.mjs`, used by both files. Recommended: `slugs.mjs`.
  - The test asserts that every pt/en slug has a pair `/projetos/<s>/` ↔ `/en/projects/<s>/`, and that pt and en slug sets are equal.
- **Acceptance:** `npm test` includes the parity test, and it passes. axe is clean on `/404.html` light and dark. The standard gate passes.

#### W6: Gates test suite and motion base (after W2-W4)
- **Files:** `e2e/gates.spec.ts` (new), `e2e/a11y.spec.ts` (add 390/1366 viewports), `src/styles/sections/motion.css`, `src/scripts/reveal.ts`, `src/layouts/Base.astro` (one change: the inline head script adds `document.documentElement.classList.add('js')`).
- **Spec:**
  - The `gates.spec.ts` checks run on `/`, `/en/` and `/projetos/caato/`:
    - (1) Reflow: no horizontal overflow at 320/375/414/768.
    - (2) Target size: every `a,button,summary,[role=button],input` is ≥ 44×44, or ≥ 24 when inline inside a `p`/`li`.
    - (3) Focus not obscured: Tab through up to 80 stops. Each focused rect must stay clear of the sticky navbar rect and of `.vn-cursor`.
    - (4) Text spacing: inject the 1.4.12 stylesheet. No element with `overflow:hidden|clip` may have `scrollHeight > clientHeight + 1`, excluding `[aria-hidden=true]` and marquees.
    - (5) Reduced motion: under `reducedMotion:'reduce'`, after a full scroll, `document.getAnimations().filter(a => a.playState==='running' && (a.effect?.getTiming().duration ?? 0) > 1)` is empty. Every `.vn-reveal` has computed opacity 1, and no request matches `/_astro/(cursor|cursor-trail|magnetic|signal-field)\./`.
    - (6) CLS: a PerformanceObserver over `layout-shift` (excluding `hadRecentInput`) while scrolling to the bottom in 10 steps. The sum must be ≤ 0.01.
    - (7) No JS: with `javaScriptEnabled:false`, every `.vn-reveal` is visible.
  - `motion.css` defines the shared motion contract that phase 2 uses:
    - `.vn-line > span` gets the masked line rise from B7.
    - `.vn-sr` is a scroll reveal through `animation: vn-sr linear both; animation-timeline: view(); animation-range: entry 0% cover 30%`, with opacity .001→1 and `translate: 0 2rem`→0, only under `html.js` + `@supports` + no-preference.
    - `.vn-unveil` reveals an image with `clip-path: inset(12% 8% round var(--vn-radius-2xl))`→`inset(0)`, with the inner img scaling 1.12→1.
    - `.vn-par` is parallax (B7, ≤ 8%).
    - `.vn-eyebrow` is the mono bracket label: `[ 01 — Quem sou ]`, brackets and number `aria-hidden`.
    - `.vn-chapter--ink` / `--creme`, with a `::before` clip-path wedge divider at 3vw.
  - `reveal.ts`: if `CSS.supports('animation-timeline: view()')`, it marks `.vn-sr` elements done (CSS owns them). Otherwise the IO fallback adds `.is-in` with threshold .2 and rootMargin `0px 0px -10% 0px`.
- **Acceptance:** All 7 checks pass on the current, phase-1 site. If a baseline violation shows up, fix it in the owning section CSS file; all phase-1 owners are done by now. The standard gate passes.

**Checkpoint R1 (revisor):** review W1-W6 together. Focus areas:
- the correctness of the budget graph (can a lazy chunk sneak into first-load?)
- the CSP hashes still matching after the head-script change
- the move-only diffs
- the JSON-LD
- tests that are flaky (timeouts, `waitForTimeout` use)

Blockers must be fixed before phase 2.

### Phase 2: art direction and motion (W7-W16 all parallel; each owns the files listed)

Shared contract: use the classes from `motion.css` (W6), and do not redefine them. Cursor hooks:
- `data-cursor-label="…"`: a short label that repeats visible text, e.g. "Ver case →" / "View case →"
- `data-cursor-media="/assets/img/port/x.webp"`
- `data-cursor="link"`
- `data-magnetic`: replaces the `.vn-magnetic` class; keep the class too until W14 lands
- `data-ground="signal"` on the contact band

#### W7: Hero, editorial and HUD
- **Files:** `src/components/home/Hero.astro`, `src/styles/sections/hero.css`, `src/scripts/hero.ts`.
- **Spec:**
  - The name is set at `clamp(4.5rem, 17vw, 15rem)` with a forced break: line 1 "Victor" in roman Fraunces opsz 144 at weight 300, line 2 "*Neves*" in italic WONK 900, then the red Sinal dot (static `span`, **no animation**).
  - The essence "Sinal, não ruído." sits as a right-aligned mono-caps strap. Drop the glow; keep the grid at 4% opacity.
  - Add the zrk HUD: an `aria-hidden` mono corner block, `X 0000 · Y 0000 · 2026`. `hero.ts` updates it in rAF on stage pointermove (fine pointer only) using `textContent`.
  - Under reduced motion or a coarse pointer it shows static `-23.6° · -48.6°` coordinates (Palmas).
  - Keep the portrait, the brush canvas (kept in `hero.ts`) and the rotating badge (CSS rotation, paused under reduced motion).
  - The chips lose their magnetism (parallax only).
  - LCP stays the `<h1>` or the portrait. The portrait keeps `fetchpriority=high`.
- **Acceptance:**
  - No overflow at 320px. The h1 animations list `document.getAnimations()` filtered to h1 descendants is empty.
  - LCP on local Lighthouse mobile is ≤ 1200 ms, using the W17 command limited to `/`.
  - The standard gate passes.

#### W8: Section heads, chapters and numbers
- **Files:** `src/components/home/{About,Numbers,Expertise,Faq}.astro`, `src/styles/sections/{about,numbers,expertise,faq}.css`.
- **Spec:**
  - Every head uses `<p class="vn-eyebrow"><span aria-hidden="true">[ 0N — </span>{tag}<span aria-hidden="true"> ]</span></p>`.
  - Headlines become split display: the last 1-2 words go italic WONK, through a `<em>` that splits the existing string at its last space in the component (no data edits).
  - Chapter alternation: About is creme, Numbers ink, Expertise creme, FAQ creme with an ink divider. Use the W6 `.vn-chapter--*` classes.
  - Stat numbers are set at display size in Fraunces italic. Chart bars get a `scale: 1 0`→`1 1` scroll reveal with `.vn-sr`, transform only.
  - The FAQ stays native `<details>`. Add a `::details-content` height-free reveal using opacity + translate only, plus a rotating `+` marker.
- **Acceptance:**
  - axe is clean with both themes. Contrast holds on ink chapters: text `#e8dec5` on `#000` in dark.
  - Eyebrow text read by the accessibility tree equals the tag only. Check `getByText(tag)`, and check that brackets are absent from `innerText` of the visible-to-AT part. Test it in `e2e/sections.spec.ts` (new, owned by W8).
  - The standard gate passes.

#### W9: Projects, the view-transition morph and the case-study hero
- **Files:** `src/components/home/Projects.astro`, `src/styles/sections/{projects,transitions,case}.css`, `src/components/CaseStudyPage.astro`, `e2e/projects.spec.ts` (new).
- **Spec:**
  - Each row gets a visible thumbnail, `<img loading="lazy" decoding="async" width height>` from the existing `port/*.webp`, in `.vn-unveil`, with a hover zoom (`scale 1.06`, 600 ms).
  - Rows get `data-cursor-label` ("Ver case →" / "View case →") and `data-cursor-media`.
  - On mobile the thumbnail is shown inline, with no hover dependence.
  - `transitions.css` contains:
    - `@media (prefers-reduced-motion: no-preference){ @view-transition { navigation: auto } }`
    - a 250 ms root crossfade
    - six static rules of the form `[data-vt="caato"]{view-transition-name:project-caato}` (no inline styles, because of CSP)
  - Both the row thumbnail and the case hero image carry `data-vt="<slug>"`.
  - Case hero: an oversized title, the eyebrow `[ Case — 2025 ]`, and clip-path unveils on chapter images.
- **Acceptance:**
  - `projects.spec.ts`: each row has an image with width/height. The `data-vt` values are unique per page. Clicking a row navigates to the case and the case `h1` is visible.
  - Under reduced motion, `matchMedia('(prefers-reduced-motion: reduce)')` is true and the `@view-transition` rule sits only inside the no-preference block (assert on the built CSS text).
  - CLS check (W6) passes on `/` and `/projetos/caato/`.
  - The standard gate passes.

#### W10: Services as sticky stacking cards
- **Files:** `src/components/home/Services.astro`, `src/styles/sections/services.css`.
- **Spec:**
  - At ≥ 900px, cards are `position: sticky; top: calc(var(--nav-h) + 1rem + var(--i) * 0.75rem)`, with `--i` set through a per-index class `.vn-svc-1…8` (no style attributes).
  - Cards scale to `0.96` as the next one covers them, using `animation-timeline: view()` inside `@supports`.
  - `.vn-service-card:focus-within { z-index: 10 }` keeps focus visible (2.4.11).
  - Below 900px, and under reduced motion, cards return to the plain grid. Prices are set in Fraunces italic display.
- **Acceptance:** The W6 focus-not-obscured check passes across all 8 WhatsApp links at 1366. The CLS check passes. The standard gate passes.

#### W11: Journey as a scroll-snap gallery
- **Files:** `src/components/home/Journey.astro`, `src/styles/sections/journey.css`, `src/scripts/journey.ts`, `e2e/journey.spec.ts` (new).
- **Spec:**
  - Use `scroll-snap-type: x mandatory`. Prev/next buttons scroll by one card width (from `offsetWidth`, not 360).
  - ArrowLeft/Right work when the track has focus (`tabindex="0"`, `role="region"`, an `aria-label` from a component locale map).
  - A live mono counter `03 / 12` (`aria-live="polite"`) updates on `scrollend`, with a fallback to throttled scroll.
  - Mouse drag is kept; buttons satisfy 2.5.7.
  - Card entry uses `.vn-sr` with `animation-timeline: view(inline)`.
  - `journey.ts` loads via `onIdle` only when `#jornada` is within 1 viewport (IO), registered in `main.ts`.
- **Acceptance:** `journey.spec.ts` checks that the next button changes the counter from 01 to 02, ArrowRight works, and the counter is announced through its live region attribute. The standard gate passes.

#### W12: Contact band and the lazy "signal field" canvas
- **Files:** `src/components/home/Contact.astro`, `src/styles/sections/{contact,signal-field}.css`, `src/scripts/signal-field.ts`, `e2e/signal-field.spec.ts` (new).
- **Spec:**
  - The band stays `#f50000` with ink text in both themes (B9.3), with `data-ground="signal"`. The headline is oversized: "Bora fazer *sinal*?" / "Let's make *signal*?".
  - `signal-field.ts` is dynamically imported via `onIdle` + `motionOK()` + IO (band within 1 viewport).
    - It draws an `aria-hidden` canvas absolutely positioned behind the copy (space reserved by CSS, so no CLS). The grid is 24px ink dots at 0.18 alpha.
    - The dots near the pointer swell and shift toward it with a spring. Exactly one dot, the "signal", is creme, because a red dot would not show on the red band.
    - DPR is capped at 2. The rAF loop stops when settled, when the band is off-screen, or on `visibilitychange`.
    - If `getContext` fails, it gives up silently.
- **Acceptance:**
  - `signal-field.spec.ts`: there is no `signal-field.` request before load + idle. After scrolling to `#contato` and waiting, the canvas exists. Under reducedMotion, there is never a request.
  - Chunk ≤ 2.5 KB gz (check-budget). Text contrast of ink on `#f50000` passes axe. The standard gate passes.

#### W13: Theme toggle with a circular reveal
- **Files:** `src/scripts/theme.ts`, `src/styles/sections/theme-vt.css`.
- **Spec:**
  - On click, set `--vt-x` and `--vt-y` (the button centre) on `documentElement` through `style.setProperty`, then `startViewTransition`.
  - `::view-transition-new(root)` animates `clip-path: circle(0 at var(--vt-x) var(--vt-y))`→`circle(150% …)` over 600 ms, with `animation: none` on old.
  - Under reduced motion or with no VT support, the switch is instant. The theme-color meta update is unchanged.
- **Acceptance:** The existing theme e2e passes. Under reducedMotion, `startViewTransition` is not called; stub it via `addInitScript` and assert a counter. The standard gate passes.

#### W14: Magnetic (lazy)
- **Files:** `src/scripts/magnetic.ts`, `src/scripts/hero.ts` (remove the old magnetic block only, coordinate by doing it after W7 or in the same session).
- **Spec:**
  - Dynamically imported on `onFirstPointer` + `motionOK()`.
  - For `[data-magnetic]`, the offset per axis is `clamp(-6px, d·0.25, 6px)` within box + 24px, via rAF. On leave it returns to 0 over 450 ms with a CSS transition on `translate`.
  - It exposes `export function magnetTarget(el): {x, y} | null`, which gives W15 the snapped centre.
- **Acceptance:** Chunk ≤ 0.6 KB gz. It is not requested under reducedMotion (W6 test 5). The standard gate passes.

#### W15: Cursor layer B, the label pill and state machine (MUST-HAVE)
- **Files:** `src/scripts/cursor.ts`, `src/styles/sections/cursor.css`, `e2e/cursor.spec.ts` (new).
- **Load:** `main.ts` registers `onFirstPointer(() => motionOK() && import('./cursor.ts'))`. It is never imported at load, so Lighthouse, which never moves the pointer, pays 0.
- **Spec:** see §2a. The cursor is the only owner of `.vn-cursor` DOM, which it creates on import and removes on OFF.
- **Acceptance:** the §2a tests. Chunk ≤ 1.5 KB gz. The standard gate passes.

#### W16: Cursor layer A, the fluid trail (MUST-HAVE)
- **Files:** `src/scripts/cursor-trail.ts`, `e2e/cursor.spec.ts` (shared with W15: W16 adds one `test.describe('trail')` block at the end of the file. Run W16 after W15, or keep it in a separate file `e2e/cursor-trail.spec.ts`. **Recommended: the separate file**).
- **Load:** same trigger as W15, its own `import('./cursor-trail.ts')`.
- **Spec:** see §2a, Layer A. Chunk ≤ 4 KB gz.

### §2a. Cursor spec (confirmed from the lamalama.com bundle; the executor may tune the numbers in this box only)

```
TUNABLES (edit here, mirror in code as const at top of cursor.ts / cursor-trail.ts)
  TAU_DOT_MS = 30   TAU_PILL_MS = 150 (≈450ms settle)   SETTLE_EPS_PX = 0.1
  SHOW_MS = 50      HIDE_DELAY_MS = 350   HIDE_MS = 250
  DOT_PX = 8        LINK_SCALE = 3 (dot→24px)   PRESS_SCALE = 0.85 / 120ms
  MEDIA_W×H = 320×220, radius 14px
  TRAIL_SCALE = 1/36 × DPR (min 24px grid)   TRAIL_STOP_MS = 1500   TRAIL_OPACITY_MAX = 0.35
  TRAIL_DISSIPATION = 0.965/frame @60fps (scale by dt)
```

**Layer A: fluid trail (`cursor-trail.ts`, ≤ 4 KB gz)**
- One full-screen `<canvas class="vn-cursor-trail" aria-hidden="true">`, `position: fixed; inset: 0; pointer-events: none; z-index: 9997`, placed below the pill. It is sized at `innerWidth × TRAIL_SCALE`, then CSS-scaled with `image-rendering: auto`.
- WebGL2 → WebGL1. The two ping-pong textures are half-float when they can be rendered (`EXT_color_buffer_half_float` / `OES_texture_half_float` + a framebuffer completeness check). Otherwise they are `UNSIGNED_BYTE`.
- Per frame:
  - (1) The advection pass samples the previous frame at `uv - velocity·dt`, multiplied by dissipation.
  - (2) The splat pass injects a Gaussian at the pointer, with intensity proportional to `|velocity|` (clamped).
  - (3) The display pass outputs Sinal red `#f50000` (or `#ff3838` in dark) at `alpha = min(TRAIL_OPACITY_MAX, density)`.
- Blend: `mix-blend-mode: multiply` on light, `screen` on dark (via `[data-theme]`). On `[data-ground="signal"]` the trail is hidden: set opacity 0 whenever the last `elementFromPoint` is inside the band.
- The loop starts on pointermove and stops `TRAIL_STOP_MS` after the last move. It also stops on `visibilitychange` hidden and on `blur`.
- With no WebGL, a Canvas2D fallback draws fading red circles with `globalAlpha` decay and the same stop rule. If even 2D fails, it does nothing.
- It removes itself on OFF (the media query flips to reduce/coarse) and on `pagehide`.

**Layer B: dot + pill (`cursor.ts`, ≤ 1.5 KB gz), the B8 state machine**
- DOM: `<div class="vn-cursor" aria-hidden="true" data-state="hidden">` containing `.vn-cursor__dot`, `.vn-cursor__pill > span` and `.vn-cursor__media > img` (src set lazily from `data-cursor-media`, `alt=""`). Set `position: fixed; pointer-events: none; z-index: 9999`. **Never `cursor: none`.**
- States, all exclusive and written to `data-state`:
  - `hidden`
  - `idle`: the dot
  - `link`: dot scale 3, `mix-blend-mode: difference` over imagery
  - `label`: the pill **above** the pointer, `translate(-50%, -100%)` plus 12px. The text reveals with a clip-path/translateY line rise.
  - `media`: the 320×220 preview + pill
  - `text`: hidden over `input, textarea, select, [contenteditable]`
- Modifiers: `data-pressed` (squash `PRESS_SCALE`) and `data-ground="signal"` (ink pill, ink dot, no blend).
- Colours are inverted from the theme: an ink pill on creme, a creme pill on ink. On the Sinal band it is always an ink pill with creme text.
- Events (B8):
  - `pointerover`/`pointerout` with `closest()` on `[data-cursor-media], [data-cursor-label], a, button, [data-cursor]`
  - `pointerdown`/`pointerup`
  - `keydown` Tab or any key → `hidden` (never cover a focus ring)
  - `pointerleave` document / `blur` / `visibilitychange` → `hidden`
  - `scrollend` → re-evaluate `elementFromPoint(lastX, lastY)`
- Physics: `p += (t − p)·(1 − exp(−dt/τ))`. The rAF loop stops when every |Δ| < `SETTLE_EPS_PX` and restarts on the next event.
- Show is opacity over `SHOW_MS`. Hide waits `HIDE_DELAY_MS` (cancellable), then fades over `HIDE_MS`.
- Magnetic snap: in `link`/`label` over `[data-magnetic]`, the target becomes `magnetTarget(el)` from `magnetic.ts`, imported lazily. If it is not loaded, the cursor follows the pointer.
- OFF: a `matchMedia` change listener to coarse pointer or reduced motion removes the DOM and the listeners.

**Tests: `e2e/cursor.spec.ts` (W15) and `e2e/cursor-trail.spec.ts` (W16)**
1. No request matching `/_astro/cursor(-trail)?\./` happens after `goto('/')` plus `waitForLoadState('networkidle')`.
2. After `page.mouse.move(400,300)` then `move(420,320)`, both chunks are requested, `.vn-cursor` is attached with `data-state="idle"`, and `canvas.vn-cursor-trail` exists.
3. Hovering a project row gives `data-state` `media` (or `label`), and the pill text equals the row's `data-cursor-label`.
4. Pressing Tab gives `data-state="hidden"`.
5. Hovering an input or textarea, if any (inject a test input via `evaluate` when the page has none), gives `hidden`.
6. `getComputedStyle(document.body).cursor` and the `a` elements are never `none`.
7. With `emulateMedia({reducedMotion:'reduce'})` plus mouse moves, neither chunk is requested and `.vn-cursor` is absent.
8. With a `hasTouch`/`isMobile` context, neither chunk is requested.
9. The trail settles: 2 s after the last move, `window.__vnTrailRunning === false`. This is a debug flag set only when `location.search` includes `vn-debug`.

**Checkpoint R2 (revisor):** after W7-W16. Review:
- the motion rules from §1 (grep the section CSS for animated non-composited properties)
- CSP (no style attributes: `grep -rn 'style="' src/components`)
- the cursor state machine edge cases
- WebGL resource cleanup
- focus visibility
- budgets
- reduced-motion parity

Blockers must be fixed by the owning subtask.

### Phase 3: polish and verification (sequential)

#### W17: Lighthouse hardening and the strict budget
- **Files:** `lighthouserc.cjs` (add `/projetos/caato/` and `/en/projects/caato/`), `scripts/check-budget.mjs` (missing named lazy chunks become **fail**), any section CSS/component file for perf fixes (phase 2 is closed now).
- **Spec:** run LHCI mobile and desktop locally (§4). Fix regressions: image `sizes`, `fetchpriority`, unused CSS above 13 KB gz, long tasks.
- **Acceptance:** all URLs score 100/100/100/100 on both forms, with the LCP/CLS/TBT assertions green. The standard gate passes.

#### W18: Copy and microcopy pass
- **Files:** `src/i18n/ui.ts` and `src/data/portfolio.ts` (unfrozen now), plus the component locale maps.
- **Spec:**
  - Voice: direct, first person "eu", numbers instead of adjectives. Remove any adjective that has no number behind it.
  - Cursor labels are short verbs: "Ver case →", "Bora?", "Abrir", "Baixar CV", with en equivalents.
  - The tagline "Design, dados e código, sem ruído." appears exactly once on the home (footer or hero strap).
  - No new claims or numbers that are not already in the data.
- **Acceptance:** `e2e/a11y.spec.ts` passes, `npm test` passes (i18n key parity), and the standard gate passes.

**Checkpoint R3 (revisor), final:** full read of the phase-3 diff, the security headers and CSP unchanged in `astro.config.mjs`, the budgets output, and the LHCI reports in `.lighthouseci/`.

### Parallelism summary

| Wave | Subtasks (parallel within a wave) | Depends on |
|---|---|---|
| 1 | W1, W2, W3, W4, W5 | none |
| 1b | W6 | W2, W3, W4 |
| R1 | revisor | wave 1/1b |
| 2 | W7, W8, W9, W10, W11, W12, W13, W15, W16; W14 after W7 (it shares `hero.ts`) | R1 |
| R2 | revisor | wave 2 |
| 3 | W17, then W18 | R2 |
| R3 | revisor | wave 3 |

---

## 3. Review checkpoints (revisor, read-only, findings by severity)

- **R1 (foundation):** the budget graph logic, move-only diffs, CSP hash validity, the i18n fixes and test flakiness.
- **R2 (motion + cursor):** §1 motion rules, reduced-motion parity, WebGL/Canvas cleanup and loop stopping, the B8 transitions, 2.4.11, lazy-only loading, CSP.
- **R3 (final):** LHCI evidence on both forms, budgets, axe in both themes, no git changes and no AI mentions (`grep -rniE "claude|anthropic|\bAI\b|gpt" src docs scripts e2e tests`).

## 4. Final verification checklist

`@lhci/cli` is **not** a devDependency. CI uses `npx --yes @lhci/cli autorun`. Run the same thing locally, in PowerShell 7:

```
npm run build && npm run check:budget && npm run check:html && npm test && npx playwright test
$env:LHCI_FORM='mobile';  npx --yes @lhci/cli autorun --config=lighthouserc.cjs
$env:LHCI_FORM='desktop'; npx --yes @lhci/cli autorun --config=lighthouserc.cjs
```

If LHCI cannot start wrangler, start the server manually first with `npx wrangler pages dev dist --port 8788`. Then run `npx --yes lighthouse http://localhost:8788/ --preset=desktop --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./.lighthouseci/home-desktop.json`, and the same without `--preset` for mobile.

- [ ] Lighthouse is 100 ×4 on mobile + desktop for every URL in `lighthouserc.cjs`.
- [ ] `check:budget` shows first-load max ≤ 8192 B gz; lazy total ≤ 9216; cursor ≤ 1536, cursor-trail ≤ 4096, magnetic ≤ 614, signal-field ≤ 2560; inline CSS ≤ 13 KB gz on every page.
- [ ] axe is at 0 on all routes × light/dark × 390/1366.
- [ ] `gates.spec.ts` is green: reflow, target size, focus not obscured, text spacing, reduced motion, CLS ≤ 0.01, no-JS visibility.
- [ ] The cursor specs are green: lazy on first move, no load under reduce/touch, states, Tab hides, native cursor kept.
- [ ] Manual pass at 1366 in Chrome: trail subtle over text, pill readable in both themes, the VT morph from row to case works, the circular theme reveal works.
- [ ] `grep -rn 'style="' src` gives no hits in markup. Grep for `5563999999337` gives exactly one hit.
- [ ] No git operations were performed.

## 5. AWWWARDS self-score sheet (target ≥ 8/10 each)

| Criterion (weight) | Target | What earns the points | Where |
|---|---|---|---|
| **Design** (40%) | 8.5 | Oversized editorial type with deliberate breaks and italic/roman contrast (+2). Disciplined 3-colour palette with ink/creme chapters and clip-path wedges (+2). The Sinal dot as the only accent, everywhere (+1.5). Mono bracket eyebrows and HUD as a technical layer (+1.5). Consistent dark theme with no halation (+1.5) | W7, W8, W6, W12 |
| **Usability** (30%) | 9 | Lighthouse 100 on both forms, 0 axe violations, WCAG 2.2 extras tested (+3). Instant first paint with no hero animation (+2). Keyboard parity: journey keys, Tab hides the cursor, focus never obscured (+2). Reduced-motion parity, and the site works with no JS (+1.5). Bilingual with correct metadata (+0.5) | W6, W11, W15, W3, W5 |
| **Creativity** (20%) | 8 | The fluid Sinal trail plus the morphing pill cursor (+3). The signal-field easter egg (+2). The view-transition morph from thumbnail to case hero, and the circular theme reveal (+2). The live X/Y HUD (+1) | W16, W15, W12, W9, W13, W7 |
| **Content** (10%) | 8 | Numbers instead of adjectives, first person, short (+3). 6 real bilingual case studies (+2). Playful microcopy on the 404 and cursor labels (+1.5). Clear services with prices and one-tap WhatsApp (+1.5) | W18, W5, W10 |

Weighted target: 0.4·8.5 + 0.3·9 + 0.2·8 + 0.1·8 = **8.5**.
Biggest risks to the score: a weak photo/thumbnail quality (mitigation: unveil + zoom treatment, consistent 1px line border in dark), and the trail reading as noise (mitigation: opacity ≤ 0.35, off on the Sinal band, tune in the §2a box only).
