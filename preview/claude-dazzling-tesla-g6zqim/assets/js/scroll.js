/**
 * scroll.js — one scroll authority shared by motion, nav, forms and FAQ.
 * Wraps Lenis when present (smooth wheel), falls back to native scrolling.
 */
const state = { lenis: null, locks: new Set() };

export const scroller = {
  attach(lenis) { state.lenis = lenis; },
  get lenis() { return state.lenis; },
  /** Reference-counted lock (intro, mobile menu). */
  lock(reason) {
    state.locks.add(reason);
    state.lenis?.stop();
    document.documentElement.classList.add('is-locked');
  },
  unlock(reason) {
    state.locks.delete(reason);
    if (state.locks.size) return;
    document.documentElement.classList.remove('is-locked');
    state.lenis?.start();
  },
  get locked() { return state.locks.size > 0; },
  scrollTo(target, { offset = 0, immediate = false, onComplete } = {}) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (state.lenis && !reduced) {
      state.lenis.scrollTo(target, { offset, immediate, duration: 1.35, easing: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2), onComplete, force: true });
      return;
    }
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    const y = typeof target === 'number' ? target : (el ? el.getBoundingClientRect().top + window.scrollY + offset : 0);
    window.scrollTo({ top: y, behavior: immediate || reduced ? 'auto' : 'smooth' });
    onComplete && setTimeout(onComplete, reduced || immediate ? 0 : 700);
  },
};
