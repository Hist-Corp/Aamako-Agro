/**
 * Aamako Agro — Customer Support widget (floating icon).
 * Self-contained: injects its own stylesheet + markup so it can be dropped onto
 * any storefront page after js/account-menu.js. Features a "Raise a ticket"
 * form (POST /api/support/tickets) that lands in the staff dashboard's
 * Customer Support screen, and a "Track ticket" lookup (GET /api/support/tickets/:id).
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

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escAttr(s) { return escHtml(s); }

  function statusLabel(s) { return String(s || '').replace(/_/g, ' '); }

  /* Headset glyph (headband + two ear cups) with strokes so it needs no external
     asset and inherits currentColor (white on the dark icon, sage in the header). */
  var HEADPHONE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" aria-hidden="true">' +
    '<path d="M7 4 C7 1 11 1 12 1 C13 1 17 1 17 4"/>' +
    '<path d="M7 4 C7 10 7 13 7 14"/>' +
    '<path d="M17 4 C17 10 17 13 17 14"/>' +
    '<rect x="5" y="14" width="5" height="8" rx="2"/>' +
    '<rect x="14" y="14" width="5" height="8" rx="2"/>' +
    '</svg>';

  /* --- Injected stylesheet (once) --- */
  var CSS = '' +
    '.aako-support-icon{position:fixed;right:22px;bottom:22px;z-index:9999;width:56px;height:56px;border-radius:50%;' +
      'background:linear-gradient(135deg,#033922,#012a15);color:#fff;border:1px solid #BE8A2A;' +
      'box-shadow:0 8px 30px rgba(3,57,34,.35);cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'transition:transform .2s ease;}' +
    '.aako-support-icon:hover{transform:scale(1.06);}' +
    '.aako-support-icon svg{width:28px;height:28px;}' +
    '.aako-support{position:fixed;right:22px;bottom:22px;z-index:10000;width:360px;max-height:82vh;' +
      'border-radius:16px;background:#fff;box-shadow:0 20px 60px rgba(3,57,34,.25);' +
      'border:1px solid #E2DED2;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,' +
      'BlinkMacSystemFont,"SF Pro Display","SF Pro Text",system-ui,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;}' +
    '.aako-support.is-open{display:flex;}' +
    '.aako-support .as-head{background:linear-gradient(135deg,#033922,#012a15);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px;}' +
    '.aako-support .as-head .as-titlewrap{flex:1;min-width:0;}' +
    '.aako-support .as-head .as-title{font-size:15px;font-weight:700;}' +
    '.aako-support .as-head .as-sub{font-size:11px;opacity:.85;}' +
    '.aako-support .as-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;}' +
    '.aako-support .as-tabs{display:flex;gap:8px;margin:2px 16px 8px;}' +
    '.aako-support .as-tab{flex:1;text-align:center;padding:8px 0;border-radius:8px;cursor:pointer;border:1px solid #E2DED2;background:#fff;color:#55503F;font-size:13px;font-weight:600;}' +
    '.aako-support .as-tab.is-active{background:#033922;color:#fff;border-color:#033922;}' +
    '.aako-support .as-body{flex:1;overflow-y:auto;padding:16px;}' +
    '.aako-support .as-field{margin-bottom:10px;}' +
    '.aako-support .as-label{display:block;font-size:12px;font-weight:600;color:#55503F;margin:0 0 4px;}' +
    '.aako-support .as-req{color:#9C4E30;}' +
    '.aako-support .as-input,.aako-support .as-select{width:100%;padding:8px 10px;border:1px solid #E2DED2;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;}' +
    '.aako-support .as-input:focus,.aako-support .as-select:focus{outline:none;border-color:#033922;box-shadow:0 0 0 2px rgba(3,57,34,.15);}' +
    '.aako-support .as-textarea{width:100%;padding:8px 10px;border:1px solid #E2DED2;border-radius:8px;font-size:13px;font-family:inherit;min-height:80px;resize:vertical;}' +
    '.aako-support .as-submit{width:100%;padding:11px 0;border:none;border-radius:9px;background:#033922;color:#fff;font-size:14px;font-weight:700;cursor:pointer;}' +
    '.aako-support .as-submit:disabled{opacity:.6;cursor:default;}' +
    '.aako-support .as-msg{display:none;margin-top:6px;font-size:12px;}' +
    '.aako-support .as-msg.err{color:#7A3820;}' +
    '.aako-support .as-msg.ok{color:#04663a;}' +
    '.aako-support .as-success-panel{display:none;}' +
    '.aako-support .as-success{background:#EEF3EC;border:1px solid #Cfe0cd;border-radius:10px;padding:14px;}' +
    '.aako-support .as-success .as-refcode{font-family:Consolas,monospace;font-size:16px;color:#033922;font-weight:700;word-break:break-all;}' +
    '.aako-support .as-track-item{padding:8px 10px;border:1px solid #E2DED2;border-radius:8px;margin:2px 0 8px;cursor:pointer;background:#fff;}' +
    '.aako-support .as-track-item b{color:#033922;font-size:12px;font-family:Consolas,monospace;}' +
    '.aako-support .as-messages{margin-top:12px;}' +
    '.aako-support .as-msg-card{background:#F5F3EE;border:1px solid #E2DED2;border-radius:8px;padding:10px 12px;margin-bottom:8px;}' +
    '.aako-support .as-msg-card .as-meta{font-size:11px;color:#55503F;}' +
    '.aako-support .as-status{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;}' +
    '.aako-support .as-status.OPEN{background:#F4E7C3;color:#8a5a00;}' +
    '.aako-support .as-status.IN_PROGRESS{background:#DCE9F5;color:#004b7a;}' +
    '.aako-support .as-status.WAITING_CUSTOMER{background:#EDEBE6;color:#55503F;}' +
    '.aako-support .as-status.RESOLVED{background:#D8EFDA;color:#04663a;}' +
    '.aako-support .as-status.CLOSED{background:#EDEBE6;color:#55503F;}';

  function injectStyles() {
    if (document.getElementById('aako-support-css')) return;
    var style = document.createElement('style');
    style.id = 'aako-support-css';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function buildPanel() {
    var user = currentUser();
    var refs = savedRefs();
    var refHtml = refs.length
      ? '<div class="as-label" style="margin-top:12px;">Recent tickets</div>' +
        refs.map(function (r) {
          return '<div class="as-track-item" data-ref="' + escAttr(r.id) + '"><b>' +
            escHtml(r.id) + '</b><span style="display:block;font-size:12px;color:#55503F;">' +
            escHtml(r.subject) + '</span></div>';
        }).join('')
      : '';

    var panel = document.createElement('div');
    panel.className = 'aako-support';
    panel.id = 'aako-support-panel';
    panel.innerHTML =
      '<div class="as-head">' + HEADPHONE_SVG +
        '<div class="as-titlewrap"><div class="as-title">Customer Support</div>' +
        '<div class="as-sub">We reply as soon as we can</div></div>' +
        '<button type="button" class="as-close" aria-label="Close support">&times;</button>' +
      '</div>' +
      '<div class="as-tabs">' +
        '<button type="button" class="as-tab is-active" data-tab="raise">Raise a ticket</button>' +
        '<button type="button" class="as-tab" data-tab="track">Track ticket</button>' +
      '</div>' +
      '<div class="as-body">' +
        '<div class="as-view-raise">' +
          '<div class="as-form">' +
            '<div class="as-field"><label class="as-label">Name <span class="as-req">*</span></label>' +
              '<input class="as-input" id="asName" type="text" maxlength="100" value="' + escAttr(displayName(user)) + '" placeholder="Your name"></div>' +
            '<div class="as-field"><label class="as-label">Email <span class="as-req">*</span></label>' +
              '<input class="as-input" id="asEmail" type="email" maxlength="120" value="' + escAttr(emailOf(user)) + '" placeholder="you@example.com"></div>' +
            '<div class="as-field"><label class="as-label">Topic</label>' +
              '<select class="as-select" id="asCategory">' +
                '<option>General Inquiry</option><option>Order Issue</option><option>Product Quality</option>' +
                '<option>Refund</option><option>Account</option><option>Payment</option><option>Website / Error</option>' +
              '</select></div>' +
            '<div class="as-field"><label class="as-label">Subject <span class="as-req">*</span></label>' +
              '<input class="as-input" id="asSubject" type="text" maxlength="150" placeholder="Short summary of the issue"></div>' +
            '<div class="as-field"><label class="as-label">Describe the issue or question</label>' +
              '<textarea class="as-textarea" id="asMessage" maxlength="2000" placeholder="Give us as much detail as you can — what happened, what you expected, and any order reference."></textarea></div>' +
            '<button type="button" class="as-submit" id="asSubmit">Submit ticket</button>' +
            '<div class="as-msg" id="asMsg"></div>' +
          '</div>' +
          '<div class="as-success-panel">' +
            '<div class="as-success">' +
              '<p><b>Ticket submitted.</b></p>' +
              '<p style="margin-top:6px;font-size:13px;color:#55503F;">Your reference is</p>' +
              '<p class="as-refcode" id="asRefCode"></p>' +
              '<p style="margin-top:8px;font-size:13px;color:#55503F;">A member of our support team is on it. You can track progress under <b>Track ticket</b>.</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="as-view-track" style="display:none;">' +
          '<div class="as-field"><label class="as-label">Ticket reference</label>' +
            '<input class="as-input" id="asTrackId" type="text" placeholder="Paste your ticket reference"></div>' +
          '<button type="button" class="as-submit" id="asTrack">Check status</button>' +
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
    el.className = 'as-msg' + (kind === 'err' ? ' err' : (kind === 'ok' ? ' ok' : ''));
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
    el.style.marginTop = '16px';
    el.style.marginBottom = '8px';
    el.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<b style="font-family:Consolas,monospace;color:#033922;word-break:break-all;">' + escHtml(ticket.id) + '</b>' +
        renderStatusBadge(ticket.status) +
      '</div>' +
      '<p style="font-size:13px;color:#211F17;margin:6px 0 0;"><b>' + escHtml(ticket.subject) + '</b> · ' + escHtml(ticket.category) + '</p>' +
      '<div class="as-messages">' +
        ticket.messages.map(function (m) {
          return '<div class="as-msg-card"><div class="as-meta">' + escHtml(m.authorName) + ' · ' +
            escHtml(new Date(m.createdAt).toLocaleString()) + '</div>' +
            '<div style="font-size:13px;color:#211F17;white-space:pre-wrap;">' + escHtml(m.body) + '</div></div>';
        }).join('') +
      '</div>';
    track.appendChild(el);
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
    btn.textContent = 'Submitting…';
    showMsg('asMsg', 'Submitting your ticket…', '');

    postTicket({ name: name, email: email, category: category, subject: subject, message: message })
      .then(function (data) {
        btn.disabled = false;
        btn.textContent = 'Submit ticket';
        if (data && data.id) rememberRef(data.id, data.subject);
        hideMsg('asMsg');
        document.getElementById('asRefCode').textContent = data.id || '';
        var form = document.querySelector('#aako-support-panel .as-form');
        var success = document.querySelector('#aako-support-panel .as-success-panel');
        if (form) form.style.display = 'none';
        if (success) success.style.display = '';
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Submit ticket';
        showMsg('asMsg', (err && err.message) || 'Could not submit the ticket. Please try again.', 'err');
      });
  }

  function trackTicket(id) {
    if (!id) return showMsg('asTrackMsg', 'Please enter your ticket reference.', 'err');
    var btn = document.getElementById('asTrack');
    btn.disabled = true;
    btn.textContent = 'Checking…';
    showMsg('asTrackMsg', 'Checking…', '');

    fetchTicket(id)
      .then(function (ticket) {
        btn.disabled = false;
        btn.textContent = 'Check status';
        hideMsg('asTrackMsg');
        if (ticket && ticket.id) rememberRef(ticket.id, ticket.subject);
        renderTrackResult(ticket);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Check status';
        showMsg('asTrackMsg', (err && err.message) || 'Could not look up that ticket. Please check the reference.', 'err');
      });
  }

  function openPanel() {
    var panel = document.getElementById('aako-support-panel');
    if (!panel) panel = buildPanel();
    panel.classList.add('is-open');
    var icon = document.getElementById('aako-support-icon');
    if (icon) icon.style.display = 'none';
    setTab('raise');
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
      icon.setAttribute('aria-label', 'Open customer support');
      icon.title = 'Customer Support — get help';
      var wrap = document.createElement('div');
      wrap.innerHTML = HEADPHONE_SVG;
      icon.appendChild(wrap.firstChild);
      document.body.appendChild(icon);
      icon.addEventListener('click', openPanel);

      var panel = buildPanel();
      function $(id) { return document.getElementById(id); }
      $('aako-support-panel').querySelector('.as-close').addEventListener('click', closePanel);

      var tabs = document.querySelectorAll('#aako-support-panel .as-tab');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function () {
          setTab(this.getAttribute('data-tab'));
        });
      }
      var items = document.querySelectorAll('#aako-support-panel .as-track-item');
      for (var j = 0; j < items.length; j++) {
        items[j].addEventListener('click', function () {
          trackTicket(this.getAttribute('data-ref'));
        });
      }
      $('asSubmit').addEventListener('click', submitTicket);
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
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePanel();
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