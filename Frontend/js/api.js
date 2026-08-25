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
  // Backend origin — change when deployed
  var API_BASE = localStorage.getItem('aamako_api_base') || 'http://localhost:3000/api';

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
      // Try one silent refresh
      var refreshed = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (refreshed.ok) {
        tokens = await refreshed.json();
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

    // ---- auth ----
    signup: async function (payload) {
      saveTokens(await request('POST', '/auth/register', payload));
      return tokens.user;
    },
    login: async function (email, password) {
      saveTokens(await request('POST', '/auth/login', { email: email, password: password }));
      // merge anonymous cart into user cart server-side is implicit via session reuse;
      // keep header so the server can find the anon cart on next checkout.
      return tokens.user;
    },
    logout: logout,
    me: function () { return request('GET', '/auth/me'); },

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
      details.idempotencyKey =
        details.idempotencyKey ||
        (crypto.randomUUID ? crypto.randomUUID() : 'ord-' + Date.now());
      var headers = {};
      if (tokens && tokens.accessToken) headers['Authorization'] = 'Bearer ' + tokens.accessToken;
      headers['Content-Type'] = 'application/json';
      headers['Idempotency-Key'] = details.idempotencyKey;
      headers['X-Cart-Session'] = ensureCartSession();
      return fetch(API_BASE + '/orders', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(details),
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
})();
