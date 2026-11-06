/**
 * nav.js — mobile menu (focus trap, inert background, Esc to close) and in-page
 * anchor navigation through the shared scroller (Lenis-aware, focus-managed).
 */
import { scroller } from './scroll.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;

export function initNav({ telemetry }) {
  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-mobile-menu]');
  const label = $('[data-menu-label]');
  const main = $('#main');
  const footer = $('.site-footer');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let open = false;

  const focusables = () => [toggle, ...$$('a[href], button:not([disabled])', menu)];

  function openMenu() {
    if (open || !menu) return;
    open = true;
    menu.hidden = false;
    html.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    label.textContent = 'Close menu';
    if (main) main.inert = true;
    if (footer) footer.inert = true;
    scroller.lock('menu');
    const gsap = window.gsap;
    if (gsap && !reduced()) {
      gsap.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'expo.inOut' });
      // opacity (not autoAlpha): links must stay focusable from the first frame.
      gsap.fromTo($$('.mobile-menu__list li, .mobile-menu__meta', menu), { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.05, delay: 0.18, ease: 'expo.out' });
    }
    $('a', menu)?.focus({ preventScroll: true });
    telemetry.track('menu_open');
  }

  function closeMenu({ restoreFocus = true } = {}) {
    if (!open || !menu) return Promise.resolve();
    open = false;
    toggle.setAttribute('aria-expanded', 'false');
    label.textContent = 'Open menu';
    if (main) main.inert = false;
    if (footer) footer.inert = false;
    const finish = () => {
      menu.hidden = true;
      html.classList.remove('menu-open');
      scroller.unlock('menu');
      if (restoreFocus) toggle.focus({ preventScroll: true });
    };
    const gsap = window.gsap;
    if (gsap && !reduced()) {
      return new Promise((resolve) => gsap.to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.5, ease: 'expo.inOut', onComplete: () => { finish(); resolve(); } }));
    }
    finish();
    return Promise.resolve();
  }

  toggle?.addEventListener('click', () => (open ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'Tab') {
      const f = focusables();
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) closeMenu({ restoreFocus: false }); });

  // In-page anchors (same document only)
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash || url.hash.length < 2) return;
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    if (a.dataset.matter) {
      const select = $('#f-matter');
      if (select) select.value = a.dataset.matter;
    }
    if (open) await closeMenu({ restoreFocus: false });
    const isTop = target.id === 'top';
    scroller.scrollTo(isTop ? 0 : target, {
      onComplete: () => {
        const focusTarget = a.dataset.matter ? $('#f-name') : target;
        if (!focusTarget.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(focusTarget.tagName)) focusTarget.setAttribute('tabindex', '-1');
        focusTarget.focus({ preventScroll: true });
      },
    });
    history.pushState(null, '', isTop ? location.pathname : url.hash);
    telemetry.track('nav_anchor', { to: target.id });
  });

  return { openMenu, closeMenu };
}
