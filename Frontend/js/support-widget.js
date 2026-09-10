/**
 * Aamako Agro — Customer Support widget (floating button + quick-action menu).
 * Self-contained: injects its own stylesheet + markup so it can be dropped onto
 * any storefront page after js/account-menu.js.
 *
 * Clicking the floating button opens a quick MENU:
 *    • Raise a ticket → POST /api/support/tickets (staff dashboard's Customer
 *      Support screen), • Track a ticket → GET /api/support/tickets/:id,
 *    • Email us → mailto: support@aamako.agro
 *
 * Signed-in customers (localStorage 'aamako_user') have name/email pre-filled;
 * ticket ids are remembered locally for quick rechecks.
 */
(function () {
  'use strict';

  var API_BASE =
    (localStorage.getItem('aamako_api_base')) ||
    (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? '/api'
      : 'http://localhost:3000/api');

  var TICKET_REFS_KEY = 'aamako_support_refs';
  var SUPPORT_EMAIL = 'support@aamako.agro';

  function currentUser() {
    try { return JSON.parse(localStorage.getItem('aamako_user') || 'null'); }
    catch (_) { return null; }
  }
  function displayName(user) {
    if (!user) return '';
    var name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name || user.email || '';
  }
  function emailOf(user) { return user ? (user.email || '') : ''; }

  function savedRefs() {
    try { return JSON.parse(localStorage.getItem(TICKET_REFS_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function rememberRef(ref, subject) {
    try {
      var refs = savedRefs().filter(function (r) { return r.id !== ref; });
      refs.unshift({ id: ref, subject: subject || 'Ticket', at: Date.now() });
      localStorage.setItem(TICKET_REFS_KEY, JSON.stringify(refs.slice(0, 10)));
    } catch (_) { /* quota — ignore */ }
  }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escAttr(s) { return escHtml(s); }
  function statusLabel(s) { return String(s || '').replace(/_/g, ' '); }

  /* --- Inline SVG icons (inherit currentColor, no external assets) --- */
  /* Filled headset (SVG Repo "Flat Color" headset) — solid shape, inherits
     currentColor so it renders white on the launcher and avatars. */
  var HEADPHONE_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path fill="currentColor" d="M18.86,5A9.38,9.38,0,0,0,2.64,12.05L3,17v1a4,4,0,0,0,4,4H8a2,2,0,0,0,2-2V13a2,2,0,0,0-2-2H7a3.94,3.94,0,0,0-2.36.79A7.37,7.37,0,0,1,12,4a7.37,7.37,0,0,1,7.36,7.79A3.94,3.94,0,0,0,17,11H16a2,2,0,0,0-2,2v7a2,2,0,0,0,2,2h1a4,4,0,0,0,4-4V17l.36-5A9.43,9.43,0,0,0,18.86,5Z"/>' +
    '</svg>';
  var CHAT_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 5 L9 9 L14 5"/>' +
    '<path d="M4 19 L9 15 L14 19"/>' +
    '<ellipse cx="19.5" cy="12" rx="3.5" ry="2.5"/>' +
    '</svg>';
  var SEARCH_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="10.5" cy="10.5" r="6.5"/>' +
    '<path d="M17.5 5 L17.5 17"/>' +
    '<path d="M14.5 8.5 L18.5 8.5 L18.5 12.5 L14.5 12.5"/>' +
    '</svg>';
  var MAIL_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="5" width="16" height="13" rx="2.5"/>' +
    '<path d="M5 8 L5 18"/>' +
    '<path d="M19 8 L19 18"/>' +
    '<path d="M9 10 L12 6 L15 10"/>' +
    '</svg>';
  var ARROW_SVG =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 8 L10 8 L14 12"/>' +
    '</svg>';

  /* ---- Injected stylesheet (once) ---- */
  var CSS = '' +
    /* Floating launcher button — black rest, green circle ring + soft sonar pulse */
    '.aako-support-icon{position:fixed;right:22px;bottom:22px;z-index:9999;width:60px;height:60px;border-radius:50%;' +
      'background:radial-gradient(circle at 50% 36%,#242424 0%,#151515 52%,#0A0A0A 100%);' +
      'border:2.5px solid #2BBF7E;color:#FFFFFF;' +
      'box-shadow:0 12px 30px rgba(0,0,0,.5),0 0 0 3px rgba(43,191,126,.15),0 0 20px rgba(43,191,126,.28);' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'transition:transform .2s ease,box-shadow .2s ease;}' +
    '.aako-support-icon::before{content:"";position:absolute;inset:-5px;border-radius:50%;' +
      'border:2px solid rgba(43,191,126,.8);animation:asPulseRing 3.4s cubic-bezier(.22,.55,.4,1) infinite;' +
      'pointer-events:none;}' +
    '.aako-support-icon::after{content:"";position:absolute;inset:-5px;border-radius:50%;' +
      'border:2px solid rgba(43,191,126,.5);animation:asPulseRing 3.4s cubic-bezier(.22,.55,.4,1) 1.7s infinite;' +
      'pointer-events:none;}' +
    '@keyframes asPulseRing{0%{transform:scale(1);opacity:.9}' +
      '55%{transform:scale(1.18);opacity:.45}100%{transform:scale(1.34);opacity:0}}' +
    '.aako-support-icon:hover{transform:scale(1.06);' +
      'box-shadow:0 15px 34px rgba(0,0,0,.56),0 0 0 4px rgba(43,191,126,.24),0 0 26px rgba(43,191,126,.42);}' +
    '.aako-support-icon:focus-visible{outline:3px solid rgba(43,191,126,.7);outline-offset:2px;}' +
    '.aako-support-icon:active{transform:scale(.93);}' +
    '.aako-support-icon svg{width:24px;height:24px;position:relative;z-index:2;}' +
    '@keyframes asPop{from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:none}}' +
    /* Quick-action menu (opens when the button is clicked) */
    '.aako-menu{position:fixed;right:22px;bottom:94px;z-index:10000;width:296px;border-radius:16px;overflow:hidden;' +
      'background:#fff;box-shadow:0 18px 54px rgba(3,57,34,.3);border:1px solid #E2DED2;display:none;' +
      'flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text",' +
      'system-ui,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;}' +
    '.aako-menu.is-open{display:flex;animation:asPop .22s cubic-bezier(.2,.7,.3,1);}' +
    '.aako-menu .as-menu-head{background:linear-gradient(135deg,#033922,#012a15);color:#fff;padding:12px 14px;' +
      'display:flex;align-items:center;gap:10px;}' +
    '.aako-menu .as-menu-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.14);' +
      'border:1px solid #BE8A2A;color:#FFFFFF;display:flex;align-items:center;justify-content:center;flex:none;}' +
    '.aako-menu .as-menu-avatar svg{width:17px;height:17px;}' +
    '.aako-menu .as-menu-titles{flex:1;min-width:0;}' +
    '.aako-menu .as-menu-title{font-size:13.5px;font-weight:700;letter-spacing:.1px;}' +
    '.aako-menu .as-menu-sub{font-size:11px;opacity:.82;}' +
    '.aako-menu .as-menu-close{background:none;border:none;color:#fff;font-size:19px;line-height:1;cursor:pointer;padding:0 2px;}' +
    '.aako-menu .as-menu-close:hover{color:#E8D9A8;}' +
    '.aako-menu .as-menu-item{display:flex;align-items:center;gap:11px;width:100%;padding:11px 12px;margin:0;' +
      'border:none;background:#fff;color:#211F17;text-align:left;cursor:pointer;font-family:inherit;font-size:13px;' +
      'border-radius:0;transition:background .15s ease;}' +
    '.aako-menu .as-menu-item + .as-menu-item{border-top:1px solid #EDE8E0;}' +
    '.aako-menu a.as-menu-item{text-decoration:none;}' +
    '.aako-menu .as-menu-item:hover{background:#F1F4EC;}' +
    '.aako-menu .as-menu-item:focus-visible{outline:2px solid #033922;outline-offset:-2px;}' +
    '.aako-menu .as-menu-ico{width:34px;height:34px;border-radius:10px;background:#F1F4EC;color:#033922;' +
      'display:flex;align-items:center;justify-content:center;flex:none;}' +
    '.aako-menu .as-menu-ico svg{width:18px;height:18px;}' +
    '.aako-menu .as-menu-txt{flex:1;min-width:0;}' +
    '.aako-menu .as-menu-txt b{display:block;font-size:13px;font-weight:700;color:#033922;}' +
    '.aako-menu .as-menu-txt em{display:block;font-size:11px;color:#7A7867;margin-top:1px;font-style:normal;}' +
    '.aako-menu .as-menu-arrow{color:#BE8A2A;font-size:15px;flex:none;}' +
    '.aako-menu .as-menu-foot{display:flex;align-items:center;gap:7px;padding:9px 12px;font-size:11px;color:#55503F;' +
      'background:linear-gradient(180deg,#F7F6EF,#EEF3EC);border-top:1px solid #E2DED2;}' +
    '.aako-menu .as-menu-foot .as-menu-statusdot{width:8px;height:8px;border-radius:50%;background:#1F9A63;' +
      'box-shadow:0 0 0 2px rgba(31,154,99,.25);}' +
    /* Panel shell */
    '.aako-support{position:fixed;right:22px;bottom:22px;z-index:10000;width:374px;max-height:calc(100vh - 44px);' +
      'border-radius:18px;background:#fff;box-shadow:0 22px 64px rgba(3,57,34,.28);border:1px solid #E2DED2;' +
      'display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,' +
      '"SF Pro Display","SF Pro Text",system-ui,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;}' +
    '.aako-support.is-open{display:flex;animation:asPop .24s cubic-bezier(.2,.7,.3,1);}' +
    '.aako-support .as-head{background:linear-gradient(135deg,#033922,#012a15);color:#fff;padding:13px 15px;' +
      'display:flex;align-items:center;gap:11px;}' +
    '.aako-support .as-head-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.13);' +
      'border:1.5px solid #BE8A2A;color:#FFFFFF;display:flex;align-items:center;justify-content:center;flex:none;}' +
    '.aako-support .as-head-avatar svg{width:20px;height:20px;}' +
    '.aako-support .as-head .as-titlewrap{flex:1;min-width:0;}' +
    '.aako-support .as-head .as-title{font-size:14.5px;font-weight:700;letter-spacing:.1px;}' +
    '.aako-support .as-head .as-sub{font-size:11px;opacity:.85;}' +
    '.aako-support .as-head-chip{flex:none;display:inline-flex;align-items:center;gap:5px;padding:3px 9px;' +
      'border-radius:999px;background:rgba(29,151,94,.16);color:#BFE8C9;font-size:10.5px;font-weight:600;' +
      'border:1px solid rgba(29,151,94,.45);}' +
    '.aako-support .as-head-chip::before{content:"";width:6px;height:6px;border-radius:50%;background:#5FD08C;}' +
    '.aako-support .as-close{background:none;border:none;color:#fff;font-size:20px;line-height:1;cursor:pointer;padding:0 3px;}' +
    '.aako-support .as-close:hover{color:#E8D9A8;}' +
    '.aako-support .as-close:focus-visible{outline:2px solid #BE8A2A;outline-offset:1px;}' +
    /* Segmented tabs */
    '.aako-support .as-tabs{display:flex;gap:8px;margin:4px 15px 10px;padding:3px;background:#F1F4EC;' +
      'border-radius:10px;}' +
    '.aako-support .as-tab{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;' +
      'padding:8px 0;border-radius:8px;cursor:pointer;border:none;background:transparent;color:#6B7A5A;' +
      'font-size:12.5px;font-weight:650;font-family:inherit;transition:all .16s ease;}' +
    '.aako-support .as-tab svg{width:15px;height:15px;}' +
    '.aako-support .as-tab:hover{background:rgba(3,57,34,.07);color:#033922;}' +
    '.aako-support .as-tab.is-active{background:#033922;color:#fff;font-weight:700;}' +
    '.aako-support .as-tab:focus-visible{outline:2px solid #033922;outline-offset:1px;}' +
    /* Body + form fields */
    '.aako-support .as-body{flex:1;overflow-y:auto;padding:15px;}' +
    '.aako-support .as-body::-webkit-scrollbar{width:8px;}' +
    '.aako-support .as-body::-webkit-scrollbar-thumb{background:#C9C2AE;border-radius:4px;}' +
    '.aako-support .as-field{margin-bottom:11px;}' +
    '.aako-support .as-label{display:block;font-size:11.5px;font-weight:650;color:#55503F;margin:0 0 5px;}' +
    '.aako-support .as-req{color:#B4532A;}' +
    '.aako-support .as-input,.aako-support .as-select,.aako-support .as-textarea{width:100%;padding:9px 11px;' +
      'border:1px solid #DDD5C5;border-radius:9px;font-size:13px;font-family:inherit;background:#FFFDF8;' +
      'color:#211F17;transition:border-color .15s ease,box-shadow .15s ease;}' +
    '.aako-support .as-input:focus,.aako-support .as-select:focus,.aako-support .as-textarea:focus{outline:none;' +
      'border-color:#033922;box-shadow:0 0 0 3px rgba(3,57,34,.16);}' +
    '.aako-support .as-input::placeholder,.aako-support .as-textarea::placeholder{color:#9A937F;}' +
    '.aako-support .as-textarea{min-height:88px;resize:vertical;}' +
    '.aako-support .as-submit{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:7px;' +
      'padding:11.5px 0;border:none;border-radius:10px;background:linear-gradient(135deg,#033922,#01472A);' +
      'color:#fff;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit;' +
      'box-shadow:0 2px 8px rgba(3,57,34,.22);transition:transform .14s ease,box-shadow .14s ease,opacity .14s ease;}' +
    '.aako-support .as-submit:hover{box-shadow:0 3px 12px rgba(3,57,34,.3);}' +
    '.aako-support .as-submit:active{transform:scale(.98);}' +
    '.aako-support .as-submit svg{width:16px;height:16px;}' +
    '.aako-support .as-submit:disabled{opacity:.6;cursor:default;}' +
    '.aako-support .as-submit:focus-visible{outline:2px solid #BE8A2A;outline-offset:1px;}' +
    '.aako-support .as-msg{display:none;margin-top:7px;font-size:12px;border-radius:8px;padding:8px 11px;}' +
    '.aako-support .as-msg.err{background:#FDF0EA;border:1px solid #ECCFBB;color:#8A3C1F;}' +
    '.aako-support .as-msg.ok{background:#EAF6EC;border:1px solid #CFE8CF;color:#11623F;}' +
    '.aako-support .as-msg.info{background:#EEF3EC;border:1px solid #D8E4CF;color:#3B5A2B;}' +
    /* Success panel */
    '.aako-support .as-success-panel{display:none;}' +
    '.aako-support .as-success{background:linear-gradient(180deg,#F5F7F1,#EAF3E7);border:1px solid #CFE2CD;' +
      'border-radius:14px;padding:18px 16px;text-align:center;}' +
    '.aako-support .as-success-check{width:52px;height:52px;margin:0 auto;border-radius:50%;background:#D9EBCF;' +
      'color:#0B7A41;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 7px rgba(11,122,65,.14);}' +
    '.aako-support .as-success-check svg{width:27px;height:27px;stroke-width:3;}' +
    '.aako-support .as-success-title{font-size:15px;font-weight:700;color:#033922;margin:14px 0 2px;}' +
    '.aako-support .as-success-sub{font-size:12px;color:#55503F;margin:0 0 6px;}' +
    '.aako-support .as-refbox{display:inline-flex;align-items:center;gap:8px;background:#fff;border:1.5px dashed #B7B09A;' +
      'border-radius:9px;padding:7px 12px;font-family:Consolas,monospace;}' +
    '.aako-support .as-refcode{font-size:13.5px;color:#033922;font-weight:700;word-break:break-all;}' +
    '.aako-support .as-refcopy{border:1px solid #D4CBB5;background:#FBF9F3;color:#55503F;font-size:11px;' +
      'border-radius:7px;padding:4px 8px;cursor:pointer;font-family:inherit;}' +
    '.aako-support .as-refcopy:active{background:#033922;color:#fff;}' +
    '.aako-support .as-success-note{font-size:12px;color:#55503F;line-height:1.5;margin-top:8px;}' +
    '.aako-support .as-success-track{display:inline-flex;align-items:center;justify-content:center;gap:7px;' +
      'background:#fff;color:#033922;border:1.5px solid #033922;font-size:12.5px;font-weight:700;' +
      'width:auto;padding:9px 16px;border-radius:10px;box-shadow:none;margin-top:12px;}' +
    '.aako-support .as-success-track:hover{background:#EAF3E7;}' +
    /* Track view + result */
    '.aako-support .as-track-item{display:flex;align-items:center;gap:9px;padding:9px 11px;' +
      'border:1px solid #DDD5C5;border-radius:10px;margin:3px 0 9px;cursor:pointer;background:#FFFDF8;' +
      'transition:border-color .15s ease,background .15s ease;}' +
    '.aako-support .as-track-item:hover{border-color:#BE8A2A;background:#FBF6EA;}' +
    '.aako-support .as-track-item .as-track-arrow{color:#8A6B1F;font-size:14px;flex:none;}' +
    '.aako-support .as-track-item b{color:#033922;font-size:11.5px;font-family:Consolas,monospace;font-weight:700;}' +
    '.aako-support .as-track-item .as-track-subj{flex:1;min-width:0;font-size:12px;color:#55503F;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.aako-support .as-track-result{background:#FFFDF8;border:1px solid #DDD5C5;border-radius:12px;' +
      'padding:12px 14px;margin-top:13px;}' +
    '.aako-support .as-track-result .as-result-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}' +
    '.aako-support .as-track-result .as-result-id{font-family:Consolas,monospace;font-size:12px;color:#033922;' +
      'font-weight:700;word-break:break-all;}' +
    '.aako-support .as-track-result .as-result-meta{font-size:12px;color:#55503F;margin-top:4px;}' +
    '.aako-support .as-track-result .as-result-meta b{color:#033922;}' +
    '.aako-support .as-messages{margin-top:11px;}' +
    '.aako-support .as-msg-card{background:#F1F4EC;border:1px solid #DDE3CF;border-radius:11px;' +
      'padding:10px 12px;margin-bottom:9px;}' +
    '.aako-support .as-msg-card .as-meta{font-size:10.5px;color:#6B7A5A;font-weight:600;}' +
    '.aako-support .as-msg-card .as-msg-body{font-size:13px;color:#211F17;line-height:1.5;white-space:pre-wrap;' +
      'margin-top:3px;}' +
    /* Status chips */
    '.aako-support .as-status{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;' +
      'font-size:10.5px;font-weight:700;}' +
    '.aako-support .as-status::before{content:"";width:6px;height:6px;border-radius:50%;}' +
    '.aako-support .as-status.OPEN{background:#F8EDD4;color:#8A5A00;}.aako-support .as-status.OPEN::before{background:#E2A83E;}' +
    '.aako-support .as-status.IN_PROGRESS{background:#E2ECF6;color:#1B4F7A;}.aako-support .as-status.IN_PROGRESS::before{background:#3E7FC7;}' +
    '.aako-support .as-status.WAITING_CUSTOMER{background:#EFECE4;color:#55503F;}.aako-support .as-status.WAITING_CUSTOMER::before{background:#8B8676;}' +
    '.aako-support .as-status.RESOLVED{background:#DEF0DC;color:#0E6B3C;}.aako-support .as-status.RESOLVED::before{background:#2FA05C;}' +
    '.aako-support .as-status.CLOSED{background:#EFECE4;color:#55503F;}.aako-support .as-status.CLOSED::before{background:#6A665A;}' +
    /* Responsive + reduced-motion polish */
    '@media (max-width:480px){' +
      '.aako-support{width:calc(100% - 30px);right:15px;bottom:15px;}' +
      '.aako-support-icon{right:16px;bottom:16px;width:56px;height:56px;}' +
      '.aako-menu{right:14px;bottom:88px;width:calc(100% - 28px);}' +
    '}' +
    '@media (prefers-reduced-motion:reduce){' +
      '.aako-support-icon::before,.aako-support-icon::after{animation:none;}' +
      '.aako-menu.is-open,.aako-support.is-open{animation:none;}' +
    '}';

  function injectStyles() {
    if (document.getElementById('aako-support-css')) return;
    var style = document.createElement('style');
    style.id = 'aako-support-css';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  /* --- Quick-action menu (shown when the floating button is clicked) --- */
  function buildMenu() {
    var menu = document.createElement('div');
    menu.className = 'aako-menu';
    menu.id = 'aako-support-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Support quick actions');

    function item(action, label, sub, iconSvg) {
      return '<button type="button" class="as-menu-item" data-action="' + action + '">' +
        '<span class="as-menu-ico">' + iconSvg + '</span>' +
        '<span class="as-menu-txt"><b>' + label + '</b><em>' + sub + '</em></span>' +
        '<span class="as-menu-arrow">›</span></button>';
    }

    menu.innerHTML =
      '<div class="as-menu-head">' +
        '<span class="as-menu-avatar">' + HEADPHONE_SVG + '</span>' +
        '<span class="as-menu-titles"><span class="as-menu-title">Help &amp; Support</span>' +
        '<span class="as-menu-sub">How can we help today?</span></span>' +
        '<button type="button" class="as-menu-close" id="asMenuClose" aria-label="Close menu">&times;</button>' +
      '</div>' +
      item('raise', 'Raise a ticket', 'Describe an issue to our team', CHAT_SVG) +
      item('track', 'Track a ticket', 'Check status of an open ticket', SEARCH_SVG) +
      '<a class="as-menu-item" href="mailto:' + SUPPORT_EMAIL + '?subject=Aamako%20Agro%20%E2%80%94%20support%20request">' +
        '<span class="as-menu-ico">' + MAIL_SVG + '</span>' +
        '<span class="as-menu-txt"><b>Email us</b><em>' + SUPPORT_EMAIL + '</em></span>' +
        '<span class="as-menu-arrow">›</span></a>' +
      '<div class="as-menu-foot"><span class="as-menu-statusdot"></span>Online · We reply within 24 hours</div>';
    document.body.appendChild(menu);
    return menu;
  }

  /* --- Main support panel --- */
  function buildPanel() {
    var user = currentUser();
    var refs = savedRefs();
    var refHtml = refs.length
      ? '<div class="as-label" style="margin-top:13px;">Recent tickets</div>' +
        refs.map(function (r) {
          return '<div class="as-track-item" data-ref="' + escAttr(r.id) + '">' +
            '<b>' + escHtml(r.id) + '</b>' +
            '<span class="as-track-subj">' + escHtml(r.subject) + '</span>' +
            '<span class="as-track-arrow">›</span></div>';
        }).join('')
      : '';

    var panel = document.createElement('div');
    panel.className = 'aako-support';
    panel.id = 'aako-support-panel';
    panel.innerHTML =
      '<div class="as-head">' +
        '<span class="as-head-avatar">' + HEADPHONE_SVG + '</span>' +
        '<div class="as-titlewrap"><div class="as-title">Customer Support</div>' +
        '<div class="as-sub">We reply as soon as we can</div></div>' +
        '<span class="as-head-chip">Online</span>' +
        '<button type="button" class="as-close" aria-label="Close support">&times;</button>' +
      '</div>' +
      '<div class="as-tabs" role="tablist">' +
        '<button type="button" class="as-tab is-active" data-tab="raise" role="tab">' + CHAT_SVG + '<span>Raise a ticket</span></button>' +
        '<button type="button" class="as-tab" data-tab="track" role="tab">' + SEARCH_SVG + '<span>Track ticket</span></button>' +
      '</div>' +
      '<div class="as-body">' +
        '<div class="as-view-raise">' +
          '<div class="as-form">' +
            '<div class="as-field"><label class="as-label" for="asName">Name <span class="as-req">*</span></label>' +
              '<input class="as-input" id="asName" type="text" maxlength="100" value="' + escAttr(displayName(user)) + '" placeholder="Your name"></div>' +
            '<div class="as-field"><label class="as-label" for="asEmail">Email <span class="as-req">*</span></label>' +
              '<input class="as-input" id="asEmail" type="email" maxlength="120" value="' + escAttr(emailOf(user)) + '" placeholder="you@example.com"></div>' +
            '<div class="as-field"><label class="as-label" for="asCategory">Topic</label>' +
              '<select class="as-select" id="asCategory">' +
                '<option>General Inquiry</option><option>Order Issue</option><option>Product Quality</option>' +
                '<option>Refund</option><option>Account</option><option>Payment</option><option>Website / Error</option>' +
              '</select></div>' +
            '<div class="as-field"><label class="as-label" for="asSubject">Subject <span class="as-req">*</span></label>' +
              '<input class="as-input" id="asSubject" type="text" maxlength="150" placeholder="Short summary of the issue"></div>' +
            '<div class="as-field"><label class="as-label" for="asMessage">Describe the issue or question</label>' +
              '<textarea class="as-textarea" id="asMessage" maxlength="2000" placeholder="Give us as much detail as you can — what happened, what you expected, and any order reference."></textarea></div>' +
            '<button type="button" class="as-submit" id="asSubmit">' + CHAT_SVG + '<span>Submit ticket</span></button>' +
            '<div class="as-msg" id="asMsg"></div>' +
          '</div>' +
          '<div class="as-success-panel">' +
            '<div class="as-success">' +
              '<span class="as-success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 5 L11 11 L17 5"/></svg></span>' +
              '<p class="as-success-title">Ticket received!</p>' +
              '<p class="as-success-sub">Your reference code is</p>' +
              '<div class="as-refbox"><span class="as-refcode" id="asRefCode"></span>' +
              '<button type="button" class="as-refcopy" id="asRefCopy">Copy</button></div>' +
              '<p class="as-success-note">A member of our team is on it. Keep this reference to track progress.</p>' +
              '<button type="button" class="as-success-track" id="asGoTrack">Track this ticket</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="as-view-track" style="display:none;">' +
          '<div class="as-field"><label class="as-label" for="asTrackId">Ticket reference</label>' +
            '<input class="as-input" id="asTrackId" type="text" placeholder="Paste your ticket reference" autocomplete="off"></div>' +
          '<button type="button" class="as-submit" id="asTrack">' + SEARCH_SVG + '<span>Check status</span></button>' +
          '<div class="as-msg" id="asTrackMsg"></div>' + refHtml +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    return panel;
  }

  function setTab(tab) {
    var tabs = document.querySelectorAll('#aako-support-panel .as-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = 'as-tab' + (tabs[i].getAttribute('data-tab') === tab ? ' is-active' : '');
    }
    var raise = document.querySelector('#aako-support-panel .as-view-raise');
    var track = document.querySelector('#aako-support-panel .as-view-track');
    if (raise) raise.style.display = tab === 'raise' ? '' : 'none';
    if (track) track.style.display = tab === 'track' ? '' : 'none';
  }

  function showMsg(id, text, kind) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'as-msg' + (kind === 'err' ? ' err' : (kind === 'ok' ? ' ok' : (kind === 'info' ? ' info' : '')));
    el.style.display = 'block';
  }
  function hideMsg(id) {
    var el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.className = 'as-msg'; }
  }

  function renderStatusBadge(s) {
    return '<span class="as-status ' + String(s).replace(/\s+/g, '') + '">' + statusLabel(s) + '</span>';
  }

  function renderTrackResult(ticket) {
    var track = document.querySelector('#aako-support-panel .as-view-track');
    if (!track) return;
    var old = document.getElementById('asTrackResult');
    if (old) old.remove();

    var el = document.createElement('div');
    el.id = 'asTrackResult';
    el.className = 'as-track-result';
    el.innerHTML =
      '<div class="as-result-head"><span class="as-result-id">' + escHtml(ticket.id) + '</span>' +
        renderStatusBadge(ticket.status) +
      '</div>' +
      '<div class="as-result-meta"><b>' + escHtml(ticket.subject) + '</b> · ' + escHtml(ticket.category) + '</div>' +
      '<div class="as-messages">' +
        (ticket.messages || []).map(function (m) {
          return '<div class="as-msg-card"><div class="as-meta">' + escHtml(m.authorName) + ' · ' +
            escHtml(new Date(m.createdAt).toLocaleString()) + '</div>' +
            '<div class="as-msg-body">' + escHtml(m.body) + '</div></div>';
        }).join('') +
      '</div>';
    track.appendChild(el);
    if (ticket && ticket.id) {
      var trackInput = document.getElementById('asTrackId');
      if (trackInput) trackInput.value = ticket.id;
    }
  }

  function submitTicket() {
    var name = document.getElementById('asName').value.trim();
    var email = document.getElementById('asEmail').value.trim();
    var subject = document.getElementById('asSubject').value.trim();
    var category = document.getElementById('asCategory').value;
    var message = document.getElementById('asMessage').value.trim();

    if (!name) return showMsg('asMsg', 'Please enter your name.', 'err');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showMsg('asMsg', 'Please enter a valid email address.', 'err');
    if (subject.length < 3) return showMsg('asMsg', 'Please give your ticket a short subject (at least 3 characters).', 'err');

    var btn = document.getElementById('asSubmit');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.querySelector('span').textContent = 'Submitting…';
    showMsg('asMsg', 'Submitting your ticket…', 'info');

    postTicket({ name: name, email: email, category: category, subject: subject, message: message })
      .then(function (data) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.querySelector('span').textContent = 'Submit ticket';
        if (data && data.id) rememberRef(data.id, data.subject);
        hideMsg('asMsg');
        document.getElementById('asRefCode').textContent = data.id || '';
        var form = document.querySelector('#aako-support-panel .as-form');
        var success = document.querySelector('#aako-support-panel .as-success-panel');
        if (form) form.style.display = 'none';
        if (success) success.style.display = 'block';
        var trackInput = document.getElementById('asTrackId');
        if (trackInput && data && data.id) trackInput.value = data.id;
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.querySelector('span').textContent = 'Submit ticket';
        showMsg('asMsg', (err && err.message) || 'Could not submit the ticket. Please try again.', 'err');
      });
  }

  function trackTicket(id) {
    if (!id) return showMsg('asTrackMsg', 'Please enter your ticket reference.', 'err');
    var btn = document.getElementById('asTrack');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.querySelector('span').textContent = 'Checking…';
    showMsg('asTrackMsg', 'Checking…', 'info');

    fetchTicket(id)
      .then(function (ticket) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.querySelector('span').textContent = 'Check status';
        hideMsg('asTrackMsg');
        if (ticket && ticket.id) rememberRef(ticket.id, ticket.subject);
        renderTrackResult(ticket);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.querySelector('span').textContent = 'Check status';
        showMsg('asTrackMsg', (err && err.message) || 'Could not look up that ticket. Please check the reference.', 'err');
      });
  }

  function postTicket(payload) {
    return fetch(API_BASE + '/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.');
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  function fetchTicket(id) {
    return fetch(API_BASE + '/support/tickets/' + encodeURIComponent(id), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }).then(function (res) {
      if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.');
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error && data.error.message) || ('HTTP ' + res.status));
        return data;
      });
    });
  }

  function copyRefCode() {
    var code = document.getElementById('asRefCode');
    var btn = document.getElementById('asRefCopy');
    if (!code || !code.textContent) return;
    var done = function () {
      if (btn) {
        btn.textContent = 'Copied ✓';
        setTimeout(function () { if (btn) btn.textContent = 'Copy'; }, 1400);
      }
    };
    if (window.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code.textContent).then(done).catch(function () {
        legacyCopy(code.textContent); done();
      });
    } else {
      legacyCopy(code.textContent); done();
    }
  }
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (_) { /* ignore */ }
  }

  function openMenu() {
    var menu = document.getElementById('aako-support-menu');
    if (!menu) menu = buildMenu();
    menu.classList.add('is-open');
  }
  function closeMenu() {
    var menu = document.getElementById('aako-support-menu');
    if (menu) menu.classList.remove('is-open');
  }
  function isMenuOpen() {
    var menu = document.getElementById('aako-support-menu');
    return !!(menu && menu.classList.contains('is-open'));
  }

  function openPanel(tab) {
    closeMenu();
    var panel = document.getElementById('aako-support-panel');
    if (!panel) panel = buildPanel();
    setTab(tab || 'raise');
    panel.classList.add('is-open');
    var icon = document.getElementById('aako-support-icon');
    if (icon) icon.style.display = 'none';
    var firstInput = document.querySelector('#aako-support-panel .as-view-raise input');
    if ((tab || 'raise') === 'raise' && firstInput) firstInput.focus();
  }

  function closePanel() {
    var panel = document.getElementById('aako-support-panel');
    if (panel) panel.classList.remove('is-open');
    var icon = document.getElementById('aako-support-icon');
    if (icon) icon.style.display = '';
  }

  function init() {
    try {
      if (document.getElementById('aako-support-icon')) return;

      var icon = document.createElement('div');
      icon.className = 'aako-support-icon';
      icon.id = 'aako-support-icon';
      icon.setAttribute('role', 'button');
      icon.setAttribute('tabindex', '0');
      icon.setAttribute('aria-label', 'Open customer support');
      icon.setAttribute('aria-haspopup', 'menu');
      icon.title = 'Customer Support — get help';
      var wrap = document.createElement('div');
      wrap.innerHTML = HEADPHONE_SVG;
      icon.appendChild(wrap.firstChild);
      document.body.appendChild(icon);

      buildMenu();
      var panel = buildPanel();
      function $(id) { return document.getElementById(id); }

      icon.addEventListener('click', function () {
        if (isMenuOpen()) closeMenu(); else openMenu();
      });
      icon.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(); }
      });

      /* Menu behaviour */
      $('asMenuClose').addEventListener('click', closeMenu);
      var menuItems = document.querySelectorAll('#aako-support-menu .as-menu-item[data-action]');
      for (var i = 0; i < menuItems.length; i++) {
        menuItems[i].addEventListener('click', function () {
          var action = this.getAttribute('data-action');
          if (action === 'raise' || action === 'track') openPanel(action);
          else closeMenu();
        });
      }
      var menuMail = document.querySelector('#aako-support-menu a.as-menu-item');
      if (menuMail) menuMail.addEventListener('click', closeMenu);

      /* Panel behaviour */
      panel.querySelector('.as-close').addEventListener('click', closePanel);
      var tabs = document.querySelectorAll('#aako-support-panel .as-tab');
      for (var j = 0; j < tabs.length; j++) {
        tabs[j].addEventListener('click', function () {
          setTab(this.getAttribute('data-tab'));
        });
      }
      var items = document.querySelectorAll('#aako-support-panel .as-track-item');
      for (var k = 0; k < items.length; k++) {
        items[k].addEventListener('click', function () {
          setTab('track');
          trackTicket(this.getAttribute('data-ref'));
        });
      }
      $('asSubmit').addEventListener('click', submitTicket);
      $('asRefCopy').addEventListener('click', copyRefCode);
      $('asGoTrack').addEventListener('click', function () { setTab('track'); });
      $('asTrack').addEventListener('click', function () {
        trackTicket($('asTrackId').value.trim());
      });
      $('asTrackId').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); trackTicket($('asTrackId').value.trim()); }
      });
      $('asSubject').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submitTicket(); }
      });
      $('asMessage').addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitTicket(); }
      });

      /* Global: Esc closes menu first, then panel; clicking outside closes both */
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (isMenuOpen()) closeMenu();
        else closePanel();
      });
      document.addEventListener('click', function (e) {
        var t = e.target;
        if (!t) return;
        var inside = t.closest && (
          t.closest('.aako-support') || t.closest('.aako-menu') || t.closest('.aako-support-icon')
        );
        if (!inside) {
          closeMenu();
          closePanel();
        }
      });
    } catch (err) {
      /* The widget must never break the page. */
      if (window.console) console.log('Support widget init failed', err);
    }
  }

  injectStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
