/**
 * Aamako Agro — shared API client for the static storefront.
 *
 * Usage (any page):
 *   <script src="js/api.js"></script>
 *   await window.AamakoAPI.login(email, password);
 *   const products = await window.AamakoAPI.listProducts();
 *   await window.AamakoAPI.addToCart(variantId, 2);
 */
(function () {
  // Backend origin resolution (order):
  //   1. explicit override via setApiBase() / localStorage
  //   2. production (non-localhost)  -> "/api" — Vercel proxies /api/* to the
  //      Render API via Frontend/vercel.json (same-origin, no CORS)
  //   3. local dev (localhost)        -> "http://localhost:3000/api"
  var API_BASE =
    (localStorage.getItem('aamako_api_base')) ||
    (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? '/api'
      : 'http://localhost:3000/api');

  var tokens = JSON.parse(localStorage.getItem('aamako_tokens') || 'null');
  var cartSession = localStorage.getItem('aamako_cart_session');

  function ensureCartSession() {
    if (!cartSession) {
      cartSession =
        crypto.randomUUID && crypto.randomUUID()
          ? crypto.randomUUID()
          : 'cs-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem('aamako_cart_session', cartSession);
    }
    return cartSession;
  }

  var refreshInFlight = null;
  /** One silent refresh shared by ALL concurrent 401s. Two parallel refreshes
   *  in the same second would mint identical refresh JWTs and the backend
   *  rejects the duplicate session (P2002), logging the user out. */
  function silentRefresh() {
    if (!refreshInFlight) {
      refreshInFlight = fetch(API_BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens ? tokens.refreshToken : null }),
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) { refreshInFlight = null; return data; })
        .catch(function () { refreshInFlight = null; return null; });
    }
    return refreshInFlight;
  }

  async function request(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (tokens && tokens.accessToken)
      headers['Authorization'] = 'Bearer ' + tokens.accessToken;
    if (path.indexOf('/cart') === 0) headers['X-Cart-Session'] = ensureCartSession();

    var res = await fetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && tokens) {
      // Try one silent refresh (shared across concurrent 401s)
      var fresh = await silentRefresh();
      if (fresh && fresh.accessToken) {
        tokens = fresh;
        localStorage.setItem('aamako_tokens', JSON.stringify(tokens));
        return request(method, path, body);
      }
      logout();
    }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + res.status));
    return data;
  }

  function saveTokens(t) {
    tokens = t;
    localStorage.setItem('aamako_tokens', JSON.stringify(t));
  }

  function logout() {
    if (tokens) {
      request('POST', '/auth/logout', { refreshToken: tokens.refreshToken }).catch(function () {});
    }
    tokens = null;
    localStorage.removeItem('aamako_tokens');
  }

  window.AamakoAPI = {
    setApiBase: function (base) { API_BASE = base.replace(/\/$/, ''); localStorage.setItem('aamako_api_base', API_BASE); },
    /** Current backend origin — used by google-signin.js to auto-discover the
     *  OAuth client ID from GET /auth/google-client-id. */
    apiBase: function () { return API_BASE; },

    // ---- auth ----
    signup: async function (payload) {
      saveTokens(await request('POST', '/auth/register', payload));
      return tokens.user;
    },
    login: async function (email, password) {
      saveTokens(await request('POST', '/auth/login', { email: email, password: password, scope: 'storefront' }));
      // merge anonymous cart into user cart server-side is implicit via session reuse;
      // keep header so the server can find the anon cart on next checkout.
      return tokens.user;
    },
    /** Exchange a Google ID token for a storefront session (creates a customer
     *  account on first sign-in so it shows up in the Dashboard Customers list). */
    googleLogin: async function (idToken) {
      saveTokens(await request('POST', '/auth/google', { idToken: idToken }));
      return tokens.user;
    },
    logout: logout,
    me: function () { return request('GET', '/auth/me'); },

    // ---- own profile (storefront account pages) ----
    updateMe: function (payload) {
      // payload: { firstName?, lastName?, phone? } — whitelist-only
      return request('PATCH', '/auth/me', payload);
    },
    changePassword: function (payload) {
      // payload: { currentPassword, newPassword }
      var body = payload || {};
      var tokens = JSON.parse(localStorage.getItem('aamako_tokens') || 'null');
      if (!body.refreshToken && tokens && tokens.refreshToken) {
        // keeps THIS session alive while all others are revoked server-side
        body.refreshToken = tokens.refreshToken;
      }
      return request('POST', '/auth/change-password', body);
    },

    // ---- password reset (self-service, email link) ----
    forgotPassword: function (email) {
      // Always resolves success (anti-enumeration) — show the generic notice.
      // NOTE: send ONLY { email } — the API rejects unknown fields.
      return request('POST', '/auth/forgot-password', { email: email });
    },
    resetPassword: function (token, newPassword) {
      return request('POST', '/auth/reset-password', { token: token, newPassword: newPassword });
    },

    // ---- catalog ----
    listProducts: function (page, categorySlug) {
      var q = '?page=' + (page || 1) + '&limit=20' + (categorySlug ? '&categorySlug=' + encodeURIComponent(categorySlug) : '');
      return request('GET', '/products' + q);
    },
    getProduct: function (idOrSlug) { return request('GET', '/products/' + idOrSlug); },
    getCategories: function () { return request('GET', '/categories'); },

    // ---- pricing ----
    quote: function (variantId, qty) {
      return request('GET', '/pricing/quote?variantId=' + variantId + '&quantity=' + qty);
    },

    // ---- cart ----
    viewCart: function () { return request('GET', '/cart'); },
    addToCart: function (variantId, quantity) {
      return request('POST', '/cart/items', { variantId: variantId, quantity: quantity || 1 });
    },
    updateCartItem: function (variantId, quantity) {
      return request('PATCH', '/cart/items', { variantId: variantId, quantity: quantity });
    },

    // ---- orders ----
    checkout: function (details) {
      // The idempotency key travels ONLY in the header — putting it in the
      // body trips the backend's forbidNonWhitelisted validation.
      var key =
        details.idempotencyKey ||
        (crypto.randomUUID ? crypto.randomUUID() : 'ord-' + Date.now());
      var body = Object.assign({}, details);
      delete body.idempotencyKey;
      var headers = {};
      if (tokens && tokens.accessToken) headers['Authorization'] = 'Bearer ' + tokens.accessToken;
      headers['Content-Type'] = 'application/json';
      headers['Idempotency-Key'] = key;
      headers['X-Cart-Session'] = ensureCartSession();
      return fetch(API_BASE + '/orders', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      }).then(async function (r) {
        var d = await r.json();
        if (!r.ok) throw new Error(d.error && d.error.message);
        return d;
      });
    },
    myOrders: function () { return request('GET', '/orders/mine'); },

    // ---- wholesale ----
    submitWholesaleInquiry: function (payload) {
      return request('POST', '/wholesale/inquiries', payload);
    },
    requestSampleKit: function (payload) {
      return request('POST', '/wholesale/sample-kit', payload);
    },
    submitPrivateLabelLead: function (payload) {
      return request('POST', '/wholesale/private-label-leads', payload);
    },
  };

  /**
   * Image URL optimization — `window.AamakoImg.url(url, width)`.
   *
   * Product `imageUrl`s are CMS-managed and often point at Unsplash with a
   * fixed `w=800`, yet the storefront renders them into ~270px grid slots.
   * That ships roughly 9x the pixels the layout can show and is one of the
   * heaviest bytes on the shop pages. Unsplash's CDN honours `w`/`q`, and
   * `auto=format` lets it negotiate WebP/AVIF from the request's `Accept`
   * header, so we rewrite the request at render time to match the slot at
   * ~2x (retina) density.
   *
   * Stored CMS content is never mutated, and any non-Unsplash URL (local
   * /images/*.jpg, another CDN) is returned byte-for-byte unchanged. URLs
   * that already ask for a rendition at or below the target are also left
   * alone, so hand-tuned markup such as `?w=350` keeps its exact bytes.
   */
  var UNSPLASH_HOST = 'images.unsplash.com';

  window.AamakoImg = {
    /** Default target width: ~270px card slot at ~1.8x device pixel ratio. */
    CARD_WIDTH: 480,
    url: function (url, width) {
      var src = url == null ? '' : String(url);
      if (src.indexOf(UNSPLASH_HOST) === -1) return src;
      var target = width || window.AamakoImg.CARD_WIDTH;
      try {
        var parsed = new URL(src);
        if (parsed.hostname !== UNSPLASH_HOST) return src;
        var current = parseInt(parsed.searchParams.get('w'), 10);
        // Never downgrade quality below what the author already chose, and
        // never request a rendition larger than the slot needs.
        if (current && current <= target) return src;
        parsed.searchParams.set('w', String(target));
        parsed.searchParams.set('q', '72');
        parsed.searchParams.set('auto', 'format');
        return parsed.toString();
      } catch (e) {
        return src;
      }
    },
  };

  /**
   * Sign-in gate for cart actions. Shows a popup telling the user to sign
   * in first; the "Sign in" button links to the storefront signin page.
   * Returns true when the user IS signed in (action may proceed).
   */
  window.AamakoRequireSignIn = function () {
    var user = localStorage.getItem('aamako_user');
    var tokens = localStorage.getItem('aamako_tokens');
    if ((user && user !== 'null') || (tokens && tokens !== 'null')) return true;

    // Remove any existing gate before showing a new one
    var existing = document.getElementById('signinGateOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'signin-gate-overlay';
    overlay.id = 'signinGateOverlay';
    overlay.innerHTML =
      '<div class="signin-gate-modal" role="dialog" aria-modal="true" aria-labelledby="signinGateTitle">' +
      '<button class="signin-gate-close" aria-label="Close">&times;</button>' +
      '<div class="signin-gate-icon">🔒</div>' +
      '<h3 class="signin-gate-title" id="signinGateTitle">Sign in required</h3>' +
      '<p class="signin-gate-text">To add items to the cart you should be signed in. Sign in to your Aama ko Agro account and start filling your basket.</p>' +
      '<div class="signin-gate-actions">' +
      '<a href="signin.html" class="signin-gate-signin">Sign in</a>' +
      '<button class="signin-gate-cancel">Maybe later</button>' +
      '</div></div>';

    function close() { overlay.remove(); }
    overlay.querySelector('.signin-gate-close').addEventListener('click', close);
    overlay.querySelector('.signin-gate-cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    return false;
  };

  /* Prevent header/CSS-transition flicker on page load.
     During initial render the header may receive scroll-based classes
     (is-scrolled / is-hidden) from the inline scroll handler; without
     this guard the 0.35s transitions fire and cause a visible flicker
     on refresh and page navigation. Once the whole page (incl. images)
     is loaded we re-enable transitions for smooth interactive behavior. */
  window.addEventListener('load', function(){
    requestAnimationFrame(function(){
      document.documentElement.classList.add('loaded');
    });
  });
})();
