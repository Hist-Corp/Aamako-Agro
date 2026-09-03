/**
 * Aamako Agro — storefront CMS content hydration.
 *
 * Makes the ENTIRE static storefront editable from the admin dashboard by the
 * Content Manager (and Manager / Admin / Super Admin). Any element carrying a
 * `data-cms` attribute is filled from the published content API:
 *
 *   <h1 data-cms="home.hero" data-cms-field="title">Default fallback text</h1>
 *   <p  data-cms="page.process.steps" data-cms-field="short">...</p>
 *   <div data-cms="product-page.mango.ingredients" data-cms-field="body">...</div>
 *
 *   - data-cms       : the ContentItem key (e.g. "home.hero").
 *   - data-cms-field : which field to inject: title (default) | short | long | body.
 *                      "long" falls back to short, then title. "body" renders HTML.
 *   - data-cms-html  : presence/"true" renders the field as innerHTML (rich text).
 *                      "body" and "long" fields are always safe rich text.
 *
 * Published content overrides the static default markup; items that don't exist
 * (or aren't published) leave the page exactly as authored in HTML — so nothing
 * ever renders blank before a CM has edited a section.
 *
 * Include once per page, then hydrate on DOMContentLoaded:
 *   <script src="js/content.js"></script>
 *   <script>window.AamakoContent && AamakoContent.hydrate();</script>
 *
 * Exposes window.AamakoContent: { load, get, all, hydrate }.
 */
(function () {
  'use strict';

  // Backend origin resolution — mirrors js/api.js (keep in sync).
  var API_BASE =
    (localStorage.getItem('aamako_api_base')) ||
    (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? '/api'
      : 'http://localhost:3000/api');

  var CACHE_KEY = 'aamako_content_cache_v1';
  var content = null;

  /** Load (and cache) published content items. Returns a promise of the array. */
  function load(force) {
    if (content && !force) return Promise.resolve(content);

    // Always fetch fresh from the API — the localStorage cache is only a
    // fallback for offline / API-down situations, never a source of truth.
    // (A cache-first strategy made approved edits invisible in the browser.)
    return fetch(API_BASE + '/content')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        content = Array.isArray(data) ? data : [];
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(content)); } catch (_) { /* ignore */ }
        return content;
      })
      .catch(function () {
        try {
          var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
          if (cached && Array.isArray(cached)) {
            content = cached;
            return content;
          }
        } catch (_) { /* ignore corrupt cache */ }
        content = content || [];
        return content;
      });
  }

  /** Find a published ContentItem by key. */
  function get(key) {
    if (!content || !key) return null;
    for (var i = 0; i < content.length; i++) {
      if (content[i].key === key) return content[i];
    }
    return null;
  }

  /** Return the array of loaded items (after load()). */
  function all() { return content || []; }

  /** Resolve the value for a field from an item. */
  function fieldValue(item, field) {
    if (!item) return null;
    switch (field) {
      case 'short': return item.shortDescription;
      case 'body': return item.body;
      case 'long':
        return item.longDescription || item.shortDescription || item.title;
      default: return item.title;
    }
  }

  /** Inject a value into an element following its data-cms-field semantics. */
  function apply(el, item, field) {
    var val = fieldValue(item, field);
    if (val === null || val === undefined || val === '') return; // keep default
    var looksHtml = typeof val === 'string' && /<[a-z][\s\S]*>/i.test(val);
    var asHtml = el.hasAttribute('data-cms-html') ||
      field === 'body' || field === 'long' || looksHtml;
    if (asHtml) {
      el.innerHTML = val;
    } else {
      el.textContent = val;
    }
  }

  /**
   * Hydrate every [data-cms] element under `root` (default: document).
   * Returns a promise that resolves when published items are applied.
   */
  function hydrate(root) {
    return load().then(function () {
      var el = root || document;
      var nodes = el.querySelectorAll ? el.querySelectorAll('[data-cms]') : [];
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var key = node.getAttribute('data-cms');
        if (!key) continue;
        var field = node.getAttribute('data-cms-field') || 'title';
        var item = get(key);
        if (item) apply(node, item, field);
      }
      return content;
    });
  }

  /**
   * Editor bridge — active ONLY when the storefront page is loaded inside the
   * dashboard's live-preview iframe. Hovering outlines every editable section
   * ([data-cms]); clicking one stops the click and postMessages its content
   * key up to the parent, which selects that template section for editing.
   * Regular visitors never run this (window.parent === window for them).
   */
  function initEditorBridge() {
    var inIframe = false;
    try { inIframe = window.parent && window.parent !== window; } catch (_) { inIframe = false; }
    if (!inIframe) return;

    var style = document.createElement('style');
    style.textContent =
      '[data-cms]{cursor:pointer !important;transition:outline-color .12s;}' +
      '[data-cms]:hover{outline:2px dashed #22c55e !important;outline-offset:3px;border-radius:4px;}';
    document.head.appendChild(style);

    document.addEventListener('click', function (e) {
      var t = e.target;
      var el = t && t.closest ? t.closest('[data-cms]') : null;
      if (!el) {
        // Clicked somewhere without a data-cms ancestor. Keep the editor
        // context: never let the preview navigate away while editing, but
        // still tell the dashboard so it can hint the user. Non-link clicks
        // (sliders, accordions) keep working normally.
        var link = t && t.closest ? t.closest('a[href]') : null;
        if (link) { e.preventDefault(); e.stopPropagation(); }
        try {
          window.parent.postMessage(
            { source: 'aamako-cms-bridge', type: 'untagged-click' },
            '*'
          );
        } catch (_) { /* parent messaging must never break the page */ }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      var key = el.getAttribute('data-cms');
      if (!key) return;
      try {
        window.parent.postMessage(
          { source: 'aamako-cms-bridge', type: 'section-click', key: key },
          '*'
        );
      } catch (_) { /* parent messaging must never break the page */ }
    }, true);
  }

  // Auto-hydrate after the DOM is ready, unless explicitly deferred via
  // window.AAMAKO_CONTENT_DEFER = true before this script runs.
  if (typeof window !== 'undefined') {
    window.AamakoContent = { load: load, get: get, all: all, hydrate: hydrate };
    initEditorBridge();
    if (!window.AAMAKO_CONTENT_DEFER) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { hydrate(); });
      } else {
        hydrate();
      }
    }
  }
})();
