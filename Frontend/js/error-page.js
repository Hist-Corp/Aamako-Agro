/* ─── Shared error-page helper for the Aama ko Agro storefront ────────────
 * Non-intrusive: helpers never throw. Only genuine API/network failures
 * navigate to error.html — local validation errors stay inline.
 */
(function () {
  'use strict';

  function go(params) {
    try {
      var q = new URLSearchParams(params).toString();
      var here = window.location.pathname + window.location.search;
      window.location.href = '/error.html?' + q + '&url=' + encodeURIComponent(here);
    } catch (_) { /* ignore */ }
  }

  window.AamakoErrorPage = {
    /** Navigate to the styled error page for an API/network failure. */
    show: function (err, opts) {
      opts = opts || {};
      var msg = (err && err.message) || 'Unexpected error';
      var status = (err && err.status) || (opts.status || 500);
      var isConn = /fetch|network|Failed to fetch|NetworkError/i.test(msg);
      var ref = 'ERR-' + status + '-' + Date.now().toString(36).toUpperCase();
      go({
        type: isConn ? 'offline' : 'server',
        code: String(status),
        msg: isConn ? 'We could not reach our servers. Please check your connection and try again.' : msg.slice(0, 180),
        ref: ref,
        url: opts.url || window.location.pathname,
      });
    },
    /** Offline variant. */
    offline: function () {
      window.AamakoErrorPage.show(new Error('Failed to fetch'), { status: 0 });
    },
    /** 404 variant (for missing resources/routes). */
    notFound: function (what) {
      go({ type: 'notfound', code: '404', msg: (what || 'The page you are looking for') + ' could not be found. It may have been moved or removed.', ref: 'ERR-404-' + Date.now().toString(36).toUpperCase() });
    },
    /** Render logic for error.html itself. */
    render: function () {
      try {
        var q = new URLSearchParams(window.location.search);
        var type = q.get('type') || 'server';
        var icon = document.getElementById('errIcon');
        var title = document.getElementById('errTitle');
        var msg = document.getElementById('errMsg');
        var ref = document.getElementById('errRef');
        var retry = document.getElementById('btnRetry');

        if (ref && q.get('ref')) ref.textContent = 'REF: ' + q.get('ref');

        if (type === 'notfound') {
          if (icon) icon.textContent = '🧭';
          if (title) title.textContent = 'Page not found';
          if (msg) msg.textContent = q.get('msg') || 'The page you are looking for could not be found.';
        } else if (type === 'offline') {
          if (icon) icon.textContent = '📡';
          if (title) title.textContent = 'Connection problem';
          if (msg) msg.textContent = q.get('msg') || 'We could not reach our servers. Check your connection and try again.';
        } else {
          if (icon) icon.textContent = '🛠️';
          if (title) title.textContent = 'Something went wrong';
          if (msg) msg.textContent = q.get('msg') || 'An unexpected error occurred. Please try again.';
        }

        if (retry) {
          var back = q.get('url');
          retry.addEventListener('click', function () {
            if (back && back.indexOf('error.html') === -1) {
              window.location.href = back;
            } else if (navigator.onLine) {
              window.history.length > 1 ? window.history.back() : (window.location.href = '/');
            } else {
              window.location.reload();
            }
          });
        }

        // Auto-recover label when back online.
        window.addEventListener('online', function () {
          if (retry) retry.textContent = 'Back online — try again';
        });
      } catch (_) { /* ignore */ }
    },
  };
})();