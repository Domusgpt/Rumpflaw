/**
 * motion.js — GSAP + ScrollTrigger + SplitText + Lenis choreography.
 *
 *  1. Intro (scroll-locked, ≤ ~3s, any input fast-forwards, once per session)
 *  2. Hero pin: headline lifts away, chart field zooms, a dawn disc rises from the
 *     horizon and becomes the paper of the next section
 *  3. Statement: word-by-word ink-in scrub
 *  4. Practice: horizontal pinned gallery on wide screens (keyboard-aware)
 *  5. Attorneys: portrait clip reveals + monogram parallax
 *  6. Approach: drawn progress line;  7. Chart: island draw + places;  8. Reveals
 *
 * Reduced motion ⇒ none of the above; native scroll; everything visible.
 */
import { scroller } from './scroll.js';
import { TideField } from './tide-field.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;

export async function initMotion({ telemetry }) {
  const { gsap, ScrollTrigger, SplitText } = window;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = $('[data-hero]');
  const canvas = $('[data-tide]');
  const tide = canvas ? TideField.mount(canvas, { reduced }) : null;
  if (tide && hero) hero.classList.add('has-webgl');

  if (!gsap || !ScrollTrigger) {
    html.classList.add('motion-failed');
    html.classList.remove('is-locked');
    telemetry.track('motion_unavailable', { reason: 'gsap-missing' });
    return { tide };
  }
  gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (reduced) {
    $('[data-intro]')?.remove();
    initHeader({ ScrollTrigger, gsap, heroST: null });
    initProgress({ gsap });
    initSectionNav({ ScrollTrigger });
    html.classList.add('motion-ready');
    return { tide };
  }

  // ── Smooth scroll ──────────────────────────────────────────────────────────
  const Lenis = window.Lenis;
  let lenis = null;
  if (Lenis) {
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    scroller.attach(lenis);
    // Pin spacers change the document height — keep Lenis' scroll limit in sync.
    ScrollTrigger.addEventListener('refresh', () => lenis.resize());
  }
  // Transform-based pinning when Lenis drives the scroll (same-frame updates, no layout
  // shift); native fixed pinning on touch-only devices where scrolling is compositor-driven.
  const pinType = lenis && ScrollTrigger.isTouch !== 1 ? 'transform' : 'fixed';

  // ── Intro lock ────────────────────────────────────────────────────────────
  const introEl = $('[data-intro]');
  const playIntro = !!introEl && !html.classList.contains('intro-seen') && !location.hash;
  if (playIntro) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    scroller.lock('intro');
  } else {
    introEl?.remove();
    html.classList.remove('is-locked');
  }

  // The intro mark needs no web fonts — start drawing immediately; the hero reveal is
  // queued until its headline has been split with final font metrics.
  let heroTl = null;
  let heroQueued = false;
  const playHero = () => { if (heroTl) heroTl.play(0); else heroQueued = true; };
  if (playIntro) runIntro({ gsap, ScrollTrigger, introEl, onHero: playHero, telemetry });

  // Fonts must be ready so SplitText measures final line breaks (bounded wait).
  await Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]);

  heroTl = hero ? buildHeroReveal({ gsap, SplitText, hero, canvas: tide ? canvas : null }) : gsap.timeline({ paused: true });
  if (heroQueued) heroTl.play(0);
  const heroST = hero ? buildHeroScroll({ gsap, hero, tide, pinType }) : null;
  buildStatement({ gsap, SplitText });
  buildSplitHeadings({ gsap, SplitText });
  buildReveals({ gsap, ScrollTrigger });
  const mm = gsap.matchMedia();
  buildPractice({ gsap, mm, pinType });
  buildAttorneys({ gsap });
  buildSteps({ gsap, mm });
  buildChart({ gsap });
  initHeader({ ScrollTrigger, gsap, heroST });
  initProgress({ gsap });
  initSectionNav({ ScrollTrigger });

  html.classList.add('motion-ready');

  if (!playIntro) {
    heroTl.play(0);
    ScrollTrigger.refresh();
    if (location.hash) {
      // The browser's native jump happened before pins existed; re-resolve the target now.
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) {
        const go = () => { lenis?.resize(); scroller.scrollTo(target, { immediate: true }); };
        requestAnimationFrame(go);
        window.addEventListener('load', () => requestAnimationFrame(go), { once: true });
      }
    }
  }
  // Safety sweep: anything above the fold that a trigger missed becomes visible.
  setTimeout(() => sweepVisible(gsap), 1800);
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  return { tide, lenis };
}

