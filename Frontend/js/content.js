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
    if (content) return Promise.resolve(content);

    if (!force) {
      try {
        var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached && Array.isArray(cached)) {
          content = cached;
          return Promise.resolve(content);
        }
      } catch (_) { /* ignore corrupt cache */ }
    }

    return fetch(API_BASE + '/content')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        content = Array.isArray(data) ? data : [];
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(content)); } catch (_) { /* ignore */ }
        return content;
      })
      .catch(function () {
        content = [];
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
    var asHtml = el.hasAttribute('data-cms-html') ||
      field === 'body' || field === 'long';
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

  // Auto-hydrate after the DOM is ready, unless explicitly deferred via
  // window.AAMAKO_CONTENT_DEFER = true before this script runs.
  if (typeof window !== 'undefined') {
    window.AamakoContent = { load: load, get: get, all: all, hydrate: hydrate };
    if (!window.AAMAKO_CONTENT_DEFER) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { hydrate(); });
      } else {
        hydrate();
      }
    }
  }
})();
