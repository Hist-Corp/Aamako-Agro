/**
 * Aamako Agro — shared account menu for the storefront header.
 *
 * Include AFTER js/api.js on any page:
 *   <script src="js/api.js"></script>
 *   <script src="js/account-menu.js"></script>
 *
 * When signed in, replaces the header "Sign in" ghost button with an
 * icon-only profile avatar (initials) that opens an Account ▾ dropdown
 * (name + email, Dashboard / Profile / Orders / Cart / Sign out) and swaps
 * the mobile drawer's sign-in link accordingly. When signed out, does
 * nothing — the static "Sign in" link stays.
 */
(function () {
  'use strict';

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem('aamako_user') || 'null');
    } catch (_) {
      return null;
    }
  }

  function initials(user) {
    var a = (user.firstName || user.email || 'U').trim().charAt(0).toUpperCase();
    var b = (user.lastName || '').trim().charAt(0).toUpperCase();
    return b ? a + b : a;
  }

  function displayName(user) {
    var name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name || user.email;
  }

  // ---- Profile photo (passport-size), stored privately on this device ----
  var AVATAR_KEY = 'aamako_avatar';

  function getAvatar() {
    try { return localStorage.getItem(AVATAR_KEY); } catch (_) { return null; }
  }

  function setAvatar(dataUrl) {
    try { localStorage.setItem(AVATAR_KEY, dataUrl); } catch (_) { /* storage full */ }
    document.dispatchEvent(new CustomEvent('aamako-avatar-changed'));
  }

  function clearAvatar() {
    try { localStorage.removeItem(AVATAR_KEY); } catch (_) { /* ignore */ }
    document.dispatchEvent(new CustomEvent('aamako-avatar-changed'));
  }

  function avatarInner(user) {
    var url = getAvatar();
    return url ? '<img src="' + url + '" alt="" draggable="false">' : initials(user);
  }

  function signOut() {
    if (window.AamakoAPI && window.AamakoAPI.logout) {
      try { window.AamakoAPI.logout(); } catch (_) { /* network errors don't block signout */ }
    }
    localStorage.removeItem('aamako_user');
    localStorage.removeItem(AVATAR_KEY);
    // back to shop home, replacing history so "back" doesn't re-enter authed page
    window.location.replace('index.html');
  }

  var MENU_HTML =
    '<div class="acct-wrap" id="acctWrap">' +
      '<button type="button" class="acct-trigger" id="acctTrigger" aria-haspopup="true" aria-expanded="false" aria-label="Account menu">' +
        '<span class="acct-avatar">{{AVATAR}}</span>' +
        '<svg class="acct-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</button>' +
      '<div class="acct-menu" role="menu" aria-label="Account menu">' +
        '<div class="acct-menu-header">' +
          '<div class="acct-menu-name">{{NAME}}</div>' +
          '<div class="acct-menu-email">{{EMAIL}}</div>' +
        '</div>' +
        '<a href="account.html" role="menuitem">Dashboard</a>' +
        '<a href="profile.html" role="menuitem">Profile &amp; security</a>' +
        '<a href="orders.html" role="menuitem">Order history</a>' +
        '<a href="cart.html" role="menuitem">Cart</a>' +
        '<a href="#" class="acct-signout" id="acctSignout" role="menuitem">Sign out</a>' +
      '</div>' +
    '</div>';

  function init() {
    var user = currentUser();
    if (!user) {
      // signed-out: leave default Sign in links untouched
      document.body.classList.add('is-signed-out');
      return;
    }

    var html = MENU_HTML
      .replace('{{AVATAR}}', avatarInner(user))
      .replace(/\{\{NAME\}\}/g, displayName(user))
      .replace('{{EMAIL}}', user.email);

    // Desktop header trigger: replace the "Sign in" ghost button
    var signinLink = document.querySelector('.nav-actions .btn-ghost[href="signin.html"]');
    if (signinLink) {
      var wrap = document.createElement('span');
      wrap.innerHTML = html;
      signinLink.replaceWith(wrap.firstElementChild);
    }

    // Mobile drawer: point the primary CTA at the dashboard
    var drawerSignin = document.querySelector('.mobile-drawer a[href="signin.html"]');
    if (drawerSignin) {
      drawerSignin.setAttribute('href', 'account.html');
      drawerSignin.textContent = 'My account';
    }

    // Dropdown behaviour
    var wrapEl = document.getElementById('acctWrap');
    var trigger = document.getElementById('acctTrigger');
    if (!wrapEl || !trigger) return;

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = wrapEl.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function () {
      wrapEl.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        wrapEl.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    var signoutBtn = document.getElementById('acctSignout');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        signOut();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // repaint every rendered avatar (header trigger etc.) when the photo changes
  function applyAvatars() {
    var user = currentUser();
    if (!user) return;
    var nodes = document.querySelectorAll('.acct-avatar');
    for (var i = 0; i < nodes.length; i++) nodes[i].innerHTML = avatarInner(user);
  }
  document.addEventListener('aamako-avatar-changed', applyAvatars);

  // expose for pages that render their own header markup dynamically
  window.AamakoAccountMenu = { refresh: init };
  window.AamakoAvatar = {
    get: getAvatar,
    set: setAvatar,
    clear: clearAvatar,
    initials: initials
  };
})();
