/**
 * Aamako Agro — shared storefront error-page helper.
 *
 * Any page can include:
 *   <script src="js/error-page.js"></script>
 * and then route a failed task/shopping action to the branded error page:
 *
 *   catch (err) {
 *     window.AamakoErrorPage.show(err, { context: 'Checkout', url: location.href });
 *   }
 *
 * The helper never throws and never alters the existing flow — it only
 * navigates to error.html when an unexpected failure bubbles up. Validation
 * / user-cancelled cases (a thrown Error with NO message, or an object that
 * is clearly a local guard) are ignored so the page keeps its own handling.
 */
(function () {
  'use strict';

  // Map a thrown value to a friendly HTTP-ish code.
  function inferCode(err) {
    var status = err && (err.status || err.statusCode);
    if (typeof status === 'number' && status > 0) return status;
    return '500';
  }

  function safeMessage(err) {
    if (!err) return '';
    var m = err.message || err.error || err;
    if (typeof m !== 'string') return '';
    return m.slice(0, 300);
  }

  // Builds error.html?code=..&type=..&msg=..&url=..  (URL-encoded).
  function buildUrl(code, msg, context, url) {
    var params = ['code=' + encodeURIComponent(String(code || '404'))];
    if (context) params.push('type=' + encodeURIComponent(String(context)));
    if (msg) params.push('msg=' + encodeURIComponent(String(msg)));
    if (url && typeof url === 'string') params.push('url=' + encodeURIComponent(url.slice(0, 240)));
    return 'error.html?' + params.join('&');
  }

  window.AamakoErrorPage = {
    /**
     * err      — the thrown value (Error, ApiError, or anything)
     * opts     — { context, url, code }
     * Returns true when the error page is being shown, false when it bailed.
     */
    show: function (err, opts) {
      try {
        opts = opts || {};
        var msg = opts.message || safeMessage(err);
        // No message = a local guard/validation short-circuit, NOT a task
        // failure — let the page handle it (e.g. show its own note).
        if (!msg && !opts.code) return false;

        var code = opts.code || inferCode(err);
        var context = opts.context || '';
        var url = opts.url || (window.location && window.location.href);
        window.location.href = buildUrl(code, msg, context, url);
        return true;
      } catch (e) {
        // Never break the page if navigation fails.
        return false;
      }
    },

    /**
     * Offline shortcut: call this when a fetch fails with a network error.
     */
    offline: function (context, url) {
      try {
        window.location.href = buildUrl('offline', '', context || 'Connection problem', url);
        return true;
      } catch (e) {
        return false;
      }
    },
  };
})();