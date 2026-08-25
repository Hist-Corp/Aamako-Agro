// ─── Password visibility toggle ──────────────────────────────────────────────
// Shared by sign-in / sign-up forms.
// Button markup must contain two SVGs: <svg class="eye-open"> and <svg class="eye-closed">.
(function () {
  'use strict';

  window.togglePassword = function (inputId, btn) {
    var input = document.getElementById(inputId);
    if (!input || !btn) return;

    var willHide = input.type === 'text';
    input.type = willHide ? 'password' : 'text';

    var eyeOpen = btn.querySelector('.eye-open');
    var eyeClosed = btn.querySelector('.eye-closed');
    if (eyeOpen && eyeClosed) {
      eyeOpen.style.display = willHide ? '' : 'none';
      eyeClosed.style.display = willHide ? 'none' : '';
    }

    btn.setAttribute('aria-label', willHide ? 'Show password' : 'Hide password');
  };
})();
