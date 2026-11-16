# Awwwards pass: plan and status

Started 2026-11-15. Goal: Awwwards Site of the Month quality for voaneves.com.
References, to be reproduced faithfully in our own code, brand and content:
[lamalama.com](https://lamalama.com/) and [era-residence.com](https://www.era-residence.com/).

Previous plan: [WOW-PLAN.md](WOW-PLAN.md).

## Rules

- Lighthouse 100 in all four categories, mobile and desktop, is never relaxed. Any effect that costs a point is
  shortened or deferred until it passes; if it cannot pass, it is dropped and reported.
- Everything respects `prefers-reduced-motion` and works without JavaScript. pt-BR and en stay in parity.
- The hero title and the portrait image (LCP candidates) do not animate. Motion happens around them.
- One small task per commit (Conventional Commits), pushed to `main`. Local gate before each push:
  `npm run lint && npm run build && npm run check:budget && npm run check:html && npm test`, plus the Playwright
  specs for the touched area. Full e2e and Lighthouse run once at the end; only the final commit's deploy must be green.
- Byte budgets (`budget.json`): inline CSS and first-load JS stay as they are. The lazy JS cap (code loaded after
  idle or first pointer) will be raised for the signature effects, with the new numbers recorded here.

## Phase A: defects found in the UX/UI review

- [x] A1 Words vanished after a line break at a hyphen ("pós-graduações", "anti-spam"). `3f2519e`
- [ ] A2 Section headings collide with the lede below; expertise chips wrap inside the pill; footer link orphan on mobile.
- [ ] A3 Header nav unreadable (brown on red, 1.6:1) when it sits over the contact band.
- [ ] A4 Projects subtitle is pointer-only copy; the cursor image preview duplicates the row thumbnail.
- [ ] A5 Move pointer-only hover CSS out of the inline sheet (frees inline budget for the phases below).

## Phase B: from lamalama

- [ ] B1 Line reveal as theirs: lines rise from 80%, scale .96, masked, expo-out, 0.85 s, base delay 0.15 s,
      per-line stagger `i * (0.135 + 0.03 N) / (N - 1)`.
- [ ] B2 Cursor: label pill with a 0.45 s expo-out lag; the fluid trail distorts the content it passes over
      (project thumbnails, case hero, portrait), simulated at about 1/36 of the viewport resolution.
- [ ] B3 Page transition with a 0-100 counter: 0.65 s in, 0.25 s hold, 0.65 s out; thumbnail morphs into the case hero.
      Must not affect the theme toggle's circular reveal.
- [ ] B4 Smooth wheel scrolling on desktop (exponential ease-out, about 1 s); native scroll on touch.

## Phase C: from Era Residence

- [ ] C1 Preloader: split title halves slide apart, progress track, curtain lifts into the hero. The content under it
      is already painted, so LCP is unaffected; Speed Index is the number to watch.
- [ ] C2 Hero opening on non-LCP elements once the curtain lifts: grid, hairlines, meta row, chips, badge, CTAs.
- [ ] C3 Jornada pinned on desktop: vertical scroll carries the career cards sideways (Era moves a 4471 px track
      3100 px over about 4000 px of scroll), led by an oversized stacked title drifting at a slower speed.
      Touch keeps the native swipe. No inner scrollbar, no double scroll.
- [ ] C4 Números rises over About as a large arch, replacing the diagonal wedge, with the title set on the curve.
- [ ] C5 Scroll rail on the left with a live percentage and a scroll cue, replacing the top progress bar.
- [ ] C6 About manifesto as a full-height centred statement that inks in word by word with scroll.
- [ ] C7 Image parallax inside clipped frames; hairlines that draw in; Era's duration scale (0.4 / 0.8 / 1.2 / 1.6 s)
      and easings (`cubic-bezier(.25,1,.5,1)` out, `cubic-bezier(.76,0,.24,1)` in-out).
- [ ] C8 Edge-fill hover on outline buttons (0.8 s) and text-roll nav labels.
- [ ] C9 Hero badge rotation tied to scroll.

## Phase D: polish

- [ ] D1 Footer closing moment: full-width "voaneves." wordmark rising through a mask, Palmas local time.
- [ ] D2 Contact band: larger mobile title; the signal field drifts on its own when the pointer is idle.
- [ ] D3 Hero portrait colour blooms once on touch devices (canvas over the image; the image itself is untouched).
- [ ] D4 Service cards open like a frame on mobile; marquee reacts to scroll velocity.
- [ ] D5 Numbers: digits roll like a counter, including the decimal impact metrics; stat labels ruled and aligned.

## Phase E: review and release

- [ ] E1 Code review of logic, security and infrastructure changes.
- [ ] E2 Second UX/UI review from fresh captures (desktop 1440, mobile 390), both locales, light and dark,
      reduced motion, JavaScript off.
- [ ] E3 Full gate, full Playwright suite, Lighthouse with `lighthouserc.cjs` (mobile and desktop).
- [ ] E4 Final push; deploy run green; voaneves.com serving the new build; Lighthouse on production.

## Decisions for the owner to confirm

- A4 rewrites the Projects subtitle (the old one promised a hover preview).
- D3 colours the portrait automatically on touch.
- The lazy JS budget is raised for B2, B4, C1 and C3.
