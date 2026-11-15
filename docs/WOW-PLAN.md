# WOW-PLAN: voaneves.com, from good to "Site of the Day" level

Status: ready to run, one subtask at a time per executor. Date: 2026-11-14.
Repo: `D:\GitHub\site` (Astro 7 static, `@voaneves/brand` 1.0.0). Brand spec: `D:\GitHub\brand\PLAN.md` B7-B10, D5.
Rule for every executor: **do not touch git** (no add, commit, branch or push). Do not edit files owned by another subtask
that is still open. Never add AI-tool attribution to any file.

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
- **R3 (final):** LHCI evidence on both forms, budgets, axe in both themes, no git changes and no AI-tool attribution in commits or files (grep for assistant and vendor names across src, docs, scripts, e2e and tests).

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

---

## U6. Cursor along the page, trail opt-out, a reaction in every section

**Why.** A visitor who is not impressed in 5 s leaves. The answer is not more effects. Every scroll stop should give one small, earned reward within a viewport, and the next action (a case, the contact form, WhatsApp) should always be one move away. era-residence.com is the bar for craft. lamalama.com is the reference for the cursor pill.

**What the references actually do** (read from their markup and scripts, described here in our own words):
- *era:* it has no custom cursor. It uses native context cursors (grab/grabbing on drag, zoom-in/out on images), magnetic circle buttons whose SVG arc grows from a short dash to half a ring on hover, and links whose letters roll out and back in while an underline wipes away. Hover cards reveal a heading, a paragraph and a line in sequence. Accordions animate their height. Map pins pulse, and their "+" rotates −90°. Sliders show a progress bar and a "01" counter. On scroll: each section declares its ground (light/colour/dark) and the header flips colour as that section crosses it. The hero image zooms ×2 while the next section rises over it. Every image has a ±15% parallax inside a clip. Text reveals are split into heading, paragraph and line. Timing uses 3 durations (.4/.8/1.2 s) and an "Out" ease of `cubic-bezier(.25,1,.5,1)`.
- *lamalama:* each section block carries its own set of 3–5 playful cursor labels and swaps the backdrop theme on entry. Mono eyebrow text decodes in. Cases use the media card plus the pill (we already ship both).

### U6.1 Cursor zones (declarative API, read in `ev()`)

- `data-cursor-zone="<variant>"` goes on the section. `ev()` resolves `el.closest('[data-cursor-zone]')` and writes `root.dataset.zone`. All styling is CSS inside the `CSS` string of cursor.ts, so it costs 0 inline bytes. Element rules still win over the zone: media > label > link.
- `data-cursor-idle="A|B|C"` goes on the section (optional, bilingual in markup). When the pointer enters a new zone, the pill decodes the next label in rotation, holds it for 1.4 s, then retracts. It shows once per entry and never while a link, label or media state is active. It is decorative (`aria-hidden` root), and every label repeats something visible in the section.

| Zone | Sections | Look (dot 8px Sinal by default) |
|---|---|---|
| `ring` | Hero, Numbers, 404 | 40px 1px creme ring around a 4px dot, scales 0.6 when pressed. Idle: `OI·HELLO`, `PROVA·PROOF` |
| `read` | About, FAQ, footer, case chapters | 6px dot, `mix-blend-mode:difference`. Quiet over long text |
| `plus` | Expertise, Services | 22px "+" (dot `::before`/`::after` bars). Rotates 90° on link hover (era pin) |
| `drag` | Journey | existing `drag` label plus ‹ › chevrons that spread 6px while pressed |
| `view` | Projects | unchanged media card. Idle: `CASES·WORK` |
| `signal` | Contact | 14px ink ring with no fill. Magnetic pull kept. Ink trail off (U6.2) |

### U6.2 Trail opt-out

`data-trail="off"` goes on a region (Contact). The trail's `ground()` already hit-tests every 24px or every 6th frame, so it adds `off = !!el?.closest('[data-trail="off"]')` there. While `off`, `r.frame` advects with no new dye, so the ink already on screen dissipates naturally. The canvas fades to opacity 0 through the existing `.4s` transition. On leave it returns to 1. `flag('__vnTrailOff', off)` is set for tests. This costs about 120 B gz.

### U6.3 One signature interaction per gap section (the rule is "decorate, never hide")

| Section | Interaction (era/lamalama pattern) | Mechanism, where | Keyboard / touch / reduce |
|---|---|---|---|
| About award cards | lift −4px plus pointer tilt ≤ 4° and a 1px line wipe | `data-fx="tilt"` in hover-fx.ts | static, no info lost |
| Numbers impact cards | pointer spotlight (radial Sinal glow at `--mx/--my`) on the ink band | `data-fx="spot"` in hover-fx.ts | static |
| Expertise pillars | lift plus chips cascading to a Sinal outline (30 ms stagger) | `data-fx="tilt"` plus CSS in the hover-fx sheet | `:focus-within` gives the same chip state (inline) |
| Services CTAs | era arc ring: the SVG dash grows to a half ring, magnetic | `data-fx="arc"`, inline CSS | `:focus-visible` gives the same arc |
| FAQ | animated open (`::details-content` + `interpolate-size`), "+" rotates to "×", pill `ABRIR·OPEN`/`FECHAR·CLOSE` | inline CSS, `data-cursor-label` on summary | native details, so keyboard works as is. Snaps open under reduce |
| Eyebrows (all sections) | mono `[bracket]` text decodes from noise on hover | `data-fx="scramble"` in hover-fx.ts | text in `aria-label` and the real DOM text restored. Off under reduce |
| Footer and header nav links | letter roll (text-shadow copy clipped, translateY −100%) | `data-fx="roll"`, inline CSS | `:focus-visible` gives the same roll |
| Header CTA, case CTA | `data-magnetic` plus `data-cursor-label` | markup only | — |
| Case spec list rows | line wipe plus label shift 8px | inline in case.css | `:focus-within` |
| 404 | `vn-beat` staggered entrance plus scrambling "404" | base.css, `data-fx="scramble"` | entrance off under reduce |

**Where the bytes go.** New file `src/scripts/hover-fx.ts` (≤ 1280 B gz). It loads through `onFirstPointer(() => motionOK() && import('./hover-fx'))`, adopts its own constructable sheet (tilt, spot, chip cascade) and uses one delegated `pointermove`, rAF-throttled. It never touches layout: only `transform` and custom properties. Inline CSS grows ≤ 400 B gz in total (arc, roll, FAQ, spec rows, vn-beat), which stays under the 13312 warn.

