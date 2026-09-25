/* Shared client helpers: Supabase config, Edge Function calls,
 * the participant's session, and toast notifications.
 *
 * Participants NEVER use Supabase Auth. Their browser only calls the Edge
 * Functions with the secret attempt token it received from start-attempt.
 * Only admin.js uses the Supabase client library (for admin sign-in).
 */
(function (global) {
  'use strict';

  // ▼▼▼ EDIT THESE TWO VALUES  (Supabase dashboard → Project Settings → API) ▼▼▼
  var SUPABASE_URL = 'https://knaohnqrmrowilrxqbxa.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuYW9obnFybXJvd2lscnhxYnhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NzU2NTgsImV4cCI6MjEwNTU1MTY1OH0.9fHx0oLaJy0ds-gb9J0sFgK-Wzk7sHSJKDKgaeq8RFw';
  // ▲▲▲ The anon/publishable key is safe to expose. NEVER paste the service_role key here. ▲▲▲

  var MESSAGES = {
    invalid_input: 'Check your name and participant number and try again.',
    name_mismatch: 'This participant number is already used with a different name. Enter the exact name you started with, or ask an organiser for help.',
    not_enough_questions: 'The questions are not ready yet. Please tell an organiser.',
    not_found: 'We could not find this contest session. Start again from the home page.',
    expired: 'Time is up. Your answers are locked.',
    attempt_closed: 'This contest has already ended. Your answers are locked.',
    answer_too_long: 'Your answer is too long. Keep it under 20,000 characters.',
    question_not_assigned: 'That question is not part of your contest.',
    not_a_coding_question: 'This question does not use the code editor.',
    execution_unavailable: 'The code execution service is not available right now. Please try again shortly, or tell an organiser.',
    not_configured: 'The site is not connected to Supabase yet. Set the URL and anon key in js/supabase.js.',
    network_error: 'Could not reach the server. Check your connection and try again.',
    server_error: 'Something went wrong on our side. Please try again.'
  };

  function isConfigured() {
    return SUPABASE_URL.indexOf('YOUR-PROJECT-REF') === -1 && SUPABASE_ANON_KEY.indexOf('YOUR-ANON') === -1;
  }

  function errorMessage(err) {
    if (err && MESSAGES[err.code]) return MESSAGES[err.code];
    // Prefer the real message the server sent (Edge Functions always send
    // a human-readable `message` alongside `error`) over a generic canned
    // string, so a genuine backend problem is visible instead of hidden
    // behind "Something went wrong on our side."
    if (err && err.message) return err.message;
    return MESSAGES.server_error;
  }

  /* POST JSON to an Edge Function. Resolves with the parsed body when ok,
   * rejects with an Error that has .code (e.g. "expired") and .status. */
  function callFunction(name, body, options) {
    if (!isConfigured()) {
      var cfg = new Error(MESSAGES.not_configured);
      cfg.code = 'not_configured';
      return Promise.reject(cfg);
    }
    var init = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(body || {})
    };
    if (options && options.keepalive) init.keepalive = true;

    return fetch(SUPABASE_URL + '/functions/v1/' + name, init).then(
      function (res) {
        return res.json().catch(function () { return null; }).then(function (data) {
          if (!res.ok || !data || data.ok === false) {
            var message = (data && data.message) || ('Request failed (HTTP ' + res.status + ').');
            var err = new Error(message);
            err.code = (data && data.error) || (res.status >= 500 ? 'server_error' : 'request_failed');
            err.status = res.status;
            console.error('Edge Function "' + name + '" failed:', err.code, message, 'status:', res.status);
            throw err;
          }
          return data;
        });
      },
      function (fetchErr) {
        // fetch() itself rejected: no HTTP response at all. This is what a
        // DNS failure, dropped connection, or a genuine CORS block all look
        // like from JavaScript — the browser deliberately hides which one,
        // so this is the most specific message we can show. Logged in full
        // to the console for local debugging.
        console.error('Edge Function "' + name + '" network error (offline, unreachable, or blocked by CORS):', fetchErr);
        var err = new Error(MESSAGES.network_error);
        err.code = 'network_error';
        throw err;
      }
    );
  }

  /* The participant's session = which attempt this browser owns. */
  var SESSION_KEY = 'cc_session_v1';

  function getStore() {
    var kinds = ['localStorage', 'sessionStorage'];
    for (var i = 0; i < kinds.length; i++) {
      try {
        var s = global[kinds[i]];
        s.setItem('__cc_test__', '1');
        s.removeItem('__cc_test__');
        return s;
      } catch (e) { /* try the next one */ }
    }
    return null;
  }

  var session = {
    get: function () {
      var s = getStore();
      if (!s) return null;
      try {
        var v = JSON.parse(s.getItem(SESSION_KEY));
        return v && v.attempt_id && v.token ? v : null;
      } catch (e) { return null; }
    },
    set: function (value) {
      var s = getStore();
      if (!s) return false;
      s.setItem(SESSION_KEY, JSON.stringify(value));
      return true;
    },
    clear: function () {
      var s = getStore();
      if (s) s.removeItem(SESSION_KEY);
    }
  };

  /* Small, polite notifications. */
  function toast(message, kind, ms) {
    kind = kind || 'info';
    ms = ms || 4500;
    var box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      box.className = 'toasts';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    var t = document.createElement('div');
    t.className = 'toast toast-' + kind;
    t.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    t.textContent = message;
    box.appendChild(t);
    setTimeout(function () { t.classList.add('toast-out'); }, ms - 250);
    setTimeout(function () { t.remove(); }, ms);
  }

  /* Admin-only: Supabase JS client (needs the CDN script loaded first). */
  var adminInstance = null;
  function adminClient() {
    if (adminInstance) return adminInstance;
    if (!global.supabase || !global.supabase.createClient) {
      throw new Error('The Supabase library failed to load. Check your internet connection.');
    }
    adminInstance = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return adminInstance;
  }

  global.CC = {
    callFunction: callFunction,
    session: session,
    toast: toast,
    adminClient: adminClient,
    errorMessage: errorMessage,
    isConfigured: isConfigured
  };
})(window);
