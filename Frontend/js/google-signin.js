/**
 * Aamako Agro — Google Sign-In wiring for the static storefront.
 *
 * Should be included AFTER js/api.js on any page that shows a
 * "Continue with Google" button (signup.html, signin.html):
 *   <script src="js/api.js"></script>
 *   <script src="js/google-signin.js"></script>
 *
 * It swaps the decorative ".auth-social-btn" for a real Google-rendered
 * button (Google Identity Services) and exchanges the returned ID token with
 * POST /api/auth/google. On first sign-in the backend creates a
 * RETAIL_CUSTOMER account, so the new user immediately appears in the
 * Dashboard → People → Customers list.
 *
 * Configuration (ONE place): set GOOGLE_CLIENT_ID in the backend
 *   environment (Backend/.env). The storefront auto-discovers it from
 *   GET /api/auth/google-client-id on page load.
 *   Optional manual override (e.g. testing a different client):
 *   localStorage['aamako_google_client_id'] = '<OAuth 2.0 web client ID>'
 *   (or call AamakoGoogleAuth.setClientId('<id>') from the console).
 *   The backend must have the SAME client ID in GOOGLE_CLIENT_ID.
 */
(function () {
  'use strict';

  var GSI_URL = 'https://accounts.google.com/gsi/client';
  var STORAGE_KEY = 'aamako_google_client_id';
  var resolvedClientId = null; // memoized so we hit the backend once per page

  function storedClientId() {
    return (localStorage.getItem(STORAGE_KEY) || '').trim();
  }

  /**
   * Resolve the Google OAuth client ID:
   *   1. manual override via localStorage['aamako_google_client_id']
   *   2. auto-discovered from the backend GET /auth/google-client-id
   *      (single source of truth = GOOGLE_CLIENT_ID in Backend/.env)
   * Returns a Promise<string|null> — null means Google Sign-In is not
   * configured anywhere and the decorative button should explain that.
   */
  function resolveClientId() {
    if (resolvedClientId) return Promise.resolve(resolvedClientId);
    var manual = storedClientId();
    if (manual) {
      resolvedClientId = manual;
      return Promise.resolve(manual);
    }
    var base = (window.AamakoAPI && window.AamakoAPI.apiBase)
      ? window.AamakoAPI.apiBase()
      : (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
          ? '/api'
          : 'http://localhost:3000/api');
    return fetch(base + '/auth/google-client-id')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var id = (data && data.clientId ? String(data.clientId) : '').trim();
        resolvedClientId = id || null;
        return resolvedClientId;
      })
      .catch(function () { return null; });
  }

  function loadGsi(cb) {
    if (window.google && window.google.accounts) { cb(null); return; }
    var s = document.createElement('script');
    s.src = GSI_URL;
    s.async = true;
    s.defer = true;
    s.onload = function () { cb(null); };
    s.onerror = function () { cb(new Error('Google services failed to load')); };
    document.head.appendChild(s);
  }

  function finishSignIn(credential, opts) {
    return window.AamakoAPI.googleLogin(credential)
      .then(function (user) {
        localStorage.setItem('aamako_user', JSON.stringify(user));
        // Hydrate the full profile (real name) so the header avatar/menu is correct.
        return window.AamakoAPI.me()
          .then(function (full) {
            localStorage.setItem('aamako_user', JSON.stringify(full));
            return full;
          })
          .catch(function () { return user; });
      })
      .then(function (user) {
        if (opts && typeof opts.onSuccess === 'function') opts.onSuccess(user);
      });
  }

  function replaceButton(opts) {
    var host = document.querySelector('.auth-social');
    var btn = host && host.querySelector('.auth-social-btn');
    if (!host || !btn) return;

    var notConfigured = function () {
      // Not configured anywhere — keep the decorative button but explain
      // instead of silently doing nothing when clicked.
      btn.addEventListener('click', function () {
        alert('Google Sign-In is not configured yet. Set GOOGLE_CLIENT_ID in the backend environment (Backend/.env) and restart the API.');
      });
    };

    resolveClientId().then(function (id) {
      if (!id) { notConfigured(); return; }

      loadGsi(function (err) {
        if (err || !(window.google && window.google.accounts)) {
          btn.addEventListener('click', function () {
            alert('Google Sign-In is unavailable in this browser.');
          });
          return;
        }

        try {
          google.accounts.id.initialize({
            client_id: id,
            callback: function (response) {
              if (!response || !response.credential) return;
              finishSignIn(response.credential, opts).catch(function (e) {
                alert((e && e.message) || 'Google sign-in failed');
              });
            },
          });
        } catch (e) {
          btn.addEventListener('click', function () {
            alert('Google Sign-In could not be started: ' + e.message);
          });
          return;
        }

        // Replace the decorative button with the real Google button.
        btn.remove();
        var real = document.createElement('div');
        real.className = 'gsi-host';
        host.appendChild(real);
        google.accounts.id.renderButton(real, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: host.clientWidth || 320,
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    replaceButton({
      onSuccess: function () {
        // Both signup and signin land back on the storefront home page, honouring ?next=.
        var params = new URLSearchParams(window.location.search);
        var next = params.get('next');
        window.location.href = next && /^[a-z-]+\.html$/i.test(next) ? next : 'index.html';
      },
    });
  });

  window.AamakoGoogleAuth = {
    /** Synchronously returns the manual override, or the backend-discovered
     *  ID once resolution has finished. */
    getClientId: function () { return resolvedClientId || storedClientId(); },
    setClientId: function (id) {
      localStorage.setItem(STORAGE_KEY, String(id).trim());
      resolvedClientId = String(id).trim() || null;
    },
  };
})();