### U6.4 Subtasks (executor unless noted; every pair of parallel subtasks has disjoint files)

| Id | Owns (exclusive) | Acceptance | New e2e |
|---|---|---|---|
| U6a | src/scripts/cursor.ts | zones and idle labels per U6.1. Element states still win. Chunk ≤ 3072 gz | e2e/cursor-zones.spec.ts: one test per zone sets `data-zone` (6), idle label shows and retracts, rotates on re-entry, no idle during link, Tab still hides (10) |
| U6b | src/scripts/cursor-trail.ts | U6.2. Canvas opacity is 0 within 600 ms inside `#contato` and back on leave. No new dye while off | e2e/cursor-trail-optout.spec.ts: off in contact, on after leave, fades rather than cutting, ink colour unchanged elsewhere (4) |
| U6c | src/scripts/hover-fx.ts (new), src/scripts/main.ts, budget.json | tilt/spot/scramble per U6.3. Not requested under reduce, touch or before the first move. 0 CLS | e2e/hover-fx.spec.ts: lazy on first move, absent under reduce/touch, spot vars update, tilt resets on leave, scramble restores text and aria (6) |
| U6d | Hero.astro, About.astro, Numbers.astro, about.css, numbers.css | zone attributes, `data-fx` hooks, idle labels in PT/EN | covered by U6i |
| U6e | Expertise.astro, Services.astro, expertise.css, services.css | `plus` zone, arc SVG (`aria-hidden`), `:focus-visible` parity | e2e/services-arc.spec.ts: arc on hover and on focus (2) |
| U6f | Faq.astro, faq.css, Contact.astro, Journey.astro, Projects.astro | FAQ animation and labels, `data-trail="off"` + `signal` zone, `drag`/`view` zones | e2e/faq-fx.spec.ts: opens by Enter, icon rotates, reduce snaps open (3) |
| U6g | src/layouts/Base.astro, chrome.css, footer.css | magnetic header CTA, roll on nav/footer links, footer `read` zone | e2e/chrome-fx.spec.ts: CTA magnetic, roll on focus, 2.4.11 not obscured (3) |
| U6h | CaseStudyPage.astro, case.css, src/pages/404.astro, base.css | magnetic case CTA, spec rows, `read` zone, vn-beat | e2e/case-404-fx.spec.ts (4) |
| U6i | e2e/u6-coverage.spec.ts | every home section and the footer has a zone and at least one `data-fx`/label/magnet. 0 axe in both themes. CLS ≤ 0.01 with the pointer moving | (6) |
| U6j | revisor, read-only | R2 checklist, budgets, LHCI 100 ×4 on mobile and desktop | — |

That is about 38 new tests. None of the subtasks touch reveal.ts, count.ts, motion.css, Words.astro or portfolio.ts. **The working-tree fixes to those files must be committed before the worktrees branch from HEAD.**

**Parallelism and merge.** U6a–U6h run in parallel, one git worktree each (`git worktree add ../site-u6x -b u6x`). The attribute names in U6.1/U6.3 are the contract, so the markup and engine subtasks do not wait on each other. Merge order: U6b → U6a → U6c (engines and budget) → U6d, U6e, U6f, U6g, U6h (any order, no shared files) → U6i → U6j.

**Budget.** U6 adds about 0.5 KB to cursor, 0.1 KB to the trail and 1.0 KB for hover-fx. Lazy total ≈ 14.1/15.36 KB, so it fits. budget.json changes: `cursor` 2560→3072, add `"hover-fx": 1280`.

## U7. Scroll choreography at era level

**Why.** The user puts era-residence.com "a whole other level", and that is the bar. Every section should feel like a spectacle in both themes. U6k gave each section its own ground. U7 makes the moves *between* grounds the show, using native scroll only: no Lenis, no snapping and no scroll-jacking.

**What era does on scroll** (from its markup and its bundled script, read on 2026-11-15, described in our own words): it uses a GSAP + ScrollTrigger + SplitText stack with Lenis on top.
- *Grounds.* Each block declares `data-bg` = light (12), colour (7) or dark (2). As a block crosses the header, a trigger swaps a theme class on the header, both on the way down and on the way back up.
- *Hand-off.* The hero image is pre-scaled. On leaving, it scales up to ×2 while fading out ("In" ease), and the next block slides over it.
- *Parallax.* An image inside a clipped wrapper drifts −15% → +15% of its own height across the wrapper's whole pass (a lightly smoothed scrub). "In" and "out" variants run −20 → 0 on entry and 0 → 20% on exit. Containers counter-drift ±10%.
- *Text and lines.* Headings split into characters that rise 50% with a slight quarter-turn. Paragraphs split into masked lines that rise from below. Containers rise about 3.3 rem while fading in. Rules draw in with a top-to-bottom clip.
- *Timing.* Three durations, S .4 / M .8 / L 1.2 s, with a 0.1 s stagger. The "Out" ease is `cubic-bezier(.25,1,.5,1)` and the "In" ease is `cubic-bezier(.5,0,.75,0)`.
- *Moments.* A horizontal section wipes its panels in with a clip-path. Map pins pulse.

We copy no code or assets. We map each pattern onto CSS scroll-driven animations, which run on the compositor and cost no main-thread work while scrolling.

### U7.1 Inventory (HEAD 4275ea5)

| Asset | Today | U7 use |
|---|---|---|
| motion.css (inline) | U4 `[data-enter]` transitions (.9/1.3/1.8 s, ease (.16,1,.3,1)), mask headlines, `[data-drift]` on view(). `.vn-sr`/`.vn-par` rules and keyframes are **dead** (no markup uses them) | ladder retune. Delete the dead rules (about −110 B gz) |
| reveal.ts (first load) | IO `.is-in`. `lines()` sets `--l` for `[data-enter=mask]`. `.vn-sr` branch is dead | `lines()` also handles `[data-enter=lines]`. Drop the `.vn-sr` branch |
| services.css | sticky card stack plus a `vn-svc-under` scale on named view timelines (≥900 px) | stays Moment 0. Untouched |
| themes.css / theme.ts | ground presets `--g-*` per section. **The trim task is editing them now** | read-only for U7 |
| navbar (brand) | `background: color-mix(var(--vn-surface) 88%)`, blur, `--vn-line` border | ground flip writes these vars on the element (U7.3) |
| render-cost.css | `content-visibility:auto` on the 8 sections below the hero | view timelines must still resolve. Tested in U7i |
| hero-fx.ts | writes `transform` on the portrait wrap, chips and badge | U7 uses only the individual `translate`/`scale` properties on *other* nodes, so the two never fight |
| Gauges | first-load 3402/8192, lazy total 14539/15360, inline CSS 13922/14336 (trim → about 13 000), home HTML 31873/32768 gz | see U7.7 |

