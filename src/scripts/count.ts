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
