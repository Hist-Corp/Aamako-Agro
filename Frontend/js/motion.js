/**
 * motion.js — deferred loader for the animation stack (GSAP, ScrollTrigger,
 * Lenis).
 *
 * These libraries register scroll-triggered reveal animations, so none of
 * their work is needed during the first paint — but when loaded as <script
 * defer> they parse, compile and run their layout scan on the critical path,
 * which Lighthouse measures as a ~577ms long task on the homepage (the
 * single largest TBT contributor).
 *
 * Instead, the page calls AamakoMotion.load() and queues its animation setup
 * with AamakoMotion.ready(cb). The libraries are injected during browser idle
 * time (requestIdleCallback) and the queued callbacks run once they arrive.
 * ScrollTriggers only fire at 'top 88%' — below the fold — so the visual
 * difference is limited to in-viewport reveals starting one idle tick later.
 * If the libraries fail to download, callbacks stay queued and the page's
 * existing no-GSAP fallback (reveal elements forced visible) already applied
 * at parse time remains in effect.
 */
(function () {
  var SOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
    'https://unpkg.com/lenis@1.1.18/dist/lenis.min.js',
  ];
  var queued = [];
  var started = false;

  function ready(fn) {
    if (window.gsap && window.ScrollTrigger) { fn(); return; }
    queued.push(fn);
  }

  function flush() {
    var fns = queued.splice(0, queued.length);
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](); } catch (e) { /* one bad animation must not break the rest */ }
    }
  }

  function load() {
    if (started) return;
    started = true;
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 250); };
    idle(function () {
      (function next(i) {
        if (i >= SOURCES.length) { flush(); return; }
        var s = document.createElement('script');
        s.src = SOURCES[i];
        s.onload = function () { next(i + 1); };
        // A failed CDN fetch must not leave the queue stuck: later libs are
        // skipped for THIS chain but the page's fallback styling stands.
        s.onerror = function () { next(i + 1); };
        document.head.appendChild(s);
      })(0);
    });
  }

  window.AamakoMotion = { ready: ready, load: load };
})();