/* ─────────────────────────────── Intro ─────────────────────────────── */
function runIntro({ gsap, ScrollTrigger, introEl, onHero, telemetry }) {
  const strokes = $$('circle, path', introEl);
  const word = $('[data-intro-word]', introEl);
  const pc = $('[data-intro-pc]', introEl);
  const line = $('[data-intro-line]', introEl);
  const sub = $('[data-intro-sub]', introEl);
  let skipped = false;
  gsap.set(introEl, { clipPath: 'inset(0% 0% 0% 0%)' });
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: done });
  tl.to(strokes, { strokeDashoffset: 0, duration: 1.15, stagger: 0.085, ease: 'power2.inOut' }, 0.1)
    .fromTo([word, pc], { yPercent: 115 }, { yPercent: 0, duration: 1.0, stagger: 0.08 }, 0.42)
    .to(line, { scaleX: 1, duration: 1.1, ease: 'expo.inOut' }, 0.55)
    .to(sub, { opacity: 1, duration: 0.8 }, 0.95)
    .to(introEl, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.05, ease: 'expo.inOut' }, 1.8)
    .add(() => onHero(), 2.15);

  const skip = (e) => {
    if (skipped) return;
    if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    skipped = true;
    tl.timeScale(4.5);
  };
  const opts = { passive: true, capture: true };
  const evts = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  evts.forEach((t) => window.addEventListener(t, skip, opts));

  function done() {
    evts.forEach((t) => window.removeEventListener(t, skip, opts));
    introEl.remove();
    scroller.unlock('intro');
    try { sessionStorage.setItem('rl:intro', '1'); } catch {}
    ScrollTrigger.refresh();
    telemetry.track('intro_complete', { skipped });
  }
}

/* ─────────────────────────────── Hero ─────────────────────────────── */
function buildHeroReveal({ gsap, SplitText, hero, canvas }) {
  const title = $('[data-hero-title]', hero);
  const split = SplitText ? SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'split-line' }) : null;
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' }, onComplete: () => split?.revert() });
  tl.set(title, { autoAlpha: 1 })
    .fromTo(split ? split.lines : title, { yPercent: split ? 108 : 0, autoAlpha: split ? 1 : 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.3, stagger: 0.12 }, 0)
    .fromTo('[data-hero-eyebrow]', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0.05)
    .fromTo(['[data-hero-lede]', '[data-hero-actions]'], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.05, stagger: 0.12 }, 0.4)
    .fromTo('[data-horizon-line]', { scaleX: 0 }, { scaleX: 1, duration: 1.7, ease: 'expo.inOut' }, 0)
    .fromTo('[data-hero-meta] > span', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.75);
  if (canvas) tl.fromTo(canvas, { autoAlpha: 0 }, { autoAlpha: 1, duration: 2, ease: 'power2.out' }, 0);
  return tl;
}

