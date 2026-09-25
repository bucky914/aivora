/* Home page: collect Name + Participant Number, start (or resume) the attempt.
 * No registration, no login, no email, no password. */
(function () {
  'use strict';

  var CC = window.CC;
  var form = document.getElementById('start-form');
  var nameInput = document.getElementById('name');
  var noInput = document.getElementById('participant-no');
  var nameError = document.getElementById('name-error');
  var noError = document.getElementById('no-error');
  var formError = document.getElementById('form-error');
  var button = document.getElementById('start-btn');

  // Same rules as the start-attempt Edge Function (which is the real check).
  var NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'\-]{0,79}$/u;
  var NO_RE = /^[A-Za-z0-9][A-Za-z0-9 _\-\/.]{0,29}$/;

  function setFieldError(input, output, message) {
    output.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = !message;
  }

  function validate() {
    var name = nameInput.value.trim().replace(/\s+/g, ' ');
    var no = noInput.value.trim();
    var ok = true;

    if (!name) {
      setFieldError(nameInput, nameError, 'Enter your name.');
      ok = false;
    } else if (!NAME_RE.test(name)) {
      setFieldError(nameInput, nameError, 'Use letters, spaces, dots, apostrophes or hyphens only.');
      ok = false;
    } else {
      setFieldError(nameInput, nameError, '');
    }

    if (!no) {
      setFieldError(noInput, noError, 'Enter your participant number.');
      ok = false;
    } else if (!NO_RE.test(no)) {
      setFieldError(noInput, noError, 'Use letters, numbers, spaces or - _ / . only (up to 30 characters).');
      ok = false;
    } else {
      setFieldError(noInput, noError, '');
    }

    if (!ok) {
      var firstBad = form.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      return null;
    }
    return { name: name, participant_no: no };
  }

  function setBusy(busy) {
    button.disabled = busy;
    button.textContent = busy ? 'STARTING…' : 'START NOW';
  }

  // Best-effort fullscreen request from the START NOW user gesture.
  // Some browsers exit fullscreen when navigating to contest.html; the
  // contest page therefore requests it again and blocks the UI until it is
  // active.
  function requestFullscreenFromStartGesture() {
    var root = document.documentElement;
    if (!root.requestFullscreen) return Promise.resolve(false);
    return root.requestFullscreen({ navigationUI: 'hide' }).then(function () {
      return true;
    }).catch(function () {
      return false;
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    showFormError('');

    var values = validate();
    if (!values) return;

    setBusy(true);
    // Start the server attempt exactly as before. The fullscreen request is
    // deliberately best-effort because permissions/browser policy vary.
    requestFullscreenFromStartGesture();
    CC.callFunction('start-attempt', values).then(
      function (data) {
        var saved = CC.session.set({ attempt_id: data.attempt_id, token: data.access_token });
        if (!saved) {
          setBusy(false);
          showFormError('Your browser is blocking storage, so the contest cannot keep your place. Allow site data for this page and try again.');
          return;
        }
        window.location.href = 'contest.html';
      },
      function (err) {
        setBusy(false);
        showFormError(CC.errorMessage(err));
      }
    );
  });

  // Clear a field's error as soon as the person starts fixing it.
  nameInput.addEventListener('input', function () { setFieldError(nameInput, nameError, ''); });
  noInput.addEventListener('input', function () { setFieldError(noInput, noError, ''); });

  // Sent back here when a saved session no longer exists.
  if (new URLSearchParams(window.location.search).get('reason') === 'session') {
    showFormError('We could not find your contest session. Enter your details again to continue where you left off.');
  }
})();
