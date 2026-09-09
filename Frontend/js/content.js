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
 * Exposes window.AamakoContent: { load, get, all, hydrate, applyPageVisibility,
 *   loadMedia, imagesForPage, applyMediaToSlots }.
 *
 * IMAGE SLOTS & THE MEDIA LIBRARY: image sections ([data-cms-img]) hold an
 * explicit dashboard pick in their ContentItem's body — that pick is the ONLY
 * thing that changes a section's image, so editing one section never touches
 * another. Authored template images stay in place until a CM explicitly picks
 * a replacement for that exact section. As a safety net, genuinely EMPTY slots
 * (an <img> with no src at all) are filled from the published media library
 * (GET /api/media) using the current page's category — Home images on
 * index.html, Shop images on shop.html, etc. Opt a slot out with
 * data-cms-media="off".
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

  // ─────────────────────────────────────────────────────────────────────────
  // Media library integration (published images from GET /api/media).
  //
  // The dashboard's media library is organized by storefront page: an image
  // uploaded for the home page is filed under "Home", shop imagery under
  // "Shop", category-page imagery under "Product Category", and so on
  // (Dashboard/apps/admin/src/config/pages.ts → MEDIA_CATEGORIES).
  //
  // After text content is applied, genuinely EMPTY image slots ([data-cms-img]
  // whose <img> has no src at all) are filled from the published library
  // images of THIS page's category. Slots that already render an image —
  // either an explicit CMS pick or the authored static default — are NEVER
  // touched here: a section's image changes only when a CM explicitly picks/
  // uploads one for that exact section in the dashboard, so editing one
  // section can never repaint another. Categories with no images fall back to
  // "General"; pages can opt a slot out with data-cms-media="off".
  // ─────────────────────────────────────────────────────────────────────────

  var MEDIA_CACHE_KEY = 'aamako_media_cache_v1';
  var mediaItems = null;

  /** Page slug → media-library category (mirrors the dashboard pages config). */
  var SLUG_TO_MEDIA_CATEGORY = {
    home: 'Home',
    shop: 'Shop',
    product: 'Product Detail',
    'product-category': 'Product Category',
    'the-process': 'The Process',
    'our-story': 'Our Story',
    wholesale: 'Wholesale',
    journal: 'Journal',
  };

  /** Which storefront page are we on? Derived from the pathname via the same
   *  slug→path map used for page visibility (keep both in sync). */
  function currentPageSlug() {
    if (typeof window === 'undefined' || !window.location) return null;
    var file = window.location.pathname.split('/').pop() || 'index.html';
    if (file === 'index.html') return 'home';
    for (var slug in SLUG_TO_PATH) {
      if (SLUG_TO_PATH[slug] === '/' + file) return slug;
    }
    return null;
  }

  /** Load (and cache) the public published-image feed. Never rejects — on
   *  failure it falls back to the localStorage cache, then to an empty list
   *  so a media outage can never break page rendering. */
  function loadMedia() {
    if (mediaItems) return Promise.resolve(mediaItems);
    return fetch(API_BASE + '/media')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        mediaItems = Array.isArray(data) ? data : [];
        try { localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(mediaItems)); } catch (_) { /* ignore */ }
        return mediaItems;
      })
      .catch(function () {
        try {
          var cached = JSON.parse(localStorage.getItem(MEDIA_CACHE_KEY) || 'null');
          if (cached && Array.isArray(cached)) {
            mediaItems = cached;
            return mediaItems;
          }
        } catch (_) { /* ignore corrupt cache */ }
        mediaItems = mediaItems || [];
        return mediaItems;
      });
  }

  /** Published images for one category, newest first (empty array if none). */
  function imagesForPage(category) {
    var out = [];
    var list = mediaItems || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m && m.url && (m.category || 'General') === category) out.push(m);
    }
    return out;
  }

  /** Fill only genuinely EMPTY [data-cms-img] slots (an <img> with no src)
   *  from the page's media category. Slots already showing an image — an
   *  explicit dashboard pick OR the authored static default — are never
   *  touched, so changing one section's image can never change another's.
   *  "General" images fill in when a page's own category is empty. Runs AFTER
   *  the CMS content pass — an explicit pick (data-cms-applied) always wins. */
  function applyMediaToSlots(root) {
    if (!mediaItems || !mediaItems.length) return;
    var scope = root || document;
    if (!scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll('[data-cms-img]');
    if (!nodes.length) return;

    var slug = currentPageSlug();
    var category = (slug && SLUG_TO_MEDIA_CATEGORY[slug]) || 'General';
    var pageImages = imagesForPage(category);
    var generalImages = category === 'General' ? pageImages : imagesForPage('General');

    var pick = 0;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      // Opt-out escape hatch + explicit CMS picks already applied.
      if (node.getAttribute('data-cms-media') === 'off') continue;
      if (node.getAttribute('data-cms-applied')) continue;
      var img = node.tagName === 'IMG' ? node : node.querySelector('img');
      if (!img) continue;
      // NEVER touch a slot that already renders an image (its authored static
      // default). Changing one section's image must never change another —
      // each section only changes when the user explicitly picks/uploads an
      // image for THAT section in the dashboard. This pass exists solely for
      // genuinely empty slots (<img> with no src at all).
      if (img.getAttribute('src')) continue;

      var list = pageImages.length ? pageImages : generalImages;
      if (!list.length) return; // nothing published to draw from
      var media = list[pick % list.length];
      pick++;

      img.src = media.url;
      if (media.altText && !img.getAttribute('alt')) img.setAttribute('alt', media.altText);
      node.setAttribute('data-cms-media-filled', '1');
    }
  }

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
    // Form controls can't take text content — write to their placeholder instead.
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.setAttribute('placeholder', val);
      el.setAttribute('data-cms-applied', '1');
      return;
    }
    // Image sections — the stored value is an image URL (edited via the
    // dashboard's upload / media-library picker on image-kind sections).
    if (el.tagName === 'IMG') {
      el.src = val;
      el.setAttribute('data-cms-applied', '1');
      return;
    }
    if (el.hasAttribute('data-cms-img')) {
      var img = el.querySelector('img');
      if (img) img.src = val;
      el.setAttribute('data-cms-applied', '1');
      return;
    }
    var looksHtml = typeof val === 'string' && /<[a-z][\s\S]*>/i.test(val);
    var asHtml = el.hasAttribute('data-cms-html') ||
      field === 'body' || field === 'long' || looksHtml;
    if (asHtml) {
      el.innerHTML = val;
    } else {
      el.textContent = val;
    }
    // Marker consumed by pages with dynamic renderers (e.g. collection.html):
    // they skip overwriting an element once the CMS has applied a value.
    el.setAttribute('data-cms-applied', '1');
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
        var field = node.getAttribute('data-cms-field') ||
          // Image sections store their URL in `body` (set via the dashboard's
          // upload / media-library picker). Without an explicit data-cms-field
          // they must read from body, not the default title field.
          (node.hasAttribute('data-cms-img') ? 'body' : 'title');
        var item = get(key);
        if (!item) continue;
        // "Hide from page" in the dashboard removes the block from the live
        // site while keeping it editable — the element is simply hidden.
        if (item.isVisible === false) {
          node.style.display = 'none';
          node.setAttribute('data-cms-hidden', '1');
          continue;
        }
        apply(node, item, field);
      }
      // Page-level hide runs AFTER content is loaded (all()) and after section
      // hydration — never before, or it would read an empty list and no-op.
      applyPageVisibility();
      return content;
    })
    // Media pass — fill still-default image slots from the dashboard's media
    // library (categorized by page). Never rejects; a media outage leaves the
    // authored static images in place.
    .then(loadMedia)
    .then(function () {
      applyMediaToSlots(root || document);
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
      '[data-cms]:hover{outline:2px dashed #22c55e !important;outline-offset:3px;border-radius:4px;}' +
      // last-resort guard for image sections: a ::after grain/gradient layer
      // (or an absolutely-positioned badge) sitting above the <img> must never
      // eat the click — decorative layers are pointer-transparent, the image
      // itself stays clickable.
      '[data-cms-img]::before,[data-cms-img]::after{pointer-events:none !important;}';
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

  /**
   * Map of page slugs (the <slug> in a "site.page.<slug>" key) to the pathname
   * that slug lives at on the storefront. Kept in sync with the dashboard's
   * pages config (Dashboard/apps/admin/src/config/pages.ts).
   */
  var SLUG_TO_PATH = {
    home: '/index.html',
    shop: '/shop.html',
    product: '/product.html',
    'the-process': '/process.html',
    'our-story': '/story.html',
    wholesale: '/wholesale.html',
    journal: '/journal.html',
    'product-category': '/collection.html',
  };

  /**
   * Page-level hide/unhide. The dashboard sets a "site.page.<slug>" item's
   * isVisible to false to take a whole page offline without deleting any of its
   * section content. On the storefront we then:
   *   1. If the visitor is currently ON a hidden page, replace the page
   *      CONTENT with a friendly "unavailable" notice (the page is gone, not
   *      a 404). Site chrome (header, mobile drawer, trust strip, footer) is
   *      always kept — wiping it used to make the header vanish after load,
   *      which read as a flicker on every visit to the hidden page.
   *   2. Site-wide, remove every link that points at a hidden page so the
   *      navigation no longer advertises something that isn't there.
   *
   * `itemsOverride` lets a caller apply a specific snapshot (exposed for the
   * editor bridge / custom callers); it defaults to the freshly loaded items
   * from all(). A call WITHOUT an override means fresh data has arrived — at
   * that point the inline pre-paint guard each page's <head> installs is
   * cleared, because the real DOM enforcement below takes over.
   */
  function applyPageVisibility(itemsOverride) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    var items = itemsOverride || all();
    // Fresh data has landed — clear the inline PRE-PAINT NAV GUARD (see each
    // page's <head>). It exists only to bridge the gap until real data
    // arrives; from here the DOM edits below are the single source of truth,
    // so a page unhidden in the dashboard comes back on the very next fetch.
    if (!itemsOverride) {
      try {
        var guard = document.getElementById('aamako-nav-guard');
        if (guard && guard.parentNode) guard.parentNode.removeChild(guard);
        document.documentElement.removeAttribute('data-page-hidden');
      } catch (_) { /* ignore */ }
    }
    if (!items.length) return;

    var hiddenPaths = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || it.isVisible !== false) continue;
      var m = /^site\.page\.([a-z0-9-]+)$/.exec(it.key);
      if (!m) continue;
      var path = SLUG_TO_PATH[m[1]];
      if (path) hiddenPaths[path] = true;
    }
    var hiddenKeys = Object.keys(hiddenPaths);
    if (!hiddenKeys.length) return;

    // 1. Current page is hidden → swap the page CONTENT for an "unavailable"
    //    notice. Guarded so re-runs (cached pass + fresh pass) never rebuild
    //    it — rebuilding after paint would itself read as a flicker.
    var here = window.location.pathname.replace(/\/+$/, '') || '/';
    var isHiddenHere = !!(hiddenPaths[here] || hiddenPaths[here.replace(/^\//, '')]);
    if (isHiddenHere && !document.querySelector('[data-cms-unavailable]')) {
      var notice = document.createElement('div');
      notice.setAttribute('data-cms-unavailable', '1');
      notice.style.cssText =
        'min-height:60vh;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;text-align:center;padding:4rem 1.5rem;color:#475569;';
      notice.innerHTML =
        '<div style="font-size:3rem;line-height:1;margin-bottom:1rem;opacity:.5">&#128274;</div>' +
        '<h1 style="font-size:1.5rem;font-weight:600;color:#0f172a;margin:0 0 .5rem;">This page is currently unavailable</h1>' +
        '<p style="max-width:36rem;margin:0;">' +
        'It has been temporarily hidden by the site team. The content is still safe ' +
        'and will reappear here as soon as the page is unhidden and republished.';
      var main = document.querySelector('main');
      if (main) {
        while (main.firstChild) main.removeChild(main.firstChild);
        main.appendChild(notice);
      } else {
        // No <main> landmark: strip only the page content and keep the site
        // chrome (header, mobile drawer, trust strip, footer, scripts).
        // Wiping document.body used to take the header with it.
        var chrome = 'header, .mobile-drawer, .trust-strip, footer, script, template, noscript';
        var kids = Array.prototype.slice.call(document.body.children);
        for (var k = 0; k < kids.length; k++) {
          var kid = kids[k];
          if (kid.nodeType === 1 && !kid.matches(chrome)) {
            kid.parentNode && kid.parentNode.removeChild(kid);
          }
        }
        var anchor = document.querySelector('.mobile-drawer') || document.querySelector('header');
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(notice, anchor.nextSibling);
        else document.body.insertBefore(notice, document.body.firstChild);
      }
    }

    // 2. Remove links pointing at any hidden page, across the whole site.
    //    Zero trace: the <a> is removed from the DOM entirely, so there is no
    //    dimmed/strikethrough remnant ("light text cutting from middle"). Menu
    //    items, footer links, inline references — all gone until the page is
    //    unhidden and republished.
    var links = document.querySelectorAll('a[href]');
    for (var j = 0; j < links.length; j++) {
      var a = links[j];
      var href = a.getAttribute('href') || '';
      var path;
      try { path = new URL(href, window.location.origin).pathname; }
      catch (_) { path = href.split('?')[0].split('#')[0]; }
      path = (path || '').replace(/\/+$/, '') || '/';
      if (hiddenPaths[path]) {
        // For list-based navs (<li><a>...</a></li>), drop the whole item so the
        // menu doesn't leave a blank bullet/row. Otherwise just remove the link.
        var li = (a.parentElement && a.parentElement.tagName === 'LI') ? a.parentElement : null;
        var target = li || a;
        target.parentNode && target.parentNode.removeChild(target);
      }
    }

    // The current page's content was replaced — stop here so any per-section
    // hydration that follows never writes into elements that no longer exist.
    if (isHiddenHere) return;
  }

  // NOTE: there is deliberately NO pre-paint pass here anymore. A deferred
  // script like this one can execute AFTER the browser's first paint, so a
  // cached pass ran too late and the header still flickered on refresh.
  // Pre-paint hiding is now done by the inline "PRE-PAINT NAV GUARD" script
  // in each page's <head>, which runs synchronously during HTML parsing —
  // before the header markup even exists. This file remains the source of
  // truth: once fresh data lands, hydrate() → applyPageVisibility() removes
  // the hidden links from the DOM for real and clears the guard.

  // Auto-hydrate after the DOM is ready, unless explicitly deferred via
  // window.AAMAKO_CONTENT_DEFER = true before this script runs.
  if (typeof window !== 'undefined') {
    window.AamakoContent = {
      load: load,
      get: get,
      all: all,
      hydrate: hydrate,
      applyPageVisibility: applyPageVisibility,
      // Media library (published images, categorized by page)
      loadMedia: loadMedia,
      imagesForPage: imagesForPage,
      applyMediaToSlots: applyMediaToSlots,
    };
    initEditorBridge();
    if (!window.AAMAKO_CONTENT_DEFER) {
      if (document.readyState === 'loading') {
        // hydrate() now runs applyPageVisibility() internally once content is
        // loaded — calling it here too would race the fetch and read nothing.
        document.addEventListener('DOMContentLoaded', function () { hydrate(); });
      } else {
        hydrate();
      }
    }
  }
})();