function buildHeroScroll({ gsap, hero, tide, pinType }) {
  const content = $('.hero__content', hero);
  const porthole = $('[data-porthole]', hero);
  const pInner = $('[data-porthole-inner]', hero);
  const ring = $('[data-ring]', hero);
  const horizon = $('[data-horizon]', hero);
  const meta = $('[data-hero-meta]', hero);
  const radius = () => Math.ceil(Math.hypot(window.innerWidth / 2, window.innerHeight) + 80);
  const tideState = { zoom: 1, shift: 0, fade: 1 };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: hero, start: 'top top', end: () => `+=${Math.round(window.innerHeight * 1.5)}`,
      pin: true, pinType, scrub: 0.9, anticipatePin: 1, invalidateOnRefresh: true,
    },
  });
  tl.to(content, { y: () => -window.innerHeight * 0.14, autoAlpha: 0, duration: 0.34, ease: 'power2.in' }, 0)
    .to(meta, { autoAlpha: 0, duration: 0.18 }, 0)
    .to(tideState, { zoom: 1.9, shift: 1, duration: 1, onUpdate: () => tide?.set(tideState) }, 0)
    .to(horizon, { scaleX: 0.035, duration: 0.3, ease: 'power3.inOut' }, 0.1)
    .to(horizon, { autoAlpha: 0, duration: 0.08 }, 0.34)
    .fromTo([porthole, ring], { '--r': '0px' }, { '--r': () => `${radius()}px`, duration: 0.6, ease: 'power2.inOut' }, 0.3)
    .fromTo(ring, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, 0.3)
    .to(ring, { autoAlpha: 0, duration: 0.14 }, 0.78)
    .fromTo(pInner, { autoAlpha: 0, scale: 0.9, y: 36 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.36, ease: 'power2.out' }, 0.55)
    .to({}, { duration: 0.1 });
  return tl.scrollTrigger;
}

/* ─────────────────────────────── Sections ─────────────────────────────── */
function buildStatement({ gsap, SplitText }) {
  const el = $('[data-scrub-words]');
  if (!el || !SplitText) return;
  const split = SplitText.create(el, { type: 'words', wordsClass: 'w' });
  gsap.fromTo(split.words, { opacity: 0.16 }, {
    opacity: 1, stagger: 0.08, ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: 0.6 },
  });
}

function buildSplitHeadings({ gsap, SplitText }) {
  $$('[data-split-reveal]').forEach((el) => {
    if (!SplitText) { gsap.set(el, { autoAlpha: 1 }); return; }
    SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
      onSplit(self) {
        gsap.set(el, { autoAlpha: 1 });
        if (el.dataset.revealed) return undefined;
        return gsap.from(self.lines, {
          yPercent: 112, duration: 1.15, stagger: 0.1, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          onComplete: () => { el.dataset.revealed = '1'; },
        });
      },
    });
  });
}

function buildReveals({ gsap, ScrollTrigger }) {
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09, overwrite: true }),
  });
}

function buildPractice({ gsap, mm, pinType }) {
  const section = $('#practice');
  const pin = $('[data-practice-pin]');
  const track = $('[data-practice-track]');
  if (!section || !pin || !track) return;
  const cards = $$('.practice-card', track);
  const idx = $('[data-practice-index]');
  const bar = $('[data-practice-bar]');

  const fallback = () => {
    cards.forEach((card) => {
      gsap.fromTo(card.firstElementChild, { y: 40, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 1, ease: 'expo.out',
        scrollTrigger: { trigger: card, start: 'top 90%', once: true },
      });
    });
  };

  mm.add('(min-width: 1024px) and (min-height: 720px)', () => {
    section.classList.add('practice--horizontal');
    // Fit check: only pin horizontally if the whole panel fits the viewport.
    if (pin.scrollHeight > window.innerHeight + 2) {
      section.classList.remove('practice--horizontal');
      fallback();
      return undefined;
    }
    const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: pin, start: 'top top', end: () => `+=${dist()}`, pin: true, pinType, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate(self) {
          if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
          if (idx) idx.textContent = String(Math.min(cards.length, 1 + Math.floor(self.progress * cards.length * 0.9999))).padStart(2, '0');
        },
      },
    });
    cards.forEach((card) => {
      gsap.fromTo(card.firstElementChild, { y: 70, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, ease: 'power2.out',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 98%', end: 'left 72%', scrub: true },
      });
    });
    // Keyboard users: bring a focused card into the pinned viewport.
    const onFocus = (e) => {
      const card = e.target.closest('.practice-card');
      const st = tween.scrollTrigger;
      if (!card || !st) return;
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const p = gsap.utils.clamp(0, 1, (card.offsetLeft - pad) / (dist() || 1));
      scroller.scrollTo(st.start + p * (st.end - st.start), { immediate: true });
    };
    track.addEventListener('focusin', onFocus);
    return () => {
      section.classList.remove('practice--horizontal');
      track.removeEventListener('focusin', onFocus);
    };
  });

  mm.add('(max-width: 1023px), (max-height: 719px)', fallback);
}