**Engine (decision).** New `src/scripts/scroll-fx.ts`, loaded `onIdle` on every page when `(prefers-reduced-motion: no-preference)`. It is *not* gated on `motionOK()`, because touch phones must get the show too. It adopts a constructable sheet built from `src/styles/fx/*.css?inline`, which Vite minifies (if `?inline` turns out not to minify in the Astro build, fall back to `?raw` plus a manual minify step in U7a). The sheet goes into `@layer site`, so it never outranks the unlayered brand rules by accident. Two strings:
- `BASE` is always adopted: line-split styles and rules.
- `TL` is adopted only if `CSS.supports('animation-timeline: view()')`, and it also sits inside `@supports`.

Every timeline rule lives inside `@media screen and (prefers-reduced-motion: no-preference)`, animates only `translate`/`scale`/`opacity`/`clip-path`, and is **identity at `scrollY = 0`**. Pre-scroll effects use `scroll(root)` with `animation-range: 0 100svh`, so adopting the sheet at idle changes no pixel above the fold: no LCP risk and no CLS. Entry clips use `animation-fill-mode: backwards`, so no clip is left over after the range ends. Any section being clipped gets `:focus-within { animation: none }` (WCAG 2.4.11).

### U7.2 Hand-offs (each pair has a named technique; e = view() entry, x = view() exit)

