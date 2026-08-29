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
 * the mobile drawer's sign-in link accordingly. It also toggles body-level
 * auth classes — "is-signed-in" / "is-signed-out" — which styles.css uses to
 * show the nav Cart button only for signed-in users. When signed out, the
 * static "Sign in" link stays and cart surfaces stay hidden.
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
  // ---- Per-user cart & wishlist scoping (localStorage) ----
  // The active cart lives in "aka-cart" (and wishlist in "aka-wishlist"). On
  // sign-out they are snapshotted to "aka-cart:<userId>" / "aka-wishlist:<userId>"
  // and the active keys are wiped; on sign-in the user's own snapshot is restored.
  // That way account B never sees account A's items or "history".
  function userIdOf(user) {
    if (!user) return '';
    return String(user.id || user.userId || user.email || '');
  }
  function lsGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (_) { /* quota */ } }
  function lsDel(key) { try { localStorage.removeItem(key); } catch (_) { /* ignore */ } }
  function cartCount() {
    var items;
    try { items = JSON.parse(lsGet('aka-cart') || '[]'); } catch (_) { return 0; }
    return (items || []).reduce(function (s, i) { return s + (Number(i.qty) || Number(i.quantity) || 1); }, 0);
  }
  function snapshotForUser(uid) {
    var cart = lsGet('aka-cart');
    var wish = lsGet('aka-wishlist');
    if (cart && cart !== '[]') lsSet('aka-cart:' + uid, cart); else lsDel('aka-cart:' + uid);
    if (wish && wish !== '[]') lsSet('aka-wishlist:' + uid, wish); else lsDel('aka-wishlist:' + uid);
  }
  function purgeForSignOut() {
    var uid = userIdOf(currentUser());
    if (uid) snapshotForUser(uid);
    lsDel('aka-cart');
    lsDel('aka-wishlist');
    lsDel('aka-cart-owner');
  }
  function reconcileCartForUser(user) {
    var uid = userIdOf(user);
    if (!uid) return;
    var owner = lsGet('aka-cart-owner');
    if (owner === uid) return; // same user — keep their live cart
    var activeCart = lsGet('aka-cart');
    var activeHasItems = !!activeCart && activeCart !== '[]';
    if (!owner && activeHasItems) {
      // No previous owner recorded (guest cart, legacy data, or a fresh
      // sign-in on this device): ADOPT the active cart for this user
      // instead of wiping it. Refreshing the page must never empty the cart.
      lsSet('aka-cart-owner', uid);
      return;
    }
    if (owner && owner !== uid) {
      // A DIFFERENT account's cart is live: snapshot it under its owner and
      // restore THIS user's snapshot (or start clean).
      try { snapshotForUser(owner); } catch (_) { /* ignore */ }
    }
    var snapCart = lsGet('aka-cart:' + uid);
    var snapWish = lsGet('aka-wishlist:' + uid);
    if (snapCart) lsSet('aka-cart', snapCart); else lsDel('aka-cart');
    if (snapWish) lsSet('aka-wishlist', snapWish); else lsDel('aka-wishlist');
    lsSet('aka-cart-owner', uid);
  }
  // Scope the stored cart/wishlist to the signed-in user BEFORE any page script
  // reads them (this file is included before every page's inline script).
  reconcileCartForUser(currentUser());
  // Pages read the cart in their own inline scripts; once all of them have
  // parsed and registered listeners (DOMContentLoaded), tell them to re-sync
  // in case the reconcile swapped in this user's saved snapshot.
  function announceCartRestore() {
    try { window.dispatchEvent(new CustomEvent('aamako-cart-restored')); } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', announceCartRestore);
  } else {
    announceCartRestore();
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
    purgeForSignOut(); // snapshot cart/wishlist for THIS user, then wipe active keys
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
      // signed-out: leave default Sign in links untouched, hide cart surfaces
      document.body.classList.add('is-signed-out');
      document.body.classList.remove('is-signed-in');
      return;
    }

    // signed-in: reveal authed-only header surfaces (nav Cart button)
    document.body.classList.remove('is-signed-out');
    document.body.classList.add('is-signed-in');

    // refresh() re-run (e.g. after profile edits): repaint name/email/avatar in
    // the existing menu, don't rebuild markup or double-bind listeners.
    var existingWrap = document.getElementById('acctWrap');
    if (existingWrap) {
      var nm = existingWrap.querySelector('.acct-menu-name');
      var em = existingWrap.querySelector('.acct-menu-email');
      var av = existingWrap.querySelector('.acct-avatar');
      if (nm) nm.textContent = displayName(user);
      if (em) em.textContent = user.email;
      if (av) av.innerHTML = avatarInner(user);
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

    // Desktop header: on pages whose primary CTA is "Shop now" (no cart drawer
    // of their own), swap it for a Cart button once the user is signed in.
    var shopNow = document.querySelector('.nav-actions a.btn-primary[href="shop.html"]');
    if (shopNow && !document.getElementById('cartToggle') && !shopNow.closest('.cart-btn-wrap')) {
      var n = cartCount();
      var cartWrap = document.createElement('span');
      cartWrap.innerHTML =
        '<div class="cart-btn-wrap"><a href="cart.html" class="btn btn-primary" id="cartToggle" title="View your cart">Cart' +
        '<span class="cart-badge" id="cartBadge"' + (n > 0 ? '' : ' style="display:none;"') + '>' + n + '</span></a></div>';
      shopNow.replaceWith(cartWrap.firstElementChild);
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
  window.AamakoAccountMenu = {
    refresh: init,
    purgeForSignOut: purgeForSignOut,
    cartCount: cartCount
  };
  window.AamakoAvatar = {
    get: getAvatar,
    set: setAvatar,
    clear: clearAvatar,
    initials: initials
  };
})();
