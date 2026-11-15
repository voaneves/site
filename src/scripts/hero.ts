export function init(): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!finePointer || reduced) return;

  const stage = document.querySelector<HTMLElement>('[data-vn-hero-stage]');
  const chips = [...document.querySelectorAll<HTMLElement>('.vn-hero-chip[data-depth]')];
  const portraitWrap = document.querySelector<HTMLElement>('[data-vn-portrait-wrap]');
  const canvas = portraitWrap?.querySelector<HTMLCanvasElement>('.vn-hero-portrait__canvas');
  const portraitImg = portraitWrap?.querySelector<HTMLImageElement>('.vn-hero-portrait__img');

  // zrk-style HUD: live pointer X/Y over the hero, written with textContent in rAF.
  const hud = document.querySelector<HTMLElement>('[data-vn-hud-live]');
  const hero = hud?.closest<HTMLElement>('.vn-hero');
  if (hud && hero) {
    const tail = hud.textContent?.slice(-4) ?? '';
    const pad = (n: number) => String(Math.max(0, Math.min(9999, Math.round(n)))).padStart(4, '0');
    let x = 0;
    let y = 0;
    let raf = 0;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        hud.textContent = `X ${pad(x)} · Y ${pad(y)} · ${tail}`;
      });
    }, { passive: true });
  }

  if (stage && chips.length > 0) {
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      for (const chip of chips) {
        const d = Number(chip.dataset.depth || 12);
        chip.style.transform = `translate3d(${(nx * d).toFixed(1)}px, ${(ny * d).toFixed(1)}px, 0)`;
      }
      if (portraitWrap) {
        portraitWrap.style.transform = `perspective(900px) rotateX(${(-ny * 6).toFixed(2)}deg) rotateY(${(nx * 6).toFixed(2)}deg)`;
      }
    }, { passive: true });
    stage.addEventListener('pointerleave', () => {
      for (const chip of chips) chip.style.transform = '';
      if (portraitWrap) portraitWrap.style.transform = '';
    });
  }

  if (portraitWrap && canvas && portraitImg) {
    const setup = () => {
      const ctx = canvas.getContext('2d');
      const mask = document.createElement('canvas');
      mask.width = canvas.width;
      mask.height = canvas.height;
      const mctx = mask.getContext('2d');
      if (!ctx || !mctx) return;

      const renderBrush = () => {
        if (!portraitImg.complete || !portraitImg.naturalWidth) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(mask, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.drawImage(portraitImg, 0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      };

      portraitWrap.addEventListener('pointermove', (e) => {
        const r = portraitWrap.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * canvas.width;
        const y = ((e.clientY - r.top) / r.height) * canvas.height;
        mctx.globalCompositeOperation = 'source-over';
        const grad = mctx.createRadialGradient(x, y, 8, x, y, 52);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = grad;
        mctx.beginPath();
        mctx.arc(x, y, 52, 0, Math.PI * 2);
        mctx.fill();
        renderBrush();
      }, { passive: true });

      portraitWrap.addEventListener('pointerleave', () => {
        mctx.clearRect(0, 0, mask.width, mask.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    };
    // Original waited for window load; the module may run after it already fired.
    if (document.readyState === 'complete') setup();
    else addEventListener('load', setup, { once: true });
  }
}