| Pair | Name | Technique (U7c, `fx/handoff.css`) |
|---|---|---|
| Hero → About | **Sink & lift** | On `scroll(root)` 0→100svh, `.vn-hero__inner` translates 0→14vh and lags, clipped by the hero's `overflow:hidden`. A new `.vn-hero::after` scrim (`background: var(--g-bg, #0a0a0a)`, z above the inner) goes opacity 0→.55 over the 45–100% range. `#quem-sou::before` (the wedge) scales Y 0→1 from the bottom over e 0–60% |
| About → Numbers | **Ink tide** | `#numeros` clip-path goes from `inset(5rem 4vw 0 round 3rem 3rem 0 0)` to `inset(-3vw 0 0 round 0)` over e 0–100% (the negative top keeps the wedge). `.vn-stats-hero-grid` rises 6rem→0 over e 20–100% |
| Numbers → Expertise | **Counter-drift + wedge lift** | The `#numeros > .vn-container` translate goes 0→−8vh over x 0–100% (era's container counter-parallax). `#expertise::before` scales Y 0→1 over e 0–60% |
| Expertise → Journey | **Side shutter** | `#jornada` clip-path goes from `inset(0 12vw round 2rem)` to `inset(0 round 0)` over e 0–100%. It foreshadows the horizontal track |
| Journey → Projects | **Hand-under** | `#jornada > .vn-container:first-of-type` scales 1→.96 and translates 0→−4vh over x 0–100% (the same "card goes under" grammar as the Services stack) |
| Projects → Services | **Horizon rise** | `#servicos` clip-path goes from `inset(4rem 0 0 round 50% 50% 0 0 / 4rem 4rem 0 0)` to `inset(0 round 0)` over e 0–80%. It echoes the "dawn" theme VT. A clip-path never breaks `position:sticky`, so the stack is unaffected |
| Services → FAQ | **Wedge lift + drift** | `#perguntas::before` scales Y 0→1. The FAQ h2 gets `data-drift` (markup in U7f), which reuses the existing inline drift |
| FAQ → Contact | **Lamp on** | The existing wipe becomes scrubbed: `#contato` clip-path goes from `inset(4rem 5vw 0 round 3rem)` to `inset(0 round 0)` over e 0–100%. The animation overrides the U4 transition only where timelines exist. Elsewhere the IO wipe stays |
| Contact → footer | **Sinal set** | The `#contato > .vn-container` translate goes 0→−10vh over x 0–100%. `.vn-site-footer__inner` rises 4rem→0 over footer e 0–100% |

Rule: **never fade text on exit**. Opacity is used only on the decorative scrim, so axe contrast holds at any scroll position.

### U7.3 Header ground flip (U7b, `nav.ts`, first load ≤ 220 B gz, 0 CSS)

An IntersectionObserver uses a 1 px line at the header's mid-height: `rootMargin: -(h/2)px 0px -(innerHeight − h/2 − 1)px`, with `h = navbar.offsetHeight`, rebuilt on `resize` and debounced. It observes `main > section, main > article > section, .vn-site-footer`. When the line enters a ground, it reads `getComputedStyle(sec)` and writes these onto `.vn-navbar`:
- `--vn-surface` (the bg),
- `--vn-line`,
- `--vn-text` and `color`,
- `colorScheme`: `light` when the text is dark (the sum of the RGB channels is below 382), otherwise `dark`. This keeps the CTA and icon buttons correct on Contact red in both themes,
- `dataset.ground = sec.id || 'footer'`, as a test hook.

The flip is instant at the edge, the same as era. `background-color` is not animated (motion rule).

A `MutationObserver` on `<html data-theme>` re-applies the current ground after a toggle. It runs as a microtask, so the change lands before the view-transition snapshot.

Resulting header colours:
- Light: paper, creme, **tinta** (Numbers), paper, creme, paper, creme, paper, **signal** (ink text), creme.
- Dark: tinta, night, graphite, tinta, night, graphite, night, tinta, signal, night.

**theme-color follow (opt-in, on):** every `meta[name=theme-color]` gets the ground's bg. At the top of the page it equals the U6k values, so themes-rhythm test 11 still holds.

Without JS, or before init, today's header stays.

### U7.4 Split reveals and the ladder (U7e `fx/text.css`, U7f markup)

- **Ladder:** S .4 s for eyebrows, rules and chips; M .8 s for paragraph lines and opacity; L 1.2 s for heading lines, translate, scale, clip-path and media. Ease is "Out" `(.25,1,.5,1)` everywhere. Delay is `--i·100ms + --l·100ms`. Paragraphs start +200 ms after the heading of their group.
- motion.css transitions become `opacity .8s, translate 1.2s, scale 1.2s, clip-path 1.2s`. That is byte-neutral, and `is-done` at 3200 ms still covers it.
- **Headings:** every h2 already masks, except the Journey h2. U7f moves it to `<Words>` + `data-enter="mask"` and converts Journey's `.vn-reveal` to `data-enter`.
- **Never split:** the hero h1/sub, the case h1/summary, and the 404/privacy h1/intro (LCP rule).
- **Paragraph lines:** `data-enter="lines"` goes on About p1 and the subtitles of Numbers, Journey, Projects, Services, FAQ and Contact, plus the case chapter leads. Before the element enters, scroll-fx.ts (U7a) wraps its words in `.vn-w` spans, keeping the text nodes and spaces so the accessible name is unchanged. The words only become inline-block once they are wrapped. Then reveal.ts `lines()` assigns `--l`.
  - If scroll-fx has not run yet, the block falls back to the plain U4 fade-rise.
  - `fx/text.css`: `[data-enter=lines]:has(.vn-w){--o:0;--y:0}` plus a word rule like the mask headlines, at M .8 s.
- **Eyebrows:** clip wipe `inset(0 100% 0 0)` → `inset(0)` at S .4 s on `.is-in`.
- **Rules** (era "line"): `.vn-spec-list__row`, `.vn-faq-item` and `.vn-work-row` get `border-color: transparent` plus an `::after` 1 px hairline (`background: var(--vn-line)`). Its scaleX goes 0→1 from the left over e 10–60%. This is TL only, so without timelines the real border stays.

### U7.5 Parallax in clips (U7d `fx/parallax.css`) and moments (U7g `fx/moments.css`)

- **Hero portrait** `.vn-hero-portrait__img`: on `scroll(root)` 0→100svh, scale goes 1→1.15 and translate goes 0→6% (era's hero zoom, toned down). Identity at the top, so the LCP image is never transformed at load and never at opacity 0. The wrap's `transform` from hero-fx still composes on top.
- **Project thumbnails** `.vn-project-row__media img`: `scale: 1.18` plus translate −8%→+8% over view() cover. This replaces the U4 img zoom only where timelines exist. The container clip reveal stays.
- **Case hero** `.vn-case-media img`: on `scroll(root)` 0→100svh, scale 1→1.1 and translate 0→5%. It is the case-page LCP, so it is identity at the top. Lives in `fx/case.css`.
- **Moment 1, "Proof board"** (Numbers, ≥1100 px and min-height 760 px):
  - `.vn-chart-panel { position: sticky; top: calc(var(--nav-h) + 2rem); align-self: start }`. This goes **inline** in numbers.css (about +60 B), so the layout is final at first paint (no CLS when the sheet is adopted).
  - `.vn-chart-svg__fill` (`transform-box: fill-box; transform-origin: left`) scaleX goes 0→1 over the panel's view() e 50% → contain 30%, while count.ts ticks the stats.
  - No added height, so the `--ci` seeds hold. The sr-only table is unchanged.
- **Moment 2, "Track focus"** (Journey): each `.vn-journey-card` gets `animation-timeline: view(inline)` on the horizontal track. Scale goes .92→1→.92 and translate 3rem→0→0 across entry/exit. The progress bar and the "01 / NN" counter already exist (era's slider pattern).
- **Moment 0:** the Services sticky stack, unchanged.
- **Rejected:** a pinned horizontal Projects reveal. It needs about 3× viewport of runway (the `--ci` seeds and anchors break), Tab order would diverge from the visual x position, and it is scroll-jacking in effect. Revisit in U8.

### U7.6 Case, 404, privacy (U7h)

- **Case:** "Sink & lift" applied to `.vn-case-hero > .vn-container` (translate 0→10vh on `scroll(root)`), plus the case-media parallax, the chapter leads on `lines`, spec rows as rules, KPIs `data-stagger` rising over 1.2 s, and the header flip from the inverse hero to paper.
- **404 / privacy:** pages are short and the LCP is text, so the only additions are the header flip and the footer "Sinal set". `vn-beat` is unchanged.

### U7.7 Budget

| Item | Now | U7 | Rule |
|---|---|---|---|
| Lazy chunk `scroll-fx` | — | about 1.9 KB gz (JS ≈ 350 B, CSS ≈ 1.55 KB) | `"scroll-fx": 2304` |
| Lazy total | 14539 | ≈ 16450 | **raise `lazyJsGzMaxBytes` 15360 → 17408** |
| First load (max) | 3402 | ≤ +150 net (nav +220, reveal −70) | ≤ 8192 |
| Inline CSS | 13922 (trim → ~13 000) | ≤ 0 net (dead `.vn-sr`/`.vn-par` −110, sticky +60, ladder ±0) | U7 must not raise it |
| HTML per page | home 31873 | ≤ +200 gz (`lines` attrs, Journey Words) | ≤ 32768 |

**Why raise the lazy budget.** The chunk loads after `load` in idle time and runs once. While scrolling, the work happens on the compositor, so TBT, LCP and CLS do not move. It replaces what would otherwise be about 12 KB of GSAP + ScrollTrigger. The 17408 cap leaves about 560 B of headroom.

### U7.8 Subtasks (executor unless noted; a worktree per parallel subtask; disjoint files)

| Id | Owns | Acceptance | New e2e |
|---|---|---|---|
| U7a | `src/scripts/scroll-fx.ts` (new), `src/scripts/main.ts`, `budget.json`, `src/styles/fx/{handoff,parallax,text,moments,case}.css` (empty stubs with a header comment), `e2e/gates.spec.ts` (add `scroll-fx` to the reduced-motion lazy regex) | Loads on idle under no-preference on all 5 LHCI URLs. Not requested under reduce. BASE/TL split and the `CSS.supports` gate. Word split preserves `textContent` and the accessible name, and skips elements that are already `.is-in`. Chunk ≤ 2304 | `e2e/scroll-fx.spec.ts` (5): lazy load, reduce → no request, TL adopted only when supported, split keeps text and name, no split after `.is-in` |
| U7b | `src/scripts/nav.ts`, `e2e/header-ground.spec.ts` | U7.3. Ground and colour equal the section's at 10 probe points in both themes. The toggle re-applies. theme-color follows. axe 0 on the header over every ground. First load +≤ 220 | (8) a sequence per theme (2), toggle mid-page (1), signal → ink text and light scheme (1), theme-color top and Numbers (2), resize keeps the line (1), no-JS default header (1) |
| U7c | `src/styles/fx/handoff.css`, `e2e/handoffs.spec.ts` | 9 techniques per U7.2. Identity at scrollY 0. No opacity on text. `:focus-within` cancels the clip | (11) one per pair: the computed `translate`/`scale`/`clipPath` at progress 0, 0.5 and 1 (9), identity at the top (1), focus inside a clipped `#numeros` → `clip-path: none` (1) |
| U7d | `src/styles/fx/parallax.css`, `e2e/parallax.spec.ts` | Hero ≤ 1.15/6%. Project thumbs ±8% with no clip edge showing (img rect ⊇ media rect at 0 and 1). LCP img `opacity: 1` and identity at load | (4) |
| U7e | `src/styles/fx/text.css`, `e2e/split-reveal.spec.ts` | U7.4 line words get `--l` and rise per the ladder. Eyebrow wipe. Rules draw. Without timelines, borders are visible | (6) |
| U7f | About, Numbers, Expertise, Journey, Projects, Services, Faq, Contact `.astro`; `src/scripts/reveal.ts`; `src/styles/sections/motion.css`; `src/styles/sections/numbers.css`. **Starts after the trim task merges** (motion.css is inline-budget critical) | `lines` attrs, Journey Words/data-enter, FAQ `data-drift`, the ladder, dead CSS and JS removed, Moment-1 sticky. Inline CSS net ≤ 0. HTML +≤ 200 gz. Existing choreography and sections specs green | updates `e2e/choreography.spec.ts` for the new durations (≤ 3 edits) |
| U7g | `src/styles/fx/moments.css`, `e2e/moments.spec.ts` | Chart bars scaleX 0→1 tied to scroll. Panel sticky ≥1100 px. Journey cards scale by inline position. Keyboard arrows/Tab are unchanged | (5) |
| U7h | `src/styles/fx/case.css`, `src/components/CaseStudyPage.astro`, `e2e/case-scroll.spec.ts` | U7.6. Case LCP identity at load | (4) |
| U7i | `e2e/scroll-fx-gates.spec.ts` | Full-page scroll at 390 and 1440, both themes: CLS ≤ 0.01, no long task > 50 ms. Reduced-motion parity (no running animations, no `scroll-fx` request, all content visible). Fallback: `addInitScript` stubs `CSS.supports` to false for `animation-timeline`, so no TL sheet is adopted, every transform and clip is `none` at 5 scroll positions, and content is visible. axe at the mid-hand-off positions in both themes. View timelines resolve inside `content-visibility:auto` sections | (8) |
| U7j | revisor (read-only) | Composited-only audit, focus clipping, contrast over scrim and grounds, LHCI 100 ×4 mobile + desktop on the 5 URLs (LCP ≤ 1200/800, CLS ≤ 0.01, TBT ≤ 50), budgets per U7.7 | findings by severity, no high open |

**Test method.** Scroll so that the target's progress is p, wait two rAF, then read the computed `translate`/`scale`/`clip-path`. Assert that `document.getAnimations()` contains animations whose `timeline` is a `ViewTimeline`/`ScrollTimeline`. Tolerance ±2%. This adds about 51 tests.

**Merge order:** trim task → **U7a** → U7b, U7c, U7d, U7g in parallel (no shared files) → **U7f** → U7e and U7h (they need U7f's markup) → U7i → U7j. Each subtask passes the standard gate. U7 ships only after U7j's LHCI is green on both form factors.

## U6k. Two themes, two spectacles: paper day and ink night, with a ground rhythm per section

**Why.** User feedback: "the white theme is not really white, all sections maintain the same. I'd like a clear distinction between modes and each like a spectacle." The bar is era-residence.com, where every section declares a light, colour or dark ground with a deliberate rhythm, and lamalama.com, which swaps the backdrop theme per section.

### U6k.1 Evidence (build of da3ce7f, `wrangler pages dev dist --port 8820`, Chrome, 1440×900, full page, `vn-theme` stored)

Probe: computed `background-color` / `color` of each home section in both themes.

| Section | Light now: bg / text | Dark now: bg / text | Same in both? | Why it does not flip |
|---|---|---|---|---|
| Body / page ground | #f4ead4 / #0a0a0a | #0a0a0a / #e8dec5 | no | `--vn-surface` light is cream-100, so "light" is cream, not white |
| Hero `#inicio` (inverse) | #0a0a0a / #f4ead4 | #0a0a0a / #f4ead4 | **yes** | hero.css hardcodes `--vn-ref-ink-950` plus about 20 cream/rgba literals |
| 01 About `#quem-sou` | #e8dec5 / #000 | #e8dec5 / #000 | **yes** | `.vn-chapter--creme` in motion.css hardcodes `#e8dec5`, `#000` and muted `#3d3a33` |
| 02 Numbers `#numeros` (inverse) | #000 / #e8dec5 | #000 / #e8dec5 | **yes** | `.vn-chapter--ink` hardcodes `#000`, and numbers.css uses ref cream tokens |
| 03 Expertise | #e8dec5 / #000 | #e8dec5 / #000 | **yes** | `.vn-chapter--creme` |
| 04 Journey (soft) | #efe4c5 / #0a0a0a | #141414 / #e8dec5 | no | brand `--vn-surface-soft` is `light-dark()` |
| 05 Projects | transparent (body #f4ead4) | transparent (body #0a0a0a) | no | inherits the body |
| 06 Services (soft) | #efe4c5 / #0a0a0a | #141414 / #e8dec5 | no | as Journey |
| 07 FAQ | #e8dec5 / #000 | #e8dec5 / #000 | **yes** | `.vn-chapter--creme` |
| 08 Contact (signal) | #f50000 / #0a0a0a | #f50000 / #0a0a0a | **yes, by rule** | contact.css `--vn-ref-red-600`. Brand B9.3: the Sinal band stays #f50000 with ink text in both themes |
| Footer | transparent (body) | transparent (body) | no | inherits the body |
| `meta[name=theme-color]` on load | **#0a0a0a** | #0a0a0a | **yes (bug)** | Base.astro ships one static `#0a0a0a`, and theme.ts only updates it on click. This breaks B9.6 |

Conclusion: 6 of the 10 home grounds are identical in both modes, and the 3 that flip only move between three creams 1.1:1 apart (#f4ead4, #efe4c5, #e8dec5). Light mode reads as "beige with black and red blocks", and dark mode is the same page with only Journey, Projects and Services darkened. In dark mode, three cream chapters (About, Expertise, FAQ) break the night. Root cause in the system: brand `[data-surface=inverse|signal]` sets only `background-color`/`color`, never `color-scheme`. `light-dark()` tokens inside an inverse section therefore resolve to their *light* values, so each section hardcoded its colours to stay legible. Those literals do not follow the theme.

### U6k.2 Decisions

1. **Light = "paper day" (warm gallery white).** Use a new ground `paper` #fdfbf6 (a warm off-white, 1.29:1 against cream-300, so creme now reads as a *colour* ground and no longer as the page). Choose warm over cool: the brand's neutrals are all warm (cream, sand), Sinal #f50000 is a warm red, and a blue-white would make the sand muted text look dirty. Do not use pure #fff for the ground: it is reserved for raised cards, which keeps cards readable on paper with their existing 1px `--vn-line` border. Rejected: pure white ground (sterile, cards disappear) and cream-100 as today (that is the complaint).
2. **Dark = "ink night".** Use only the brand darks: Tinta #0a0a0a, night #000 and graphite ink-900 #1a1a1a. Text stays cream-300 #e8dec5, never pure white (B9.2). There is no cream chapter in dark mode. The night's "colour" grounds are the **ember** Numbers band (graphite plus a static Sinal radial glow) and the Sinal contact band.
3. **Rhythms are different, not mirrored.** Light alternates paper and creme in a 2-beat, with one Tinta counterpoint (Numbers). Dark runs a 3-beat Tinta, night, graphite cycle, with the ember at Numbers. Every section except Contact changes its computed ground, 8 of 10 change luminance class, and no two adjacent sections share a ground in either mode.
4. **Contact keeps #f50000 + ink in both themes** (B9.3, plus `signal-field.spec` asserts `rgb(245, 0, 0)`). It differs by framing. In light it sits between paper and creme as a hot block, and in dark it is the only bright plane between Tinta and night, a lamp in the dark.
5. **One mechanism: ground presets that set `color-scheme`.** Each preset sets `color-scheme` plus the semantic tokens, so every brand `light-dark()` token inside the section (buttons, chips, lines, focus, muted) resolves for that ground with no per-component overrides. Sections are addressed by their existing ids from the new `themes.css`, so no `.astro` or owned CSS file is touched.
6. **Site-local now, upstream later.** The brand is a vendored tgz and U6a–h run in parallel, so U6k ships in the site. A brand 1.1 proposal follows (§U6k.8). When it lands, `themes.css` shrinks to the section map.

### U6k.3 Ground presets (token map; contrast measured, WCAG 2.x)

| Preset | bg | text (ratio) | muted (ratio) | line | small red text (ratio) | `color-scheme` |
|---|---|---|---|---|---|---|
| `paper` | `--vn-ref-paper` #fdfbf6 (new, site-local) | ink-950 (19.14) | sand-800 #5c5446 (7.22) | rgba(10,10,10,.12) | red-800 #b80000 (6.68). Sinal #f50000 only ≥ 24px / 18.66px bold (4.16) | light |
| `creme` | cream-300 #e8dec5 | ink-950 (14.79) | sand-800 (5.58) | rgba(10,10,10,.12) | red-800 (5.16). Sinal large only (3.21) | light |
| `tinta` | ink-950 #0a0a0a | cream-300 (14.79) | sand-500 #a69c86 (7.28) | rgba(232,222,197,.14) | red-450 #ff3838 (5.54) | dark |
| `night` | ink-1000 #000 | cream-300 (15.69) | sand-500 (7.72) | rgba(232,222,197,.14) | red-450 (5.87) | dark |
| `graphite` | ink-900 #1a1a1a | cream-300 (13.00) | sand-500 (6.40) | rgba(232,222,197,.14) | red-450 (4.87) | dark |
| `signal` | red-600 #f50000 (unchanged) | ink-950 (4.60) | ink-950 | — | — | unchanged |

Root overrides (`:root[data-theme=light]`): `--vn-surface: var(--vn-ref-paper)` (body, navbar glass, case/privacy/404 pages turn paper automatically), `--vn-surface-soft: var(--vn-ref-cream-300)`, `--vn-surface-raised: #fff`. Dark root: unchanged.

Each preset writes private vars `--g-bg --g-fg --g-muted --g-line --g-red` and `color-scheme`. One shared rule maps them onto the grounds: `background-color: var(--g-bg); color: var(--g-fg); --vn-text: var(--g-fg); --vn-text-muted: var(--g-muted); --vn-text-on-inverse: var(--g-fg); --vn-text-muted-on-inverse: var(--g-muted); --vn-line: var(--g-line); --vn-signal-ink: var(--g-red)`. Selectors are `#id` (1,0,0), so they beat `.vn-chapter--*`, `[data-surface]` and `.vn-hero` without `!important`. Chapter wedges (`::before { background: inherit }`) follow automatically.

### U6k.4 Section rhythm per mode (current → proposed)

| # | Section | Light now | **Light proposed** | Dark now | **Dark proposed** |
|---|---|---|---|---|---|
| — | Hero `#inicio` | #0a0a0a | **paper**: ink type, red dot, 5% ink grid, portrait as a print | #0a0a0a | **tinta** + 4% cream grid (as today) |
| 01 | About `#quem-sou` | #e8dec5 | **creme** | #e8dec5 | **night** |
| 02 | Numbers `#numeros` | #000 | **tinta** (the one dark counterpoint of the day; `color-scheme: dark`) | #000 | **graphite + ember**: `background-image: radial-gradient(60% 80% at 50% 0%, rgb(255 56 56 / .16), transparent 70%)`, static |
| 03 | Expertise | #e8dec5 | **paper** | #e8dec5 | **tinta** |
| 04 | Journey | #efe4c5 | **creme** | #141414 | **night** |
| 05 | Projects | body | **paper** | body | **graphite** |
| 06 | Services | #efe4c5 | **creme** | #141414 | **night** |
| 07 | FAQ | #e8dec5 | **paper** | #e8dec5 | **tinta** |
| 08 | Contact | #f50000 | **signal** (unchanged) | #f50000 | **signal** (unchanged) |
| — | Footer `.vn-site-footer` | body | **creme** | body | **night** |

Sequences: light P C T P C P C P S C · dark T N G T N G N T S N. There are no adjacent repeats, and the patterns differ in period and accent position.

**Hero, light.** hero.css is refactored to local custom properties with today's dark values as defaults (§U6k.6, U6k-3). `themes.css` sets the light values on `:root[data-theme=light] #inicio`:

| Var | Default (dark, today) | Light |
|---|---|---|
| `--hero-fg` | cream | ink-950 |
| `--hero-muted` | sand-500 / cream-300 | sand-800 |
| `--hero-line` | `--vn-line-on-dark` / rgba(244,234,212,.22) | rgba(10,10,10,.14) |
| `--hero-grid` | rgba(244,234,212,.04) | rgba(10,10,10,.05) |
| `--hero-panel` (pill, chip) | ink-900 / rgba(20,20,20,.92) | rgba(253,251,246,.92) |
| `--hero-accent` (kicker, status text; today red-400 #ff5a5a) | red-400 | red-800 #b80000 |
| `--hero-btn-fg` (ghost/secondary/CV) | cream | ink-950 |
| `--hero-frame-shadow` | 0 32px 72px rgba(0,0,0,.65) | 0 30px 60px -20px rgba(10,10,10,.28) |
| `--hero-img-filter` | grayscale(1) contrast(1.08) | grayscale(1) sepia(.12) contrast(1.02) |

The badge (ink seal) and the red dot stay the same in both. In dark, `--hero-img-filter: grayscale(1) contrast(1.18) brightness(.94)` gives a harder night print.

**Images.** Brand B9.5 says photos are unchanged across themes, so project screenshots keep full colour and a 1px `--vn-line` border in both modes. Only the hero portrait is art-directed: a warm silver-gelatin print on a white mat in light, a hard high-contrast print emerging from Tinta in dark. These are static filters only and are never transitioned (the filter-animation ban holds). The LCP image keeps no hidden state. hero-fx.ts's hover sheen grid literal `rgba(244,234,212,.2)` becomes `color-mix(in srgb, currentColor 20%, transparent)` so it shows on paper.

**Cursor and trail ink.** cursor-trail.ts already picks its ink from the computed ground: `signal` gives INK, luminance < .45 gives RED_HOT, otherwise RED. With the new grounds this is correct in both modes with **no code change**: red #f50000 on paper/creme, hot red on tinta/night/graphite (including light-mode Numbers), ink on Contact (where U6b turns the trail off anyway). Decision: keep the trail red in both modes (it is the brand's one motion motif). An ink-wash trail for the day mode was considered and rejected. The cursor `ring` zone (U6a, "1px creme ring") would vanish on the paper hero, so that becomes post-merge step PM2.

**theme-color.** Light #fdfbf6, dark #0a0a0a. It is set on load as well as on toggle (it is wrong on load today).

**Toggle transition (View Transition, a different signature per direction).** These rules replace theme-vt.css:
- **To dark, "ink spill":** `::view-transition-new(root)` clips `circle(0 → var(--vt-r))` at the toggle, with `scale: 1.04 → 1`, over .8s `cubic-bezier(.25,1,.5,1)` (the era "Out" ease). `--vt-r` is the exact distance to the farthest corner (theme.ts), so the full duration is spent on screen. Today 150% wastes about a third of it off screen.
- **To light, "dawn":** new root `clip-path: inset(100% 0 0 0 round 50% 50% 0 0) → inset(0 round 0)`, a horizon arch rising from the bottom, over .9s with the same ease.
- **The toggle itself:** `#vn-theme-toggle { view-transition-name: vn-toggle }`, then `::view-transition-new(vn-toggle)` spins from `rotate: -180deg; scale: .4` and the old one is hidden. The sun/moon turns while the world flips.
- Selected by `:root[data-theme=dark|light]::view-transition-new(root)`. The pseudos match the new state, so no JS is needed for direction. Everything sits inside `@media (prefers-reduced-motion: no-preference)`. Under reduce, theme.ts already skips `startViewTransition`, so the switch is instant. Only `clip-path`, `scale` and `rotate` are animated.

### U6k.5 Budget

Measured by appending a minified draft of `themes.css` to the real inline CSS of `dist/index.html`: base 12670 B gz (the budget script reports 12762) → **+728 B gz**, or **+664 B** once theme-vt.css is removed. Deleting the now-dead colour declarations from the `.vn-chapter--*` rules in motion.css saves about 40 B more. The hero var refactor is about byte-neutral. **U6k cap: +650 B gz net.** Alone that lands at about 13.41 KB. Together with U6.3's ≤ +400 B, it lands at about 13.8 KB, which is under the 14336 hard max but over the 13312 warn. Recommendation: accept, and raise `inlineCssGzWarnBytes` to 13824 as post-merge PM3 (budget.json belongs to U6c). If LHCI or the revisor objects, the trims are: drop the ember gradient (−40 B), drop the toggle spin (−60 B), merge `night` into `tinta` (−50 B). First-load JS grows by about 70 B gz (theme.ts), within 8192. Lazy JS is unchanged.

### U6k.6 Subtasks (disjoint from U6a–U6h; worktree `../site-u6k`, branch `u6k`)

| Id | Role | Owns (exclusive) | Work | Acceptance |
|---|---|---|---|---|
| U6k-1 | executor | `src/styles/sections/themes.css` (new), `src/styles/site.css`, `src/styles/sections/motion.css`, `src/styles/sections/theme-vt.css` (moved to `D:\GitHub\pode_apagar\site-theme-vt.css`, not deleted) | `@layer site`. `:root { --vn-ref-paper: #fdfbf6 }`, the light root overrides, the 6 presets and the shared mapping rule of §U6k.3, the section map of §U6k.4 (ids `#inicio #quem-sou #numeros #expertise #jornada #projetos #servicos #perguntas`, `.vn-site-footer`), the dark Numbers ember, the light/dark `--hero-*` values, the VT rules and keyframes `vn-dusk`, `vn-dawn` and `vn-spin`. In site.css, replace the `theme-vt.css` import with `themes.css` (same position, before `responsive.css`). In motion.css, remove only `background`, `color` and `--vn-text-muted` from `.vn-chapter--ink` / `.vn-chapter--creme` (keep position and the `::before` wedge) | Probe table = §U6k.4 exactly in both themes. Inline CSS delta ≤ +650 B gz against the base build. axe 0 in both themes at 390 and 1366. No `!important`. Standard gate green |
| U6k-2 | executor | `src/scripts/theme.ts`, `e2e/theme.spec.ts`, `e2e/thorough-themes.spec.ts` | Constants `#fdfbf6` / `#0a0a0a`. `setMeta(t)` writes **every** `meta[name=theme-color]` (forward-compatible with PM1). `init()` calls `setMeta(current)` once. Before `startViewTransition`, set `--vt-r` = `Math.hypot(max(x, innerWidth−x), max(y, innerHeight−y))` px. Specs: `'#f4ead4'` → `'#fdfbf6'` (theme.spec line 40, thorough-themes line 6) | On load in light the meta is `#fdfbf6` without a click. Toggle and reduced-motion tests still pass. First-load JS ≤ 8192 |
| U6k-3 | executor | `src/styles/sections/hero.css`, `src/scripts/hero-fx.ts` | Replace the hero's hardcoded colours (lines 8–9, 25–26, 50–56, 105, 131, 151, 164–182, 199, 206, 220, 231–233, 268–270, 317) with the `--hero-*` vars of §U6k.4, using today's values as defaults (`.vn-hero` declares them). Leave the badge, the red dot and `--vn-ref-red-450` fills alone. hero-fx.ts sheen grid → `color-mix(in srgb, currentColor 20%, transparent)` | Dark hero pixel-identical to today (Playwright screenshot diff ≤ 0.1%). No layout change. hero-fx chunk size not increased by more than 20 B |
| U6k-4 | executor | `e2e/themes-rhythm.spec.ts` (new) | Tests in §U6k.7, written against the §U6k.4 table (it can be drafted in parallel and goes green after U6k-1..3) | 18 tests green on chromium, 0 flaky over `--repeat-each=3` |
| U6k-5 | revisor (read-only) | — | Contrast of every text style per preset (including red small text = `--vn-signal-ink`), `color-scheme` leakage into form controls in Contact, VT under reduce, LHCI 100 ×4 mobile + desktop on `/`, `/en/`, `/privacidade/`, `/projetos/caato/` in both color schemes, budget numbers | Findings by severity. No high open |

Parallelism: U6k-1, U6k-2, U6k-3 and U6k-4 run in parallel (disjoint files). The `--hero-*` names and the probe table are the contract. U6k-5 runs after all four. **Merge order:** after U6b → U6a → U6c (so the inline budget is measured on top of the engines), any time relative to U6d–U6h (no shared files), and **before U6i**, whose axe sweep in both themes then validates the new grounds.

### U6k.7 New e2e (`e2e/themes-rhythm.spec.ts`, home at 1440×900 unless noted)

1–2. Per theme: each of the 10 grounds has the exact computed `background-color` of §U6k.4.
3. `background-color` differs between modes for all 9 non-signal grounds. `#contato` is `rgb(245, 0, 0)` in both.
4–5. Per theme: no two adjacent grounds share a `background-color`.
6. Light: every ground except `#numeros` and `#contato` has relative luminance ≥ 0.6, and `#numeros` < 0.01. Dark: every ground except `#contato` < 0.015.
7–8. Per theme and per ground: `h2` ≥ 3:1 and the first `p` and `.vn-eyebrow` ≥ 4.5:1 against the ground (computed colours, WCAG formula, alpha flattened over the ground).
9. `color-scheme`: light → `#numeros` `dark` and the paper/creme grounds `light`. Dark → all non-signal grounds `dark`.
10. Chapter wedges: `getComputedStyle(el, '::before').backgroundColor` equals the section ground for About, Numbers, Expertise and FAQ in both themes.
11. `theme-color` equals `#fdfbf6` / `#0a0a0a` on load (stored light / dark, no click) and after each toggle.
12. To dark: `document.getAnimations()` holds an animation named `vn-dusk` on `::view-transition-new(root)` and `vn-spin` on `::view-transition-new(vn-toggle)`. To light: `vn-dawn`. 13. Under `reducedMotion: 'reduce'`, no `::view-transition` animation and the switch is instant.
14. Trail ink (`__vnTrailInk` after pointer moves): light About → `0.96,0,0`, dark About → `1,0.2,0.17`, light Numbers → `1,0.2,0.17`.
15. Hero portrait `filter` differs between themes, and the LCP image has opacity 1 at first paint in both.
16. `/privacidade/` and `/projetos/mte/` in light: body `rgb(253, 251, 246)`. 17. The same at 390 px: tests 1 and 4 hold (no responsive override flips a ground). 18. Full-page screenshots of both themes are attached to the report (not compared, for review).

### U6k.8 Post-merge steps (files owned by U6a–U6h) and upstream

- **PM1** `src/layouts/Base.astro`: replace the single meta with two, `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fdfbf6">` and `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a">` (B9.6). The inline init script sets both `content` attributes to the stored theme's colour when an override exists. That fixes the first paint before theme.ts runs. e2e test 11 then also passes with JS disabled for the OS-preference case.
- **PM2** `src/scripts/cursor.ts` (U6a): the `ring` zone ring is `#e8dec5` at 1px, which is invisible on the paper hero. Give the ring `mix-blend-mode: difference` (a cream ring stays cream on ink and becomes near-black on paper). This costs 0 B of inline CSS. Add one case to `e2e/cursor-zones.spec.ts` in light.
- **PM3** `budget.json` (U6c): `inlineCssGzWarnBytes` 13312 → 13824 only if the combined U6 + U6k build exceeds 13312. The max stays at 14336.
- **PM4** `src/components/home/Contact.astro` / contact.css: none required. The signal band is unchanged.
- **PM5 (U7.2 tie-in):** the header ground flip should also write `theme-color` to the current section's ground (lamalama-style browser chrome). It is out of U6k scope.
- **Follow-up U6l:** a ground rhythm for the case-study pages (today they inherit paper + the brand inverse hero, which is consistent but not choreographed).

**Upstream to `D:\GitHub\brand` (proposal for 1.1, ADR in the brand repo, not blocking U6k):**
1. `[data-surface="inverse"] { color-scheme: dark }` and `[data-surface="signal"] { color-scheme: light }` in vn.base. This is the root cause of the hardcoding.
2. Fix vn.base resetting `:root { color-scheme: light dark }` after vn.tokens (site base.css carries a workaround).
3. New ref `paper-50 #fdfbf6`, light `--vn-surface` → paper, `--vn-surface-soft` → cream-100, and B9.6 light theme-color → #fdfbf6. This is a semantic change for every consumer, so it needs a minor bump and a contrast test run.
4. A `data-ground="paper|creme|tinta|night|graphite|signal"` preset API in vn.base (the presets of §U6k.3). The site would then put `data-ground-light` / `data-ground-dark` in markup instead of id selectors.

After brand 1.1 is vendored, `themes.css` keeps only the section map and the VT rules (about −300 B gz).
