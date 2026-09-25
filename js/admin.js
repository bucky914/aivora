/* Admin dashboard.
 *
 * Uses Supabase Auth (email + password) and talks to the database directly.
 * What an admin can see or change is decided by Row Level Security in the
 * database (see supabase/schema.sql), NOT by this page. Hiding a button here
 * is only convenience; a signed-in non-admin gets empty results and blocked
 * writes from the server.
 *
 * Nothing in this file can change a score or a deadline: scores are computed
 * by the database, and admins have no UPDATE right on attempts/submissions.
 */
(function () {
  'use strict';

  var REFRESH_MS = 15000;
  var NEEDED = { easy: 5, medium: 5, hard: 0 };     // coding-only contest
  var POINTS = {
    coding: { easy: 10, medium: 20, hard: 30 }
  };

  function pointsFor(category, difficulty) {
    return (POINTS[category] && POINTS[category][difficulty]) || 0;
  }

  var $ = function (id) { return document.getElementById(id); };
  var sb = null;                     // Supabase client
  var results = [];                  // rows from admin_results
  var participantCount = 0;
  var questions = [];
  var sortKey = 'total_score', sortDir = 'desc';
  var refreshHandle = null, refreshing = false;
  var editingId = null;

  /* ------------------------------------------------------------ helpers */

  function show(el, on) { el.hidden = !on; }

  function text(tag, className, content) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (content !== undefined) n.textContent = content;
    return n;
  }

  /* Time of day only (with seconds, so the organiser can see who finished
   * first); the date is added only if it is not today. */
  function fmtTime(iso) {
    if (!iso) return '\u2013';
    var d = new Date(iso);
    if (isNaN(d)) return '\u2013';
    var t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (d.toDateString() === new Date().toDateString()) return t;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' }) + ' ' + t;
  }

  function niceError(err) {
    var m = (err && err.message) || 'Something went wrong.';
    if (/row-level security|permission denied/i.test(m)) return 'Your account is not allowed to do that. It must be listed in the admins table.';
    if (/foreign key|violates foreign key|still referenced/i.test(m)) return 'This question is already part of a participant\'s contest, so it cannot be deleted. Disable it instead.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Could not reach the server. Check your connection.';
    return m;
  }

  function confirmDialog(title, message, okLabel) {
    return new Promise(function (resolve) {
      var dlg = $('confirm-dialog');
      $('confirm-title').textContent = title;
      $('confirm-text').textContent = message;
      $('confirm-ok').textContent = okLabel || 'Confirm';
      function done() { dlg.removeEventListener('close', done); resolve(dlg.returnValue === 'ok'); }
      dlg.addEventListener('close', done);
      dlg.returnValue = '';
      dlg.showModal();
    });
  }

  /* --------------------------------------------------------------- auth */

  function init() {
    if (!CC.isConfigured()) {
      show($('login'), true);
      showLoginError(CC.errorMessage({ code: 'not_configured' }));
      $('login-btn').disabled = true;
      return;
    }
    try { sb = CC.adminClient(); }
    catch (e) { show($('login'), true); showLoginError(e.message); return; }

    sb.auth.getSession().then(function (r) {
      if (r.data && r.data.session) enterDashboard(r.data.session.user);
      else show($('login'), true);
    });
    sb.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT') leaveDashboard();
    });
  }

  function showLoginError(msg) {
    var e = $('login-error');
    e.textContent = msg; e.hidden = !msg;
  }

  $('login-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = $('login-email').value.trim();
    var password = $('login-password').value;
    if (!email || !password) { showLoginError('Enter your email and password.'); return; }
    showLoginError('');
    var btn = $('login-btn'); btn.disabled = true; btn.textContent = 'Signing in…';

    sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
      if (r.error) throw r.error;
      $('login-password').value = '';
      return enterDashboard(r.data.user);
    }).catch(function (err) {
      showLoginError(/invalid login/i.test(err.message) ? 'That email or password is not correct.' : niceError(err));
    }).then(function () {
      btn.disabled = false; btn.textContent = 'Sign in';
    });
  });

  /* Signing in is not enough: the account must be in the admins table. */
  function enterDashboard(user) {
    return sb.rpc('is_admin').then(function (r) {
      if (r.error) throw r.error;
      if (r.data !== true) {
        showLoginError('This account is not an admin. Ask the organiser to add it.');
        show($('login'), true); show($('dash'), false);
        return sb.auth.signOut();
      }
      show($('login'), false); show($('dash'), true);
      $('admin-email').textContent = user && user.email ? user.email : '';
      loadResults(); loadQuestions();
      startRefresh();
    }).catch(function (err) {
      show($('login'), true);
      showLoginError(niceError(err));
    });
  }

  function leaveDashboard() {
    stopRefresh();
    results = []; questions = [];
    show($('dash'), false); show($('login'), true);
  }

  $('signout-btn').addEventListener('click', function () { sb.auth.signOut(); });

  /* -------------------------------------------------------------- tabs */

  var views = { results: $('view-results'), questions: $('view-questions') };
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.atab'));

  function selectView(name) {
    tabButtons.forEach(function (b) {
      var on = b.getAttribute('data-view') === name;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    Object.keys(views).forEach(function (k) { show(views[k], k === name); });
    if (name === 'questions') loadQuestions();
  }
  tabButtons.forEach(function (b, i) {
    b.addEventListener('click', function () { selectView(b.getAttribute('data-view')); });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var other = tabButtons[(i + 1) % tabButtons.length];
      other.focus(); selectView(other.getAttribute('data-view'));
    });
  });

  /* ============================== RESULTS ============================== */

  function startRefresh() {
    stopRefresh();
    refreshHandle = setInterval(function () {
      // Only poll while someone is looking at the results tab.
      if (document.visibilityState === 'visible' && !views.results.hidden) loadResults(true);
    }, REFRESH_MS);
  }
  function stopRefresh() { if (refreshHandle) clearInterval(refreshHandle); refreshHandle = null; }

  function loadResults(quiet) {
    if (refreshing) return Promise.resolve();
    refreshing = true;
    var btn = $('refresh-btn');
    if (!quiet) { btn.disabled = true; }

    var rowsQ = sb.from('admin_results').select('*').order('started_at', { ascending: false }).limit(5000);
    var countQ = sb.from('participants').select('id', { count: 'exact', head: true });

    return Promise.all([rowsQ, countQ]).then(function (both) {
      if (both[0].error) throw both[0].error;
      if (both[1].error) throw both[1].error;
      results = both[0].data || [];
      participantCount = both[1].count || 0;
      renderStats();
      renderResults();
      $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
    }).catch(function (err) {
      $('updated').textContent = 'Could not refresh';
      if (!quiet) CC.toast(niceError(err), 'error');
    }).then(function () {
      refreshing = false; btn.disabled = false;
    });
  }

  function renderStats() {
    var by = { active: 0, completed: 0, expired: 0 };
    var solved = 0, scoreSum = 0;
    results.forEach(function (r) {
      if (by[r.status] !== undefined) by[r.status]++;
      solved += r.total_solved || 0;
      scoreSum += r.total_score || 0;
    });
    $('s-participants').textContent = participantCount;
    $('s-active').textContent = by.active;
    $('s-completed').textContent = by.completed;
    $('s-expired').textContent = by.expired;
    $('s-solved').textContent = solved;
    $('s-avg').textContent = results.length ? (scoreSum / results.length).toFixed(1) : '0';
  }

  function visibleResults() {
    var term = $('search').value.trim().toLowerCase();
    var status = $('status-filter').value;
    var rows = results.filter(function (r) {
      if (status && r.status !== status) return false;
      if (!term) return true;
      return (r.name || '').toLowerCase().indexOf(term) !== -1 ||
             (r.participant_no || '').toLowerCase().indexOf(term) !== -1;
    });

    // Rank = position by total score (ties share order by earlier finish).
    var ranked = results.slice().sort(compareByScore);
    var rankOf = {};
    ranked.forEach(function (r, i) { rankOf[r.attempt_id] = i + 1; });
    rows.forEach(function (r) { r._rank = rankOf[r.attempt_id]; });

    var dir = sortDir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) {
      var x = sortKey === 'rank' ? a._rank : a[sortKey];
      var y = sortKey === 'rank' ? b._rank : b[sortKey];
      if (x == null && y == null) return 0;
      if (x == null) return 1;                 // empty values always last
      if (y == null) return -1;
      if (typeof x === 'string') return x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' }) * dir;
      return (x - y) * dir;
    });
    return rows;
  }

  function compareByScore(a, b) {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    var ea = a.ended_at ? Date.parse(a.ended_at) : Infinity;
    var eb = b.ended_at ? Date.parse(b.ended_at) : Infinity;
    if (ea !== eb) return ea - eb;
    return Date.parse(a.started_at) - Date.parse(b.started_at);
  }

  function renderResults() {
    var rows = visibleResults();
    var body = $('results-body');
    body.textContent = '';
    show($('results-empty'), rows.length === 0);

    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      tr.appendChild(text('td', 'num muted', r._rank));
      tr.appendChild(text('td', 'name-cell', r.name));
      tr.appendChild(text('td', 'mono-cell', r.participant_no));
      tr.appendChild(text('td', 'muted', fmtTime(r.started_at)));
      tr.appendChild(text('td', 'muted', fmtTime(r.ended_at)));
      tr.appendChild(text('td', 'num', r.coding_solved + ' / 10'));
      tr.appendChild(text('td', 'num', r.total_solved + ' / 10'));
      tr.appendChild(text('td', 'num', r.coding_score));
      tr.appendChild(text('td', 'num total', r.total_score));

      var st = document.createElement('td');
      st.appendChild(text('span', 'status status-' + r.status, r.status));
      tr.appendChild(st);

      var act = text('td', 'actions');
      var reset = text('button', 'btn btn-danger btn-small', 'Reset');
      reset.type = 'button';
      reset.setAttribute('aria-label', 'Reset ' + r.name);
      reset.addEventListener('click', function () { resetParticipant(r); });
      act.appendChild(reset);
      tr.appendChild(act);
      body.appendChild(tr);
    });

    Array.prototype.forEach.call(document.querySelectorAll('th[data-sort]'), function (th) {
      var k = th.getAttribute('data-sort');
      if (k === sortKey) th.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  function resetParticipant(r) {
    confirmDialog(
      'Reset ' + r.name + '?',
      'This deletes their attempt (' + r.participant_no + ', ' + r.total_solved + ' solved, score ' + r.total_score +
      '). They can then start again with a new timer and new questions. This cannot be undone.',
      'Reset participant'
    ).then(function (yes) {
      if (!yes) return;
      return sb.from('attempts').delete().eq('id', r.attempt_id).select('id').then(function (res) {
        if (res.error) throw res.error;
        if (!res.data || !res.data.length) throw new Error('Nothing was deleted. Your account may not be allowed to reset attempts.');
        CC.toast(r.name + ' was reset.', 'success');
        return loadResults(true);
      });
    }).catch(function (err) { CC.toast(niceError(err), 'error'); });
  }

  Array.prototype.forEach.call(document.querySelectorAll('th[data-sort]'), function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (sortKey === k) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortKey = k; sortDir = (k === 'name' || k === 'participant_no' || k === 'rank' || k === 'status') ? 'asc' : 'desc'; }
      renderResults();
    });
  });
  $('search').addEventListener('input', renderResults);
  $('status-filter').addEventListener('change', renderResults);
  $('refresh-btn').addEventListener('click', function () { loadResults(false); });

  /* CSV: guards against spreadsheet formula injection from typed names. */
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  $('csv-btn').addEventListener('click', function () {
    var rows = visibleResults();
    if (!rows.length) { CC.toast('Nothing to export.', 'warning'); return; }
    var head = ['Rank', 'Name', 'Participant No', 'Start', 'End', 'Coding Solved', 'Total Solved', 'Coding Score', 'Total Score', 'Status'];
    var lines = [head.map(csvCell).join(',')];
    rows.forEach(function (r) {
      lines.push([r._rank, r.name, r.participant_no, r.started_at, r.ended_at, r.coding_solved,
        r.total_solved, r.coding_score, r.total_score, r.status].map(csvCell).join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bug-busters-results.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  /* ============================= QUESTIONS ============================= */

  function loadQuestions() {
    return sb.from('questions').select('*').eq('category', 'coding').order('difficulty').order('created_at').then(function (r) {
      if (r.error) throw r.error;
      questions = r.data || [];
      renderBankHealth();
      renderQuestions();
    }).catch(function (err) { CC.toast(niceError(err), 'error'); });
  }

  /* Warn early if new participants would not get a full set. */
  function renderBankHealth() {
    var box = $('bank-health');
    box.textContent = '';
    var counts = { easy: 0, medium: 0 };
    var bad = false;
    questions.forEach(function (q) {
      if (q.is_active && (q.difficulty === 'easy' || q.difficulty === 'medium')) counts[q.difficulty]++;
    });

    var grid = text('div', 'bank-grid');
    ['easy', 'medium'].forEach(function (d) {
      var need = NEEDED[d], short = counts[d] < need;
      if (short) bad = true;
      grid.appendChild(text('span', short ? 'short' : '',
        'Coding ' + d + ': ' + counts[d] + ' enabled (need ' + need + ')'));
    });

    box.classList.toggle('is-bad', bad);
    box.appendChild(text('strong', '', bad
      ? 'Not enough enabled coding questions. New participants cannot start until this is fixed.'
      : 'Question bank is ready. Every new participant gets 5 easy and 5 medium coding questions.'));
    box.appendChild(grid);
  }

  function visibleQuestions() {
    var cat = $('q-cat').value, diff = $('q-diff').value, term = $('q-search').value.trim().toLowerCase();
    return questions.filter(function (q) {
      return (!cat || q.category === cat) && (!diff || q.difficulty === diff) &&
             (!term || q.title.toLowerCase().indexOf(term) !== -1);
    });
  }

  function renderQuestions() {
    var rows = visibleQuestions();
    var body = $('q-body');
    body.textContent = '';
    show($('q-empty'), rows.length === 0);

    rows.forEach(function (q) {
      var tr = document.createElement('tr');
      var title = text('td', 'name-cell', q.title);
      if (!q.is_active) title.classList.add('muted');
      tr.appendChild(title);
      tr.appendChild(text('td', '', q.category === 'sql' ? 'SQL' : 'Coding (DSA)'));

      var d = document.createElement('td');
      d.appendChild(text('span', 'badge badge-' + q.difficulty, q.difficulty));
      tr.appendChild(d);
      tr.appendChild(text('td', 'num', q.points));

      var en = document.createElement('td');
      var t = document.createElement('button');
      t.type = 'button'; t.className = 'toggle'; t.setAttribute('role', 'switch');
      t.setAttribute('aria-checked', q.is_active ? 'true' : 'false');
      t.setAttribute('aria-label', (q.is_active ? 'Disable ' : 'Enable ') + q.title);
      t.addEventListener('click', function () { setActive(q, !q.is_active, t); });
      en.appendChild(t);
      tr.appendChild(en);

      var act = text('td', 'actions');
      var wrap = text('span', 'row-actions');
      var edit = text('button', 'btn btn-ghost btn-small', 'Edit');
      edit.type = 'button'; edit.setAttribute('aria-label', 'Edit ' + q.title);
      edit.addEventListener('click', function () { openEditor(q); });
      var del = text('button', 'btn btn-danger btn-small', 'Delete');
      del.type = 'button'; del.setAttribute('aria-label', 'Delete ' + q.title);
      del.addEventListener('click', function () { deleteQuestion(q); });
      wrap.appendChild(edit); wrap.appendChild(del);
      act.appendChild(wrap);
      tr.appendChild(act);
      body.appendChild(tr);
    });
  }

  function setActive(q, on, btn) {
    btn.disabled = true;
    sb.from('questions').update({ is_active: on }).eq('id', q.id).select('id').then(function (r) {
      if (r.error) throw r.error;
      if (!r.data || !r.data.length) throw new Error('Not allowed.');
      q.is_active = on;
      CC.toast('"' + q.title + '" ' + (on ? 'enabled' : 'disabled') + '.', 'success', 2200);
      renderBankHealth(); renderQuestions();
    }).catch(function (err) { btn.disabled = false; CC.toast(niceError(err), 'error'); });
  }

  function deleteQuestion(q) {
    confirmDialog(
      'Delete "' + q.title + '"?',
      'This permanently removes the question. If a participant has already been given it, the database will refuse; disable it instead.',
      'Delete question'
    ).then(function (yes) {
      if (!yes) return;
      return sb.from('questions').delete().eq('id', q.id).select('id').then(function (r) {
        if (r.error) throw r.error;
        if (!r.data || !r.data.length) throw new Error('Nothing was deleted.');
        CC.toast('Question deleted.', 'success');
        return loadQuestions();
      });
    }).catch(function (err) { CC.toast(niceError(err), 'error'); });
  }

  ['q-cat', 'q-diff'].forEach(function (id) { $(id).addEventListener('change', renderQuestions); });
  $('q-search').addEventListener('input', renderQuestions);

  /* ------------------------------------------------------ add / edit form */

  var dlg = $('q-dialog');
  var F = {
    category: $('f-category'), difficulty: $('f-difficulty'), title: $('f-title'),
    description: $('f-description'), input: $('f-input'), output: $('f-output'),
    examples: $('f-examples'), constraints: $('f-constraints'), starter: $('f-starter'),
    active: $('f-active')
  };

  function formError(msg) { var e = $('q-form-error'); e.textContent = msg || ''; e.hidden = !msg; }

  function openEditor(q) {
    editingId = q ? q.id : null;
    $('q-dialog-title').textContent = q ? 'Edit question' : 'Add question';
    formError('');
    F.category.value = q ? q.category : 'coding';
    F.difficulty.value = q ? q.difficulty : 'easy';
    F.title.value = q ? q.title : '';
    F.description.value = q ? q.description : '';
    F.input.value = q && q.input_format ? q.input_format : '';
    F.output.value = q && q.output_format ? q.output_format : '';
    F.examples.value = JSON.stringify(q ? (q.examples || []) : [{ input: '', output: '', explanation: '' }], null, 2);
    F.constraints.value = q && q.constraints ? q.constraints : '';
    F.starter.value = q && q.starter_content ? q.starter_content : '';
    F.active.checked = q ? !!q.is_active : true;
    dlg.showModal();
    F.title.focus();
  }

  $('q-add').addEventListener('click', function () { openEditor(null); });
  $('q-cancel').addEventListener('click', function () { dlg.close(); });

  function nullable(v) { v = v.trim(); return v === '' ? null : v; }

  $('q-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    formError('');

    var title = F.title.value.trim();
    var description = F.description.value.trim();
    if (!title) { formError('Enter a title.'); F.title.focus(); return; }
    if (!description) { formError('Enter a description.'); F.description.focus(); return; }

    var examples;
    try {
      examples = JSON.parse(F.examples.value.trim() || '[]');
    } catch (e) {
      formError('Examples must be valid JSON. ' + e.message); F.examples.focus(); return;
    }
    if (!Array.isArray(examples)) { formError('Examples must be a list, like [ { ... }, { ... } ].'); F.examples.focus(); return; }
    // Drop untouched blank rows so participants never see an empty example.
    examples = examples.filter(function (ex) {
      return ex && typeof ex === 'object' && Object.keys(ex).some(function (k) { return String(ex[k] == null ? '' : ex[k]).trim() !== ''; });
    });

    // Points follow BOTH category and difficulty; the database enforces this too.
    var row = {
      category: F.category.value,
      difficulty: F.difficulty.value,
      points: pointsFor(F.category.value, F.difficulty.value),
      title: title,
      description: description,
      input_format: nullable(F.input.value),
      output_format: nullable(F.output.value),
      examples: examples,
      constraints: nullable(F.constraints.value),
      starter_content: nullable(F.starter.value),
      is_active: F.active.checked
    };

    var save = $('q-save'); save.disabled = true; save.textContent = 'Saving…';
    var req = editingId
      ? sb.from('questions').update(row).eq('id', editingId).select('id')
      : sb.from('questions').insert(row).select('id');

    req.then(function (r) {
      if (r.error) throw r.error;
      if (!r.data || !r.data.length) throw new Error('Not saved. Your account may not be allowed to edit questions.');
      dlg.close();
      CC.toast(editingId ? 'Question updated.' : 'Question added.', 'success');
      return loadQuestions();
    }).catch(function (err) {
      formError(niceError(err));
    }).then(function () {
      save.disabled = false; save.textContent = 'Save';
    });
  });

  init();
})();