function buildAttorneys({ gsap }) {
  $$('[data-portrait]').forEach((p) => {
    const inner = $('[data-portrait-inner]', p);
    const mono = $('.attorney__monogram', p);
    gsap.fromTo(inner, { clipPath: 'inset(10% 12% 10% 12% round 6px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 6px)', ease: 'none',
      scrollTrigger: { trigger: p, start: 'top 92%', end: 'top 38%', scrub: 0.6 },
    });
    if (mono) gsap.fromTo(mono, { yPercent: 16, scale: 1.06 }, {
      yPercent: -16, scale: 1, ease: 'none',
      scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

function buildSteps({ gsap, mm }) {
  const steps = $('[data-steps]');
  if (!steps) return;
  const line = $('[data-steps-line]', steps);
  const items = $$('[data-step]', steps);
  mm.add({ wide: '(min-width: 901px)', narrow: '(max-width: 900px)' }, (ctx) => {
    const axis = ctx.conditions.wide ? 'scaleX' : 'scaleY';
    gsap.fromTo(line, { [axis]: 0 }, {
      [axis]: 1, ease: 'none',
      scrollTrigger: { trigger: steps, start: ctx.conditions.wide ? 'top 75%' : 'top 80%', end: ctx.conditions.wide ? 'top 35%' : 'bottom 60%', scrub: 0.6 },
    });
  });
  gsap.fromTo(items, { autoAlpha: 0, y: 30 }, {
    autoAlpha: 1, y: 0, duration: 1.05, ease: 'expo.out', stagger: 0.14,
    scrollTrigger: { trigger: steps, start: 'top 80%', once: true },
  });
}

function buildChart({ gsap }) {
  const chart = $('[data-chart]');
  if (!chart) return;
  const islands = $$('[data-chart-island]', chart);
  islands.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = `${len}`; });
  // Animate the children: each <g> carries its map position in its own transform.
  const places = $$('.chart__place > *', chart);
  const tl = gsap.timeline({ scrollTrigger: { trigger: chart, start: 'top 78%', once: true } });
  tl.to(islands, { strokeDashoffset: 0, duration: 1.9, ease: 'power2.inOut', stagger: 0.18 })
    .fromTo(places, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out' }, 0.35)
    .fromTo('[data-chart-causeway]', { autoAlpha: 0 }, { autoAlpha: 0.6, duration: 0.6 }, 1.1)
    .fromTo('[data-chart-office]', { autoAlpha: 0, scale: 0.5, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 1, ease: 'expo.out' }, 0.9);
}

/* ─────────────────────────────── Chrome ─────────────────────────────── */
function initHeader({ ScrollTrigger, heroST }) {
  const header = $('[data-header]');
  if (!header) return;
  if (!$('[data-hero]')) { header.classList.add('is-solid'); }
  const threshold = () => (heroST ? heroST.start + (heroST.end - heroST.start) * 0.78 : window.innerHeight * 0.75);
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      if (ScrollTrigger.isRefreshing) return; // avoid flicker while layouts are recalculated
      const y = self.scroll();
      const solid = !$('[data-hero]') || y > threshold();
      header.classList.toggle('is-solid', solid);
      const hide = solid && self.direction === 1 && y > threshold() + 320 && !html.classList.contains('menu-open');
      header.classList.toggle('is-hidden', hide);
    },
  });
}

function initProgress({ gsap }) {
  const bar = $('[data-progress]');
  if (!bar) return;
  gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
}

function initSectionNav({ ScrollTrigger }) {
  const links = $$('.site-nav__link');
  links.forEach((link) => {
    const id = link.getAttribute('href').split('#')[1];
    const section = id && document.getElementById(id);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section, start: 'top 45%', end: 'bottom 45%',
      onToggle: ({ isActive }) => (isActive ? link.setAttribute('aria-current', 'true') : link.removeAttribute('aria-current')),
    });
  });
}

function sweepVisible(gsap) {
  $$('[data-reveal], [data-split-reveal]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom < window.innerHeight && getComputedStyle(el).visibility === 'hidden') gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.6 });
  });
}
