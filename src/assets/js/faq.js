/**
 * faq.js — progressive enhancement for native <details>: smooth height animation
 * (GSAP, motion permitting), ScrollTrigger refresh after layout change, telemetry.
 * Without JS the accordion still works natively.
 */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initFaq({ telemetry }) {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const refresh = () => window.ScrollTrigger?.refresh();

  $$('[data-faq]').forEach((d) => {
    const summary = d.querySelector('summary');
    const body = d.querySelector('.faq-item__body');
    const q = summary.textContent.trim().slice(0, 80);
    summary.addEventListener('click', (e) => {
      const gsap = window.gsap;
      const willOpen = !d.open;
      telemetry.track('faq_toggle', { q, open: willOpen });
      if (!gsap || reduced()) { setTimeout(refresh, 50); return; }
      e.preventDefault();
      if (d.dataset.animating) return;
      d.dataset.animating = '1';
      const done = () => { delete d.dataset.animating; gsap.set(body, { clearProps: 'height,opacity' }); refresh(); };
      if (willOpen) {
        d.open = true;
        gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.6, ease: 'power3.out', onComplete: done });
      } else {
        gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut', onComplete: () => { d.open = false; done(); } });
      }
    });
  });
}
