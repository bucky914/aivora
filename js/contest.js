/* Contest page.
 *
 * Everything shown here comes from the server (get-attempt). Nothing is
 * chosen, scored, or timed by the browser on its own:
 *   - the 10 questions are the ones stored in attempt_questions,
 *   - the score is calculated by the database from category + difficulty,
 *   - time is up only when the server says so.
 * Answers are plain text. They are never run, compiled, or tested.
 */
(function () {
  'use strict';

  var AUTOSAVE_DELAY_MS = 1200;
  var MAX_ANSWER = 20000;
  var CLOCK_RESYNC_MS = 60000;

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    boot: $('boot'), bootText: $('boot-text'), bootRetry: $('boot-retry'),
    app: $('app'),
    whoName: $('who-name'), whoNo: $('who-no'), progress: $('progress-text'),
    finishBtn: $('finish-btn'), clock: $('clock'), clockBox: document.querySelector('.clock'),
    tabs: Array.prototype.slice.call(document.querySelectorAll('.tab')),
    counts: { coding: $('count-coding'), sql: $('count-sql') },
    qnav: $('qnav'),
    problem: $('problem-pane'),
    answerPane: $('answer-pane'),
    answerLabel: $('answer-label'), answer: $('answer-input'),
    saveStatus: $('save-status'), hint: $('answer-hint'), charCount: $('char-count'),
    solveBtn: $('solve-btn'),
    result: $('result'), resultTitle: $('result-title'), resultNote: $('result-note'),
    overlay: $('overlay'), overlayMsg: $('overlay-msg'), overlayAction: $('overlay-action'), overlaySubmit: $('overlay-submit'),
    dialog: $('finish-dialog'), finishSummary: $('finish-summary'),
    // Coding (DSA) workspace
    codePane: $('code-pane'), monacoContainer: $('monaco-container'),
    codeLang: $('code-lang'), codeSaveStatus: $('code-save-status'),
    runBtn: $('run-btn'), submitBtn: $('submit-btn'),
    testTabCases: $('test-tab-cases'), testTabResult: $('test-tab-result'),
    testCasesView: $('test-cases-view'), testResultView: $('test-result-view'),
    testResultEmpty: $('test-result-empty'),
    // SQL workspace
    sqlPane: $('sql-pane'), sqlMonacoContainer: $('sql-monaco-container'),
    sqlLang: $('sql-lang'), sqlSaveStatus: $('sql-save-status'),
    sqlRunBtn: $('sql-run-btn'), sqlSubmitBtn: $('sql-submit-btn'),
    sqlTestTabCases: $('sql-test-tab-cases'), sqlTestTabResult: $('sql-test-tab-result'),
    sqlTestCasesView: $('sql-test-cases-view'), sqlTestResultView: $('sql-test-result-view'),
    sqlTestResultEmpty: $('sql-test-result-empty')
  };

  var state = {
    session: null,
    participant: null,
    questions: [],      // all 10 coding questions, by display_order
    byId: {},           // question_id -> question object
    category: 'coding',
    index: 0,           // position inside the current category
    status: 'active',
    summary: null,
    ended: false
  };

  var timer = null;
  var saveTimers = {};        // question_id -> timeout handle
  var saveChain = {};         // question_id -> promise (keeps saves in order)
  var saveRetryCount = {};    // question_id -> consecutive failed-save count (caps the retry loop)
  var lastSavedText = {};     // question_id -> last text the server confirmed
  var resyncHandle = null;
  var ending = false;
  var editorFor = null;       // question_id whose text is in the editor right now
  var confirming = false;     // a zero-time check with the server is in flight

  // --- Strict contest browser lock ---
  // Browsers cannot physically disable OS-level Alt+Tab/Ctrl+Tab, so the
  // enforceable behavior is: require fullscreen, detect leaving the contest
  // document, lock the UI immediately, then require an explicit Continue
  // Contest or Submit Contest choice from the participant.
  var securityLockActive = false;
  var securityEnding = false;
  var securityViolationPending = false;
  var securityReason = '';
  var fullscreenRetryBusy = false;

  // --- Coding (DSA) workspace state ---
  var codeEditorFor = null;               // question_id currently mounted in Monaco
  var codeSaveTimers = {};                // question_id:language -> timeout handle (per-language autosave)
  var codeSaveChain = {};                 // question_id -> promise chain (keeps code saves in order)
  var codeSaveRetryCount = {};            // question_id:language -> consecutive failed-save count (caps the retry loop)
  var lastSavedCode = {};                 // question_id -> { python3: "...", java: "...", ... }
  var codeEditorLoading = false;          // Monaco is being mounted for the current question
  var lastRunResult = null;               // most recent Run/Submit result shown in the Test Result tab

  // --- SQL workspace state (parallel to the coding state above, kept
  // entirely separate so nothing here can affect the coding path) ---
  var sqlEditorFor = null;                // question_id currently mounted in the SQL Monaco editor
  var sqlSaveTimers = {};                 // question_id:dialect -> timeout handle (per-dialect autosave)
  var sqlSaveChain = {};                  // question_id -> promise chain (keeps SQL saves in order)
  var sqlSaveRetryCount = {};             // question_id:dialect -> consecutive failed-save count (caps the retry loop)
  var lastSavedSql = {};                  // question_id -> { sql: "...", postgresql: "..." }
  var sqlEditorLoading = false;           // SQL Monaco is being mounted for the current question
  var lastSqlRunResult = null;            // most recent Run/Submit result shown in the SQL Test Result tab
  var sqlActionBusy = false;              // a SQL Run/Submit call is in flight

  // Category alone decides the editor: every 'coding' question gets the
  // Monaco workspace. A coding question with no coding_config yet (e.g.
  // one an admin just added, before configuring it) still gets the
  // coding pane, but shows a clear "not configured" state instead of
  // silently falling back to the old plain-text textarea — see
  // renderCodeQuestion().
  function isCodingQuestion(q) {
    return !!q && q.category === 'coding';
  }

  function hasCodingConfig(q) {
    return !!q && q.coding && q.coding.function_name;
  }

  function isSqlQuestion(q) {
    return !!q && q.category === 'sql';
  }

  function hasSqlConfig(q) {
    return !!q && q.sql && q.sql.schema_sql;
  }

  /* ---------------------------------------------------------------- boot */

  function showBootError(message) {
    el.boot.hidden = false;
    el.boot.classList.add('is-error');
    el.bootText.textContent = message;
    el.bootRetry.hidden = false;
  }

  function goHome(reason) {
    window.location.replace('index.html' + (reason ? '?reason=' + reason : ''));
  }

  function load() {
    state.session = CC.session.get();
    if (!state.session) { goHome('session'); return; }

    el.boot.classList.remove('is-error');
    el.boot.hidden = false;
    el.bootText.textContent = 'Loading your contest…';
    el.bootRetry.hidden = true;

    var t0 = performance.now();
    CC.callFunction('get-attempt', {
      attempt_id: state.session.attempt_id,
      token: state.session.token
    }).then(function (data) {
      var t1 = performance.now();
      // The server produced server_now_ms roughly halfway through the request.
      begin(data, (t0 + t1) / 2);
    }).catch(function (err) {
      if (err.code === 'not_found' || err.code === 'invalid_input') {
        CC.session.clear();
        goHome('session');
        return;
      }
      showBootError(CC.errorMessage(err));
    });
  }

  function begin(data, perfMark) {
    state.participant = data.participant;
    state.status = data.attempt.status;
    state.summary = data.summary;
    state.questions = (data.questions || []).slice().sort(function (a, b) {
      if (a.category !== b.category) return a.category < b.category ? -1 : 1;
      return a.display_order - b.display_order;
    });
    state.byId = {};
    state.questions.forEach(function (q) {
      state.byId[q.question_id] = q;
      if (isCodingQuestion(q)) {
        // Seed from the server's saved draft, falling back to per-language
        // starter code. Treat that as "already saved" so opening a question
        // never writes the starter template back to the server. A coding
        // question with no coding_config yet still gets an (empty) entry
        // here rather than falling through to the plain-text path below.
        var draft = (q.code_draft && q.code_draft.code_by_lang) || {};
        var starters = (hasCodingConfig(q) && q.coding.starter_code) || {};
        var seeded = {};
        CodeEditor.LANGUAGES.forEach(function (lang) {
          seeded[lang] = (draft[lang] != null && draft[lang] !== '') ? draft[lang] : (starters[lang] || '');
        });
        lastSavedCode[q.question_id] = seeded;
        return;
      }
      if (isSqlQuestion(q)) {
        // Same pattern as coding, but both dialects start from the same
        // shared starter text (SQL questions have no per-dialect starter
        // the way coding questions have per-language starter_code).
        var sqlDraft = (q.sql_draft && q.sql_draft.query_by_lang) || {};
        var sqlStarter = q.starter_content || '';
        var seededSql = {};
        SqlEditor.DIALECTS.forEach(function (dialect) {
          seededSql[dialect] = (sqlDraft[dialect] != null && sqlDraft[dialect] !== '') ? sqlDraft[dialect] : sqlStarter;
        });
        lastSavedSql[q.question_id] = seededSql;
        return;
      }
      // If nothing is saved yet the editor shows the starter text, so treat
      // that as "already saved" - otherwise just opening a question would
      // write the starter template back to the server.
      lastSavedText[q.question_id] = (q.answer != null && q.answer !== '') ? q.answer : (q.starter_content || '');
    });

    el.whoName.textContent = state.participant.name;
    el.whoNo.textContent = state.participant.participant_no;

    if (state.status !== 'active') {
      // Already finished (for example the person refreshed after time ran out).
      showResult(data.summary, state.status);
      return;
    }

    el.boot.hidden = true;
    el.app.hidden = false;

    timer = new ServerTimer({ onTick: onTick, onZero: onZero });
    timer.sync(data.attempt.expires_at_ms, data.server_now_ms, perfMark);
    timer.start();
    resyncHandle = setInterval(resyncClock, CLOCK_RESYNC_MS);

    renderCounts();
    selectCategory(state.category, 0, true);
    activateContestSecurity();
  }

  /* --------------------------------------------------------------- clock */

  function onTick(ms) {
    el.clock.textContent = ServerTimer.format(ms);
    var sec = ms / 1000;
    el.clockBox.classList.toggle('is-low', sec <= 300 && sec > 60);
    el.clockBox.classList.toggle('is-critical', sec <= 60);
  }

  /* The countdown reached zero. Ask the server; it decides. */
  function onZero() {
    if (state.ended || confirming) return;      // already over, or a check is in flight
    confirming = true;
    holdInputs();                               // block edits while we ask (not final yet)
    showOverlay('Time is up. Locking your answers…');
    fetchState(true).catch(function () {
      // Server unreachable: stay locked and let the timer ask again in ~2 seconds.
      showOverlay('Time is up. Confirming with the server…');
    }).then(function () { confirming = false; });
  }

  /* Light re-sync so a long-lived tab cannot drift from the server. */
  function resyncClock() {
    if (state.ended || !timer) return;
    var t0 = performance.now();
    CC.callFunction('get-attempt', {
      attempt_id: state.session.attempt_id,
      token: state.session.token,
      light: true
    }).then(function (data) {
      if (state.ended) return;
      var mid = (t0 + performance.now()) / 2;
      timer.sync(data.attempt.expires_at_ms, data.server_now_ms, mid);
      if (data.attempt.status !== 'active') finishFromServer(data.summary, data.attempt.status);
    }).catch(function () { /* transient; the next resync will try again */ });
  }

  /* Full state fetch used when the server needs to confirm the ending. */
  function fetchState(fromTimer) {
    var t0 = performance.now();
    return CC.callFunction('get-attempt', {
      attempt_id: state.session.attempt_id,
      token: state.session.token
    }).then(function (data) {
      if (data.attempt.status !== 'active') {
        finishFromServer(data.summary, data.attempt.status);
        return;
      }
      // The server says there is still time left (our clock was slightly ahead).
      timer.sync(data.attempt.expires_at_ms, data.server_now_ms, (t0 + performance.now()) / 2);
      if (fromTimer) { hideOverlay(); unlockInputs(); }
    });
  }

  /* ------------------------------------------------------------ tabs/nav */

  function inCategory(cat) {
    return state.questions.filter(function (q) { return q.category === cat; });
  }

  function currentQuestion() {
    return inCategory(state.category)[state.index] || null;
  }

  function renderCounts() {
    var list = inCategory('coding');
    var solved = list.filter(function (q) { return q.is_solved; }).length;
    if (el.counts.coding) el.counts.coding.textContent = solved + '/' + list.length;
    if (el.counts.sql) el.counts.sql.textContent = '';
    el.progress.textContent = solved + '/' + list.length + ' solved';
  }

  function selectCategory(cat, index, silent) {
    flushSave(currentQuestion());
    flushCodeSave(currentQuestion());
    state.category = cat;
    state.index = Math.max(0, Math.min(index || 0, inCategory(cat).length - 1));

    el.tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-cat') === cat;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    el.answerLabel.textContent = cat === 'sql' ? 'Your SQL query' : 'Your solution';
    el.hint.textContent = cat === 'sql'
      ? 'Write your query here. It is saved as text and is not run.'
      : 'Write your code here. It is saved as text and is not run or tested.';   // shown only for coding questions with no coding_config (plain-text fallback)

    renderNav();
    renderQuestion(silent);
  }

  function renderNav() {
    el.qnav.textContent = '';
    inCategory(state.category).forEach(function (q, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'qbtn' + (q.is_solved ? ' is-solved' : '');
      b.setAttribute('data-diff', q.difficulty);
      b.setAttribute('aria-label', 'Question ' + (i + 1) + ', ' + q.difficulty + (q.is_solved ? ', solved' : ''));
      if (i === state.index) b.setAttribute('aria-current', 'true');
      b.textContent = String(i + 1);
      b.addEventListener('click', function () {
        if (i === state.index) return;
        flushSave(currentQuestion());
        flushCodeSave(currentQuestion());
            state.index = i;
        renderNav();
        renderQuestion();
      });
      el.qnav.appendChild(b);
    });
  }

  /* ------------------------------------------------------- render a question */

  function text(tag, className, content) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    n.textContent = content;
    return n;
  }

  /* Inline `code` spans -> <code>. Built with DOM nodes, never innerHTML. */
  function appendInline(parent, str) {
    var parts = String(str).split(/(`[^`\n]+`)/);
    parts.forEach(function (part) {
      if (part.length > 2 && part.charAt(0) === '`' && part.charAt(part.length - 1) === '`') {
        parent.appendChild(text('code', '', part.slice(1, -1)));
      } else if (part) {
        parent.appendChild(document.createTextNode(part));
      }
    });
  }

  /* Descriptions: paragraphs separated by blank lines, and ``` fenced blocks. */
  function renderRichText(str) {
    var box = document.createElement('div');
    box.className = 'q-text';
    var chunks = String(str || '').replace(/\r\n/g, '\n').split(/```[a-zA-Z]*\n?/);
    chunks.forEach(function (chunk, i) {
      if (i % 2 === 1) {
        box.appendChild(text('pre', 'q-code', chunk.replace(/\n$/, '')));
        return;
      }
      chunk.split(/\n{2,}/).forEach(function (para) {
        var t = para.trim();
        if (!t) return;
        var p = document.createElement('p');
        appendInline(p, t);
        box.appendChild(p);
      });
    });
    return box;
  }

  function section(title, body) {
    var s = document.createElement('section');
    s.className = 'q-section';
    s.appendChild(text('h3', '', title));
    s.appendChild(body);
    return s;
  }

  function exampleValue(v) {
    if (v == null) return '';
    return typeof v === 'string' ? v : JSON.stringify(v);
  }

  function renderExamples(list) {
    var box = document.createElement('div');
    list.forEach(function (ex, i) {
      var card = document.createElement('div');
      card.className = 'q-example';
      card.appendChild(text('h4', '', 'Example ' + (i + 1)));
      var dl = document.createElement('dl');
      // Accept the usual keys; show anything else too, so nothing is hidden.
      var keys = ['input', 'output', 'explanation'];
      Object.keys(ex || {}).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); });
      keys.forEach(function (k) {
        if (!ex || ex[k] == null || ex[k] === '') return;
        var wrap = document.createElement('div');
        wrap.appendChild(text('dt', '', k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ')));
        wrap.appendChild(text('dd', '', exampleValue(ex[k])));
        dl.appendChild(wrap);
      });
      card.appendChild(dl);
      box.appendChild(card);
    });
    return box;
  }

  /* Shows the function the participant must implement — name, parameters
   * and return type — as a plain-language summary. The concrete syntax
   * (e.g. `vector<int>&` in C++ vs `int[]` in Java) already appears in
   * each language's starter code inside the editor, so this stays
   * language-neutral rather than repeating one language's syntax. */
  function renderFunctionSignature(coding) {
    var box = document.createElement('div');
    box.className = 'q-code';
    var params = (coding.params || []).map(function (p) {
      return p.name + ': ' + p.type;
    }).join(', ');
    var line = coding.function_name + '(' + params + ')' +
      (coding.return_type ? ' -> ' + coding.return_type : '');
    box.textContent = line;
    return box;
  }

  function renderQuestion() {
    var q = currentQuestion();
    el.problem.textContent = '';
    if (!q) { el.answer.value = ''; el.answer.disabled = true; el.solveBtn.disabled = true; return; }

    // Leaving whichever pane was showing: flush its pending save first.
    if (codeEditorFor && codeEditorFor !== q.question_id) flushCodeSave(state.byId[codeEditorFor]);
    if (sqlEditorFor && sqlEditorFor !== q.question_id) flushSqlSave(state.byId[sqlEditorFor]);

    var list = inCategory(q.category);
    var meta = document.createElement('div');
    meta.className = 'q-meta';
    meta.appendChild(text('span', 'q-number', 'Q' + (state.index + 1) + ' of ' + list.length));
    meta.appendChild(text('span', 'badge badge-' + q.difficulty, q.difficulty));
    meta.appendChild(text('span', 'q-type', q.category === 'sql' ? 'SQL' : 'Coding (DSA)'));
    if (q.is_solved) meta.appendChild(text('span', 'q-solved-flag', 'Marked solved'));
    el.problem.appendChild(meta);

    el.problem.appendChild(text('h2', 'q-title', q.title));
    el.problem.appendChild(renderRichText(q.description));

    // Coding (DSA) questions are LeetCode-style: participants implement a
    // function, never read stdin or write stdout, so the old "Input
    // format" / "Output format" sections (written for a stdin/stdout
    // program) would be actively misleading here and are skipped. SQL
    // questions keep them unchanged — a query's input tables and output
    // columns are genuinely part of the problem statement.
    if (q.category !== 'coding') {
      if (q.input_format && q.input_format.trim()) {
        el.problem.appendChild(section('Input format', renderRichText(q.input_format)));
      }
      if (q.output_format && q.output_format.trim()) {
        el.problem.appendChild(section('Output format', renderRichText(q.output_format)));
      }
    }
    if (Array.isArray(q.examples) && q.examples.length) {
      el.problem.appendChild(section('Examples', renderExamples(q.examples)));
    }
    if (q.constraints && q.constraints.trim()) {
      el.problem.appendChild(section('Constraints', text('div', 'q-constraints', q.constraints.trim())));
    }
    if (isCodingQuestion(q) && hasCodingConfig(q)) {
      el.problem.appendChild(section('Function signature', renderFunctionSignature(q.coding)));
    }
    el.problem.scrollTop = 0;

    if (isCodingQuestion(q)) {
      el.answerPane.hidden = true;
      el.codePane.hidden = false;
      el.sqlPane.hidden = true;
      editorFor = null;
      sqlEditorFor = null;
      renderCodeQuestion(q);
      return;
    }

    if (isSqlQuestion(q)) {
      el.answerPane.hidden = true;
      el.codePane.hidden = true;
      el.sqlPane.hidden = false;
      editorFor = null;
      codeEditorFor = null;
      renderSqlQuestion(q);
      return;
    }

    el.codePane.hidden = true;
    el.sqlPane.hidden = true;
    el.answerPane.hidden = false;

    // Editor: saved answer first, otherwise the starter content.
    var saved = q.answer;
    var shown = (saved != null && saved !== '') ? saved : (q.starter_content || '');
    el.answer.value = shown;
    el.answer.disabled = state.ended;
    editorFor = q.question_id;
    // Only a change from what was just shown counts as an edit. Merely looking
    // at a question (or at its starter text) must never write anything.
    if (saved == null || saved === '') lastSavedText[q.question_id] = shown;
    setSaveStatus('', '');
    updateCharCount();
    updateSolveButton();
  }

  /* ------------------------------------------------- coding (DSA) pane */

  function renderCodeQuestion(q) {
    if (!hasCodingConfig(q)) {
      // A coding question with no coding_config yet: show the workspace
      // shell (so the layout is consistent) but make clearly why there is
      // nothing to edit, instead of silently falling back to the old
      // plain-text textarea or crashing on missing fields.
      codeEditorLoading = false;
      codeEditorFor = null;
      el.codeLang.value = 'python3';
      el.monacoContainer.textContent = '';
      var notice = document.createElement('div');
      notice.className = 'tc-banner is-error';
      notice.textContent = 'This question has not been configured for the code editor yet. Please tell an organiser.';
      el.monacoContainer.appendChild(notice);
      resetTestResultView();
      el.testCasesView.textContent = '';
      el.testCasesView.appendChild(text('p', 'test-empty', 'No test cases configured for this question yet.'));
      updateSubmitControls(q);
      return;
    }

    codeEditorLoading = true;
    var lang = (q.code_draft && q.code_draft.last_lang) || CodeEditor.currentLanguage() || 'python3';
    el.codeLang.value = lang;
    resetTestResultView();
    renderTestCasesView(q);
    updateSubmitControls(q);

    CodeEditor.openQuestion(el.monacoContainer, {
      questionId: q.question_id,
      starterCode: q.coding.starter_code || {},
      savedCode: lastSavedCode[q.question_id] || {},
      language: lang,
      disabled: state.ended
    }).then(function (openedLang) {
      codeEditorLoading = false;
      // Only take effect if we're still looking at the same question
      // (fast tab-switching could otherwise apply a stale result).
      if (currentQuestion() !== q) return;
      codeEditorFor = q.question_id;
      el.codeLang.value = openedLang;
      setCodeSaveStatus('', '');
      updateSubmitControls(q);
    }).catch(function (err) {
      codeEditorLoading = false;
      CC.toast(err && err.message ? err.message : 'Could not load the code editor.', 'error');
    });
  }

  function renderTestCasesView(q) {
    el.testCasesView.textContent = '';
    var tests = (q.coding && q.coding.public_tests) || [];
    if (!tests.length) {
      el.testCasesView.appendChild(text('p', 'test-empty', 'No public test cases for this question.'));
      return;
    }
    tests.forEach(function (t, i) {
      var card = document.createElement('div');
      card.className = 'tc-card';
      var head = document.createElement('div');
      head.className = 'tc-head';
      head.appendChild(text('h4', '', 'Test Case ' + (i + 1)));
      card.appendChild(head);

      var rows = document.createElement('dl');
      rows.className = 'tc-rows';
      appendTcRow(rows, 'Input', formatTestValue(t.input));
      appendTcRow(rows, 'Expected', formatTestValue(t.expected));
      card.appendChild(rows);
      el.testCasesView.appendChild(card);
    });
  }

  function appendTcRow(dl, label, value, extraClass) {
    var row = document.createElement('div');
    row.className = 'tc-row';
    row.appendChild(text('dt', '', label));
    row.appendChild(text('dd', extraClass || '', value));
    dl.appendChild(row);
  }

  function formatTestValue(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      return Object.keys(v).map(function (k) { return k + ' = ' + JSON.stringify(v[k]); }).join('\n');
    }
    return JSON.stringify(v);
  }

  function resetTestResultView() {
    lastRunResult = null;
    el.testResultView.textContent = '';
    el.testResultView.appendChild(el.testResultEmpty);
    el.testResultEmpty.hidden = false;
    el.testResultEmpty.textContent = 'Run your code to see results here.';
  }

  function selectTestTab(name) {
    var onCases = name === 'cases';
    el.testTabCases.setAttribute('aria-selected', onCases ? 'true' : 'false');
    el.testTabResult.setAttribute('aria-selected', onCases ? 'false' : 'true');
    el.testCasesView.hidden = !onCases;
    el.testResultView.hidden = onCases;
  }

  function setCodeSaveStatus(kind, message) {
    el.codeSaveStatus.textContent = message;
    el.codeSaveStatus.className = 'save-status' + (kind ? ' is-' + kind : '');
  }

  /* Enabled once a coding question's editor has finished loading, and
   * disabled while the attempt has ended or a Run/Submit call is in flight. */
  var codeActionBusy = false;

  function updateSubmitControls(q) {
    var busy = codeEditorLoading || codeActionBusy;
    var configured = hasCodingConfig(q);
    el.runBtn.disabled = state.ended || busy || !configured;
    el.submitBtn.disabled = state.ended || busy || !configured;
  }

  function runCode() {
    var q = currentQuestion();
    if (!isCodingQuestion(q) || !hasCodingConfig(q) || state.ended || codeEditorLoading || codeActionBusy) return;
    var code = CodeEditor.getCode();
    var lang = CodeEditor.currentLanguage();
    if (!code.trim()) { CC.toast('Write some code before running it.', 'warning'); return; }
    if (code.length > MAX_ANSWER) { CC.toast('Your code is too long to run. Keep it under ' + MAX_ANSWER.toLocaleString() + ' characters.', 'error'); return; }

    // Make sure the latest code is saved before judging it, so a refresh
    // during a slow Judge0 run can never lose what was just tested.
    flushCodeSave(q);

    codeActionBusy = true;
    updateSubmitControls(q);
    el.runBtn.textContent = 'Running…';
    selectTestTab('result');
    showRunningState('Running your code against the public tests…');

    CC.callFunction('execute-code', {
      attempt_id: state.session.attempt_id,
      token: state.session.token,
      question_id: q.question_id,
      language: lang,
      code: code
    }).then(function (res) {
      if (currentQuestion() !== q) return; // navigated away while it was running
      renderRunResult(res);
    }).catch(function (err) {
      if (err.code === 'expired' || err.code === 'attempt_closed') { onZero(); return; }
      if (currentQuestion() === q) renderJudgeError(err);
    }).then(function () {
      codeActionBusy = false;
      el.runBtn.textContent = 'Run Code';
      updateSubmitControls(currentQuestion());
    });
  }

  function submitCode() {
    var q = currentQuestion();
    if (!isCodingQuestion(q) || !hasCodingConfig(q) || state.ended || codeEditorLoading || codeActionBusy) return;
    var code = CodeEditor.getCode();
    var lang = CodeEditor.currentLanguage();
    if (!code.trim()) { CC.toast('Write some code before submitting.', 'warning'); return; }
    if (code.length > MAX_ANSWER) { CC.toast('Your code is too long to submit. Keep it under ' + MAX_ANSWER.toLocaleString() + ' characters.', 'error'); return; }

    flushCodeSave(q);

    codeActionBusy = true;
    updateSubmitControls(q);
    el.submitBtn.textContent = 'Submitting…';
    selectTestTab('result');
    showRunningState('Running your code against all test cases…');

    CC.callFunction('submit-code', {
      attempt_id: state.session.attempt_id,
      token: state.session.token,
      question_id: q.question_id,
      language: lang,
      code: code
    }).then(function (res) {
      if (currentQuestion() !== q) return;
      renderSubmitResult(q, res);
    }).catch(function (err) {
      if (err.code === 'expired' || err.code === 'attempt_closed') { onZero(); return; }
      if (currentQuestion() === q) renderJudgeError(err);
    }).then(function () {
      codeActionBusy = false;
      el.submitBtn.textContent = 'Submit';
      updateSubmitControls(currentQuestion());
    });
  }

  /* ------------------------------------------------- test result panel */

  function showRunningState(message) {
    el.testResultView.textContent = '';
    var banner = document.createElement('div');
    banner.className = 'tc-banner is-running';
    banner.textContent = message;
    el.testResultView.appendChild(banner);
  }

  function renderJudgeError(err) {
    el.testResultView.textContent = '';
    var banner = document.createElement('div');
    banner.className = 'tc-banner is-error';
    banner.textContent = CC.errorMessage(err);
    el.testResultView.appendChild(banner);
    CC.toast(CC.errorMessage(err), 'error');
  }

  var STATUS_LABEL = {
    accepted: 'Accepted',
    wrong_answer: 'Wrong Answer',
    compile_error: 'Compilation Error',
    runtime_error: 'Runtime Error',
    time_limit: 'Time Limit Exceeded',
    memory_limit: 'Memory Limit Exceeded',
    internal_error: 'Could Not Run'
  };

  function renderRunResult(res) {
    lastRunResult = res;
    el.testResultView.textContent = '';

    var banner = document.createElement('div');
    var bannerClass = res.status === 'accepted' ? 'is-accepted' : (res.status === 'wrong_answer' ? 'is-wrong' : 'is-error');
    banner.className = 'tc-banner ' + bannerClass;
    banner.textContent = (STATUS_LABEL[res.status] || res.status) + ' — ' + res.passed_tests + ' / ' + res.total_tests + ' public test cases passed';
    el.testResultView.appendChild(banner);

    if (res.error_message && (res.status === 'compile_error' || res.status === 'runtime_error' || res.status === 'time_limit' || res.status === 'memory_limit' || res.status === 'internal_error')) {
      el.testResultView.appendChild(text('div', 'tc-error-block', res.error_message));
    }

    (res.tests || []).forEach(function (t, i) {
      el.testResultView.appendChild(renderResultCard('Test Case ' + (i + 1), t, false));
    });

    if (typeof res.execution_ms === 'number') {
      el.testResultView.appendChild(text('p', 'tc-exec', 'Execution time: ' + res.execution_ms + ' ms'));
    }
  }

  function renderSubmitResult(q, res) {
    lastRunResult = res;
    el.testResultView.textContent = '';

    var banner = document.createElement('div');
    var bannerClass = res.status === 'accepted' ? 'is-accepted' : (res.status === 'wrong_answer' ? 'is-wrong' : 'is-error');
    banner.className = 'tc-banner ' + bannerClass;
    var headline = res.status === 'accepted' ? 'Accepted' : (STATUS_LABEL[res.status] || res.status);
    banner.textContent = headline + ' — ' + res.passed_tests + ' / ' + res.total_tests + ' test cases passed';
    el.testResultView.appendChild(banner);

    if (res.error_message && res.status !== 'accepted' && res.status !== 'wrong_answer') {
      el.testResultView.appendChild(text('div', 'tc-error-block', res.error_message));
    } else if (res.error_message === 'Hidden test case failed.') {
      el.testResultView.appendChild(text('div', 'tc-error-block', res.error_message));
    }

    (res.tests || []).forEach(function (t, i) {
      var label = t.hidden ? ('Hidden Test Case ' + (i + 1 - (res.public_tests_total || 0))) : ('Test Case ' + (i + 1));
      el.testResultView.appendChild(renderResultCard(label, t, !!t.hidden));
    });

    if (typeof res.execution_ms === 'number') {
      el.testResultView.appendChild(text('p', 'tc-exec', 'Execution time: ' + res.execution_ms + ' ms'));
    }

    // Apply the server-decided score/solved state exactly like the SQL
    // "Mark as Solved" flow does — never computed on the client.
    q.is_solved = res.is_solved;
    if (res.summary) state.summary = res.summary;
    renderCounts();
    renderNav();
    // Refresh the meta line ("Marked solved") without losing the test result panel.
    refreshSolvedFlag(q);

    if (res.newly_solved) {
      CC.toast('Accepted!', 'success', 3000);
    } else if (res.status === 'accepted' && res.is_solved) {
      CC.toast('Accepted. This question is already solved.', 'info', 3000);
    } else {
      CC.toast(headline, res.status === 'accepted' ? 'success' : 'error', 2500);
    }
  }

  /* Updates just the "Marked solved" badge above the problem statement,
   * without re-rendering the whole question (which
   * would wipe out the test result the participant is looking at). */
  function refreshSolvedFlag(q) {
    var existing = el.problem.querySelector('.q-solved-flag');
    if (q.is_solved && !existing) {
      el.problem.querySelector('.q-meta').appendChild(text('span', 'q-solved-flag', 'Marked solved'));
    } else if (!q.is_solved && existing) {
      existing.remove();
    }
  }

  function renderResultCard(title, t, isHidden) {
    var card = document.createElement('div');
    card.className = 'tc-card';

    var head = document.createElement('div');
    head.className = 'tc-head';
    head.appendChild(text('h4', '', title));
    var passed = t.verdict === 'passed';
    head.appendChild(text('span', 'tc-icon ' + (passed ? 'is-pass' : 'is-fail'), passed ? '✓' : '✗'));
    var verdict = document.createElement('span');
    verdict.className = 'tc-verdict ' + (passed ? 'is-pass' : 'is-fail');
    verdict.textContent = passed ? 'Passed' : 'Failed';
    head.appendChild(verdict);
    card.appendChild(head);

    if (isHidden) {
      card.appendChild(text('p', 'test-empty', passed ? 'Hidden test passed.' : 'Hidden test failed. Input and expected output are not shown.'));
      return card;
    }

    var rows = document.createElement('dl');
    rows.className = 'tc-rows';
    if (t.input != null) appendTcRow(rows, 'Input', formatTestValue(t.input));
    if (t.expected !== undefined) appendTcRow(rows, 'Expected', formatTestValue(t.expected));
    if (t.error) {
      appendTcRow(rows, 'Error', t.error, 'is-fail-text');
    } else if (t.actual !== undefined) {
      appendTcRow(rows, 'Output', formatTestValue(t.actual), passed ? 'is-pass-text' : 'is-fail-text');
    }
    card.appendChild(rows);
    return card;
  }

  /* ---------------------------------------------------- code autosave */

  function enqueueCode(questionId, code, language) {
    var prev = codeSaveChain[questionId] || Promise.resolve();
    var next = prev.catch(function () {}).then(function () {
      if (state.ended) return null;
      return CC.callFunction('save-code', {
        attempt_id: state.session.attempt_id,
        token: state.session.token,
        question_id: questionId,
        language: language,
        code: code
      });
    });
    codeSaveChain[questionId] = next;
    return next;
  }

  function scheduleCodeSave(questionId, language, code) {
    if (state.ended) return;
    if (code.length > MAX_ANSWER) {
      setCodeSaveStatus('error', 'Too long to save (max ' + MAX_ANSWER.toLocaleString() + ' characters)');
      return;
    }
    setCodeSaveStatus('', 'Unsaved changes');
    var key = questionId + ':' + language;
    clearTimeout(codeSaveTimers[key]);
    codeSaveTimers[key] = setTimeout(function () { saveCode(questionId, language, code); }, AUTOSAVE_DELAY_MS);
  }

  function saveCode(questionId, language, code) {
    var key = questionId + ':' + language;
    clearTimeout(codeSaveTimers[key]);
    delete codeSaveTimers[key];
    if (state.ended) return Promise.resolve();

    var prevSaved = (lastSavedCode[questionId] || {})[language];
    if (code === prevSaved) {
      if (currentQuestion() && currentQuestion().question_id === questionId) setCodeSaveStatus('', '');
      return Promise.resolve();
    }
    if (code.length > MAX_ANSWER) return Promise.resolve();

    var showing = currentQuestion() && currentQuestion().question_id === questionId;
    if (showing) setCodeSaveStatus('', 'Saving…');

    return enqueueCode(questionId, code, language).then(function (res) {
      if (!res) return;
      lastSavedCode[questionId] = lastSavedCode[questionId] || {};
      lastSavedCode[questionId][language] = code;
      codeSaveRetryCount[key] = 0;
      if (showing && CodeEditor.currentLanguage() === language) setCodeSaveStatus('saved', 'Saved');
    }).catch(function (err) { handleCodeSaveError(err, questionId, language, code); });
  }

  function flushCodeSave(q) {
    if (!q || state.ended) return;
    var code = CodeEditor.getCode();
    var lang = CodeEditor.currentLanguage();
    var key = q.question_id + ':' + lang;
    if (codeSaveTimers[key]) saveCode(q.question_id, lang, code);
  }

  function handleCodeSaveError(err, questionId, language, code) {
    if (err.code === 'expired' || err.code === 'attempt_closed') {
      if (!state.ended) onZero();
      return;
    }
    var showing = currentQuestion() && currentQuestion().question_id === questionId;
    if (showing) setCodeSaveStatus('error', 'Not saved – will retry');
    if (err.code === 'answer_too_long') { CC.toast(CC.errorMessage(err), 'error'); return; }

    // Same capped, backing-off retry as the SQL/text answer path — never
    // an unbounded loop of requests against a down or misconfigured server.
    var key = questionId + ':' + language;
    var attempt = (codeSaveRetryCount[key] || 0) + 1;
    codeSaveRetryCount[key] = attempt;
    if (attempt > MAX_SAVE_RETRIES) {
      if (showing) setCodeSaveStatus('error', 'Not saved. Check your connection, then edit again to retry.');
      CC.toast('Could not save your code after several attempts. ' + CC.errorMessage(err), 'error', 6000);
      return;
    }
    var delayMs = Math.min(4000 * Math.pow(2, attempt - 1), 30000);
    setTimeout(function () { if (!state.ended) saveCode(questionId, language, code); }, delayMs);
  }

  /* --------------------------------------------------------- SQL pane */
  /* Parallel to the coding (DSA) pane above, for SQL questions. Kept as
   * its own self-contained block using SqlEditor (a separate Monaco
   * instance from CodeEditor) so nothing here can affect the coding path. */

  function renderSqlQuestion(q) {
    if (!hasSqlConfig(q)) {
      sqlEditorLoading = false;
      sqlEditorFor = null;
      el.sqlLang.value = 'postgresql';
      el.sqlMonacoContainer.textContent = '';
      var notice = document.createElement('div');
      notice.className = 'tc-banner is-error';
      notice.textContent = 'This question has not been configured for the SQL editor yet. Please tell an organiser.';
      el.sqlMonacoContainer.appendChild(notice);
      resetSqlResultView();
      el.sqlTestCasesView.textContent = '';
      el.sqlTestCasesView.appendChild(text('p', 'test-empty', 'No test cases configured for this question yet.'));
      updateSqlSubmitControls(q);
      return;
    }

    sqlEditorLoading = true;
    var dialect = (q.sql_draft && q.sql_draft.last_lang) || SqlEditor.currentDialect() || 'postgresql';
    el.sqlLang.value = dialect;
    resetSqlResultView();
    renderSqlTestCasesView(q);
    updateSqlSubmitControls(q);

    SqlEditor.openQuestion(el.sqlMonacoContainer, {
      questionId: q.question_id,
      starterQuery: q.starter_content || '',
      savedQuery: lastSavedSql[q.question_id] || {},
      dialect: dialect,
      disabled: state.ended
    }).then(function (openedDialect) {
      sqlEditorLoading = false;
      if (currentQuestion() !== q) return;
      sqlEditorFor = q.question_id;
      el.sqlLang.value = openedDialect;
      setSqlSaveStatus('', '');
      updateSqlSubmitControls(q);
    }).catch(function (err) {
      sqlEditorLoading = false;
      CC.toast(err && err.message ? err.message : 'Could not load the SQL editor.', 'error');
    });
  }

  function renderSqlTestCasesView(q) {
    el.sqlTestCasesView.textContent = '';
    var tests = (q.sql && q.sql.public_tests) || [];
    if (!tests.length) {
      el.sqlTestCasesView.appendChild(text('p', 'test-empty', 'No public test cases for this question.'));
      return;
    }
    tests.forEach(function (t, i) {
      var card = document.createElement('div');
      card.className = 'tc-card';
      var head = document.createElement('div');
      head.className = 'tc-head';
      head.appendChild(text('h4', '', 'Test Case ' + (i + 1)));
      card.appendChild(head);

      var rows = document.createElement('dl');
      rows.className = 'tc-rows';
      appendTcRow(rows, 'Expected', formatSqlRows(t.expected));
      card.appendChild(rows);
      el.sqlTestCasesView.appendChild(card);
    });
  }

  /* Renders an array of row objects (from deno-postgres's row-of-objects
   * shape) as a simple text table — one line per row, columns in the
   * order the server returned them, comma-separated. Good enough for the
   * small result sets these questions return; not meant to be a full
   * grid widget. */
  function formatSqlRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return '(no rows)';
    var cols = Object.keys(rows[0]);
    var header = cols.join(' | ');
    var lines = rows.map(function (r) {
      return cols.map(function (c) { return formatSqlValue(r[c]); }).join(' | ');
    });
    return header + '\n' + lines.join('\n');
  }

  function formatSqlValue(v) {
    if (v === null || v === undefined) return 'NULL';
    return String(v);
  }

  function resetSqlResultView() {
    lastSqlRunResult = null;
    el.sqlTestResultView.textContent = '';
    el.sqlTestResultView.appendChild(el.sqlTestResultEmpty);
    el.sqlTestResultEmpty.hidden = false;
    el.sqlTestResultEmpty.textContent = 'Run your query to see results here.';
  }

  function selectSqlTestTab(name) {
    var onCases = name === 'cases';
    el.sqlTestTabCases.setAttribute('aria-selected', onCases ? 'true' : 'false');
    el.sqlTestTabResult.setAttribute('aria-selected', onCases ? 'false' : 'true');
    el.sqlTestCasesView.hidden = !onCases;
    el.sqlTestResultView.hidden = onCases;
  }

  function setSqlSaveStatus(kind, message) {
    el.sqlSaveStatus.textContent = message;
    el.sqlSaveStatus.className = 'save-status' + (kind ? ' is-' + kind : '');
  }

  function updateSqlSubmitControls(q) {
    var busy = sqlEditorLoading || sqlActionBusy;
    var configured = hasSqlConfig(q);
    el.sqlRunBtn.disabled = state.ended || busy || !configured;
    el.sqlSubmitBtn.disabled = state.ended || busy || !configured;
  }

  function runSql() {
    var q = currentQuestion();
    if (!isSqlQuestion(q) || !hasSqlConfig(q) || state.ended || sqlEditorLoading || sqlActionBusy) return;
    var query = SqlEditor.getQuery();
    var dialect = SqlEditor.currentDialect();
    if (!query.trim()) { CC.toast('Write a query before running it.', 'warning'); return; }
    if (query.length > MAX_ANSWER) { CC.toast('Your query is too long to run. Keep it under ' + MAX_ANSWER.toLocaleString() + ' characters.', 'error'); return; }

    flushSqlSave(q);

    sqlActionBusy = true;
    updateSqlSubmitControls(q);
    el.sqlRunBtn.textContent = 'Running…';
    selectSqlTestTab('result');
    showSqlRunningState('Running your query against the public tests…');

    CC.callFunction('execute-sql', {
      attempt_id: state.session.attempt_id,
      token: state.session.token,
      question_id: q.question_id,
      dialect: dialect,
      query: query
    }).then(function (res) {
      if (currentQuestion() !== q) return;
      renderSqlRunResult(res);
    }).catch(function (err) {
      if (err.code === 'expired' || err.code === 'attempt_closed') { onZero(); return; }
      if (currentQuestion() === q) renderSqlJudgeError(err);
    }).then(function () {
      sqlActionBusy = false;
      el.sqlRunBtn.textContent = 'Run Code';
      updateSqlSubmitControls(currentQuestion());
    });
  }

  function submitSql() {
    var q = currentQuestion();
    if (!isSqlQuestion(q) || !hasSqlConfig(q) || state.ended || sqlEditorLoading || sqlActionBusy) return;
    var query = SqlEditor.getQuery();
    var dialect = SqlEditor.currentDialect();
    if (!query.trim()) { CC.toast('Write a query before submitting.', 'warning'); return; }
    if (query.length > MAX_ANSWER) { CC.toast('Your query is too long to submit. Keep it under ' + MAX_ANSWER.toLocaleString() + ' characters.', 'error'); return; }

    flushSqlSave(q);

    sqlActionBusy = true;
    updateSqlSubmitControls(q);
    el.sqlSubmitBtn.textContent = 'Submitting…';
    selectSqlTestTab('result');
    showSqlRunningState('Running your query against all test cases…');

    CC.callFunction('submit-sql', {
      attempt_id: state.session.attempt_id,
      token: state.session.token,
      question_id: q.question_id,
      dialect: dialect,
      query: query
    }).then(function (res) {
      if (currentQuestion() !== q) return;
      renderSqlSubmitResult(q, res);
    }).catch(function (err) {
      if (err.code === 'expired' || err.code === 'attempt_closed') { onZero(); return; }
      if (currentQuestion() === q) renderSqlJudgeError(err);
    }).then(function () {
      sqlActionBusy = false;
      el.sqlSubmitBtn.textContent = 'Submit';
      updateSqlSubmitControls(currentQuestion());
    });
  }

  /* --------------------------------------------------- SQL result panel */

  function showSqlRunningState(message) {
    el.sqlTestResultView.textContent = '';
    var banner = document.createElement('div');
    banner.className = 'tc-banner is-running';
    banner.textContent = message;
    el.sqlTestResultView.appendChild(banner);
  }

  function renderSqlJudgeError(err) {
    el.sqlTestResultView.textContent = '';
    var banner = document.createElement('div');
    banner.className = 'tc-banner is-error';
    banner.textContent = CC.errorMessage(err);
    el.sqlTestResultView.appendChild(banner);
    CC.toast(CC.errorMessage(err), 'error');
  }

  var SQL_STATUS_LABEL = {
    accepted: 'Accepted',
    wrong_answer: 'Wrong Answer',
    syntax_error: 'Syntax Error',
    runtime_error: 'Runtime Error',
    time_limit: 'Time Limit Exceeded',
    row_limit: 'Too Many Rows',
    dialect_rejected: 'Statement Not Allowed',
    internal_error: 'Could Not Run'
  };

  function renderSqlRunResult(res) {
    lastSqlRunResult = res;
    el.sqlTestResultView.textContent = '';

    var banner = document.createElement('div');
    var bannerClass = res.status === 'accepted' ? 'is-accepted' : (res.status === 'wrong_answer' ? 'is-wrong' : 'is-error');
    banner.className = 'tc-banner ' + bannerClass;
    banner.textContent = (SQL_STATUS_LABEL[res.status] || res.status) + ' — ' + res.passed_tests + ' / ' + res.total_tests + ' public test cases passed';
    el.sqlTestResultView.appendChild(banner);

    if (res.error_message && res.status !== 'accepted' && res.status !== 'wrong_answer') {
      el.sqlTestResultView.appendChild(text('div', 'tc-error-block', res.error_message));
    }

    (res.tests || []).forEach(function (t, i) {
      el.sqlTestResultView.appendChild(renderSqlResultCard('Test Case ' + (i + 1), t, false));
    });

    if (typeof res.execution_ms === 'number') {
      el.sqlTestResultView.appendChild(text('p', 'tc-exec', 'Execution time: ' + res.execution_ms + ' ms'));
    }
  }

  function renderSqlSubmitResult(q, res) {
    lastSqlRunResult = res;
    el.sqlTestResultView.textContent = '';

    var banner = document.createElement('div');
    var bannerClass = res.status === 'accepted' ? 'is-accepted' : (res.status === 'wrong_answer' ? 'is-wrong' : 'is-error');
    banner.className = 'tc-banner ' + bannerClass;
    var headline = res.status === 'accepted' ? 'Accepted' : (SQL_STATUS_LABEL[res.status] || res.status);
    banner.textContent = headline + ' — ' + res.passed_tests + ' / ' + res.total_tests + ' test cases passed';
    el.sqlTestResultView.appendChild(banner);

    if (res.error_message && res.status !== 'accepted' && res.status !== 'wrong_answer') {
      el.sqlTestResultView.appendChild(text('div', 'tc-error-block', res.error_message));
    } else if (res.error_message === 'Hidden test case failed.') {
      el.sqlTestResultView.appendChild(text('div', 'tc-error-block', res.error_message));
    }

    (res.tests || []).forEach(function (t, i) {
      var label = t.hidden ? ('Hidden Test Case ' + (i + 1 - (res.public_tests_total || 0))) : ('Test Case ' + (i + 1));
      el.sqlTestResultView.appendChild(renderSqlResultCard(label, t, !!t.hidden));
    });

    if (typeof res.execution_ms === 'number') {
      el.sqlTestResultView.appendChild(text('p', 'tc-exec', 'Execution time: ' + res.execution_ms + ' ms'));
    }

    // Apply the server-decided score/solved state exactly like the
    // coding Submit flow does — never computed on the client.
    q.is_solved = res.is_solved;
    if (res.summary) state.summary = res.summary;
    renderCounts();
    renderNav();
    refreshSolvedFlag(q);

    if (res.newly_solved) {
      CC.toast('Accepted!', 'success', 3000);
    } else if (res.status === 'accepted' && res.is_solved) {
      CC.toast('Accepted. This question is already solved.', 'info', 3000);
    } else {
      CC.toast(headline, res.status === 'accepted' ? 'success' : 'error', 2500);
    }
  }

  function renderSqlResultCard(title, t, isHidden) {
    var card = document.createElement('div');
    card.className = 'tc-card';

    var head = document.createElement('div');
    head.className = 'tc-head';
    head.appendChild(text('h4', '', title));
    var passed = t.verdict === 'passed';
    head.appendChild(text('span', 'tc-icon ' + (passed ? 'is-pass' : 'is-fail'), passed ? '✓' : '✗'));
    var verdict = document.createElement('span');
    verdict.className = 'tc-verdict ' + (passed ? 'is-pass' : 'is-fail');
    verdict.textContent = passed ? 'Passed' : 'Failed';
    head.appendChild(verdict);
    card.appendChild(head);

    if (isHidden) {
      card.appendChild(text('p', 'test-empty', passed ? 'Hidden test passed.' : 'Hidden test failed. Expected output and your result are not shown.'));
      return card;
    }

    var rows = document.createElement('dl');
    rows.className = 'tc-rows';
    if (t.expected !== undefined) appendTcRow(rows, 'Expected', formatSqlRows(t.expected));
    if (t.error) {
      appendTcRow(rows, 'Error', t.error, 'is-fail-text');
    } else if (t.actual !== undefined) {
      appendTcRow(rows, 'Your output', formatSqlRows(t.actual), passed ? 'is-pass-text' : 'is-fail-text');
    }
    card.appendChild(rows);
    return card;
  }

  /* ----------------------------------------------------------- SQL autosave */

  function enqueueSql(questionId, query, dialect) {
    var prev = sqlSaveChain[questionId] || Promise.resolve();
    var next = prev.catch(function () {}).then(function () {
      if (state.ended) return null;
      return CC.callFunction('save-sql', {
        attempt_id: state.session.attempt_id,
        token: state.session.token,
        question_id: questionId,
        dialect: dialect,
        query: query
      });
    });
    sqlSaveChain[questionId] = next;
    return next;
  }

  function scheduleSqlSave(questionId, dialect, query) {
    if (state.ended) return;
    if (query.length > MAX_ANSWER) {
      setSqlSaveStatus('error', 'Too long to save (max ' + MAX_ANSWER.toLocaleString() + ' characters)');
      return;
    }
    setSqlSaveStatus('', 'Unsaved changes');
    var key = questionId + ':' + dialect;
    clearTimeout(sqlSaveTimers[key]);
    sqlSaveTimers[key] = setTimeout(function () { saveSql(questionId, dialect, query); }, AUTOSAVE_DELAY_MS);
  }

  function saveSql(questionId, dialect, query) {
    var key = questionId + ':' + dialect;
    clearTimeout(sqlSaveTimers[key]);
    delete sqlSaveTimers[key];
    if (state.ended) return Promise.resolve();

    var prevSaved = (lastSavedSql[questionId] || {})[dialect];
    if (query === prevSaved) {
      if (currentQuestion() && currentQuestion().question_id === questionId) setSqlSaveStatus('', '');
      return Promise.resolve();
    }
    if (query.length > MAX_ANSWER) return Promise.resolve();

    var showing = currentQuestion() && currentQuestion().question_id === questionId;
    if (showing) setSqlSaveStatus('', 'Saving…');

    return enqueueSql(questionId, query, dialect).then(function (res) {
      if (!res) return;
      lastSavedSql[questionId] = lastSavedSql[questionId] || {};
      lastSavedSql[questionId][dialect] = query;
      sqlSaveRetryCount[key] = 0;
      if (showing && SqlEditor.currentDialect() === dialect) setSqlSaveStatus('saved', 'Saved');
    }).catch(function (err) { handleSqlSaveError(err, questionId, dialect, query); });
  }

  function flushSqlSave(q) {
    if (!q || state.ended) return;
    var query = SqlEditor.getQuery();
    var dialect = SqlEditor.currentDialect();
    var key = q.question_id + ':' + dialect;
    if (sqlSaveTimers[key]) saveSql(q.question_id, dialect, query);
  }

  function handleSqlSaveError(err, questionId, dialect, query) {
    if (err.code === 'expired' || err.code === 'attempt_closed') {
      if (!state.ended) onZero();
      return;
    }
    var showing = currentQuestion() && currentQuestion().question_id === questionId;
    if (showing) setSqlSaveStatus('error', 'Not saved – will retry');
    if (err.code === 'answer_too_long') { CC.toast(CC.errorMessage(err), 'error'); return; }

    var key = questionId + ':' + dialect;
    var attempt = (sqlSaveRetryCount[key] || 0) + 1;
    sqlSaveRetryCount[key] = attempt;
    if (attempt > MAX_SAVE_RETRIES) {
      if (showing) setSqlSaveStatus('error', 'Not saved. Check your connection, then edit again to retry.');
      CC.toast('Could not save your query after several attempts. ' + CC.errorMessage(err), 'error', 6000);
      return;
    }
    var delayMs = Math.min(4000 * Math.pow(2, attempt - 1), 30000);
    setTimeout(function () { if (!state.ended) saveSql(questionId, dialect, query); }, delayMs);
  }

  function updateSolveButton() {
    var q = currentQuestion();
    if (!q) return;
    el.solveBtn.disabled = state.ended || !!el.solveBtn.getAttribute('data-busy');
    el.solveBtn.textContent = q.is_solved ? 'Unmark as Solved' : 'Mark as Solved';
    el.solveBtn.classList.toggle('btn-primary', !q.is_solved);
    el.solveBtn.classList.toggle('btn-solved', q.is_solved);
  }

  function updateCharCount() {
    var n = el.answer.value.length;
    el.charCount.textContent = n.toLocaleString() + ' / ' + MAX_ANSWER.toLocaleString();
    el.charCount.classList.toggle('is-near', n > MAX_ANSWER * 0.9 && n <= MAX_ANSWER);
    el.charCount.classList.toggle('is-over', n > MAX_ANSWER);
  }

  function setSaveStatus(kind, message) {
    el.saveStatus.textContent = message;
    el.saveStatus.className = 'save-status' + (kind ? ' is-' + kind : '');
  }

  /* ------------------------------------------------------------- saving */

  /* Sends one request per question at a time, in order, so a slow earlier
   * save can never land after (and overwrite) a newer one. */
  function enqueue(questionId, payload) {
    var prev = saveChain[questionId] || Promise.resolve();
    var next = prev.catch(function () {}).then(function () {
      if (state.ended && !payload.__final) return null;
      var body = {
        attempt_id: state.session.attempt_id,
        token: state.session.token,
        question_id: questionId
      };
      if (payload.answer !== undefined) body.answer = payload.answer;
      if (payload.is_solved !== undefined) body.is_solved = payload.is_solved;
      return CC.callFunction('submit-answer', body, payload.keepalive ? { keepalive: true } : undefined);
    });
    saveChain[questionId] = next;
    return next;
  }

  function scheduleSave() {
    var q = currentQuestion();
    if (!q || state.ended) return;
    if (el.answer.value.length > MAX_ANSWER) {
      setSaveStatus('error', 'Too long to save (max ' + MAX_ANSWER.toLocaleString() + ' characters)');
      return;
    }
    setSaveStatus('', 'Unsaved changes');
    clearTimeout(saveTimers[q.question_id]);
    saveTimers[q.question_id] = setTimeout(function () { saveAnswer(q); }, AUTOSAVE_DELAY_MS);
  }

  function saveAnswer(q) {
    clearTimeout(saveTimers[q.question_id]);
    delete saveTimers[q.question_id];
    if (state.ended) return Promise.resolve();

    // Read the editor only while it still shows this question; otherwise fall
    // back to the text we last held for it.
    var value = (editorFor === q.question_id) ? el.answer.value : (q.answer != null ? q.answer : '');
    if (value === lastSavedText[q.question_id]) {
      if (q === currentQuestion()) setSaveStatus('', '');
      return Promise.resolve();
    }
    if (value.length > MAX_ANSWER) return Promise.resolve();

    q.answer = value;
    if (q === currentQuestion()) setSaveStatus('', 'Saving…');

    return enqueue(q.question_id, { answer: value }).then(function (res) {
      if (!res) return;
      lastSavedText[q.question_id] = value;
      saveRetryCount[q.question_id] = 0;
      if (res.summary) state.summary = res.summary;
      if (q === currentQuestion() && el.answer.value === value) setSaveStatus('saved', 'Saved');
    }).catch(function (err) { handleSaveError(err, q); });
  }

  /* Save the text of a question we are about to leave. */
  function flushSave(q) {
    if (!q || state.ended || el.answer.disabled) return;
    if (editorFor !== q.question_id) return;            // editor is not showing this question
    if (el.answer.value !== lastSavedText[q.question_id]) saveAnswer(q);
  }

  var MAX_SAVE_RETRIES = 5;

  function handleSaveError(err, q) {
    if (err.code === 'expired' || err.code === 'attempt_closed') {
      if (!state.ended) onZero();
      return;
    }
    if (q === currentQuestion()) setSaveStatus('error', 'Not saved – will retry');
    if (err.code === 'answer_too_long') { CC.toast(CC.errorMessage(err), 'error'); return; }

    // Capped, backing-off retry: never an unbounded loop of requests.
    // Each failure roughly doubles the wait (4s, 8s, 16s, ...) up to a cap,
    // and after MAX_SAVE_RETRIES straight failures we stop entirely and
    // tell the person plainly, instead of hammering the server forever.
    var attempt = (saveRetryCount[q.question_id] || 0) + 1;
    saveRetryCount[q.question_id] = attempt;
    if (attempt > MAX_SAVE_RETRIES) {
      if (q === currentQuestion()) setSaveStatus('error', 'Not saved. Check your connection, then edit again to retry.');
      CC.toast('Could not save your answer after several attempts. ' + CC.errorMessage(err), 'error', 6000);
      return;
    }
    var delayMs = Math.min(4000 * Math.pow(2, attempt - 1), 30000);
    setTimeout(function () { if (!state.ended) saveAnswer(q); }, delayMs);
  }

  function toggleSolved() {
    var q = currentQuestion();
    if (!q || state.ended || el.solveBtn.getAttribute('data-busy')) return;

    var next = !q.is_solved;
    var text = el.answer.value;
    if (text.length > MAX_ANSWER) {
      CC.toast('Your answer is too long. Shorten it to ' + MAX_ANSWER.toLocaleString() + ' characters or fewer.', 'error');
      return;
    }

    clearTimeout(saveTimers[q.question_id]);
    delete saveTimers[q.question_id];

    el.solveBtn.setAttribute('data-busy', '1');
    el.solveBtn.disabled = true;
    setSaveStatus('', 'Saving…');

    // Send the text together with the solved flag in a single request.
    enqueue(q.question_id, { answer: text, is_solved: next }).then(function (res) {
      if (!res) return;
      q.answer = text;
      lastSavedText[q.question_id] = text;
      q.is_solved = res.is_solved;
      if (res.summary) state.summary = res.summary;
      setSaveStatus('saved', 'Saved');
      renderCounts();
      renderNav();
      renderQuestion();
      CC.toast(res.is_solved ? 'Marked as solved' : 'Solved mark removed', res.is_solved ? 'success' : 'info', 2500);
    }).catch(function (err) {
      if (err.code === 'expired' || err.code === 'attempt_closed') { onZero(); return; }
      setSaveStatus('error', 'Not saved');
      CC.toast(CC.errorMessage(err), 'error');
    }).then(function () {
      el.solveBtn.removeAttribute('data-busy');
      updateSolveButton();
    });
  }

  /* ---------------------------------------------------- finishing / result */

  /* Temporary: the countdown hit zero but the server has not confirmed yet.
   * Editing is blocked, but nothing is final and this can be undone. */
  function holdInputs() {
    el.answer.disabled = true;
    el.solveBtn.disabled = true;
    el.finishBtn.disabled = true;
    el.runBtn.disabled = true;
    el.submitBtn.disabled = true;
    el.sqlRunBtn.disabled = true;
    el.sqlSubmitBtn.disabled = true;
    CodeEditor.setDisabled(true);
    SqlEditor.setDisabled(true);
    el.app.classList.add('is-locked');
    Object.keys(saveTimers).forEach(function (id) { clearTimeout(saveTimers[id]); });
    saveTimers = {};
    Object.keys(codeSaveTimers).forEach(function (id) { clearTimeout(codeSaveTimers[id]); });
    codeSaveTimers = {};
    Object.keys(sqlSaveTimers).forEach(function (id) { clearTimeout(sqlSaveTimers[id]); });
    sqlSaveTimers = {};
  }

  function unlockInputs() {
    el.answer.disabled = false;
    el.finishBtn.disabled = false;
    CodeEditor.setDisabled(false);
    SqlEditor.setDisabled(false);
    el.app.classList.remove('is-locked');
    updateSolveButton();
    updateSubmitControls(currentQuestion());
    updateSqlSubmitControls(currentQuestion());
  }

  /* Final: the server has said the attempt is over. */
  function lockInputs() {
    state.ended = true;         // stop all further edits and saves from the page
    holdInputs();
  }

  function showOverlay(msg, actionText, actionHandler) {
    el.overlayMsg.textContent = msg;
    if (actionText && actionHandler) {
      el.overlayAction.textContent = actionText;
      el.overlayAction.hidden = false;
      el.overlayAction.onclick = actionHandler;
    } else {
      el.overlayAction.hidden = true;
      el.overlayAction.onclick = null;
    }
    if (el.overlaySubmit) {
      el.overlaySubmit.hidden = true;
      el.overlaySubmit.onclick = null;
    }
    el.overlay.hidden = false;
  }

  function showSecurityChoice(message) {
    el.overlayMsg.textContent = message;
    el.overlayAction.textContent = 'Continue Contest';
    el.overlayAction.hidden = false;
    el.overlayAction.onclick = continueAfterSecurityViolation;
    if (el.overlaySubmit) {
      el.overlaySubmit.textContent = 'Submit Contest';
      el.overlaySubmit.hidden = false;
      el.overlaySubmit.onclick = submitAfterSecurityViolation;
    }
    el.overlay.hidden = false;
  }

  function hideOverlay() {
    el.overlay.hidden = true;
    el.overlayAction.hidden = true;
    el.overlayAction.onclick = null;
    if (el.overlaySubmit) {
      el.overlaySubmit.hidden = true;
      el.overlaySubmit.onclick = null;
    }
  }

  function isFullscreenForContest() {
    return document.fullscreenElement === document.documentElement;
  }

  function requestContestFullscreen() {
    if (!document.documentElement.requestFullscreen) {
      return Promise.resolve(false);
    }
    if (isFullscreenForContest()) return Promise.resolve(true);
    if (fullscreenRetryBusy) return Promise.resolve(false);

    fullscreenRetryBusy = true;
    return document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(function () {
        return true;
      })
      .catch(function () {
        return false;
      })
      .then(function (ok) {
        fullscreenRetryBusy = false;
        return ok;
      });
  }

  function showFullscreenRequired() {
    holdInputs();
    if (!document.documentElement.requestFullscreen) {
      showOverlay('Fullscreen mode is required for this contest, but this browser does not support it. Please use Chrome, Edge, or another modern browser.', null, null);
      return;
    }
    showOverlay(
      'Fullscreen is required. Do not switch tabs or windows during the contest.',
      'Enter Fullscreen',
      function () {
        requestContestFullscreen().then(function (ok) {
          if (ok && securityLockActive && !state.ended) {
            hideOverlay();
            unlockInputs();
          } else {
            showFullscreenRequired();
          }
        });
      }
    );
  }

  function activateContestSecurity() {
    if (state.ended || state.status !== 'active') return;
    securityLockActive = true;

    // The START NOW click on home.js already requested fullscreen. This
    // second request handles browsers that exit fullscreen during navigation.
    requestContestFullscreen().then(function (ok) {
      if (!securityLockActive || state.ended) return;
      if (ok) {
        hideOverlay();
        unlockInputs();
      } else {
        showFullscreenRequired();
      }
    });
  }

  function stopContestSecurity() {
    securityLockActive = false;
    securityViolationPending = false;
    securityReason = '';
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
  }

  function handleSecurityViolation(reason) {
    if (!securityLockActive || state.ended) return;

    // A violation does NOT auto-submit. The participant must explicitly choose
    // whether to continue the contest or submit it.
    securityViolationPending = true;
    securityReason = reason || 'contest_screen_left';
    securityEnding = false;
    holdInputs();

    // Save the current editor state before showing the choice. These saves are
    // best-effort; the browser may throttle background work.
    saveOnLeave();
    saveCodeOnLeave();

    if (document.visibilityState !== 'visible') return;
    showSecurityChoice(
      securityReason === 'fullscreen_exit'
        ? 'You exited fullscreen. Choose Continue Contest to return to fullscreen, or Submit Contest to finish now.'
        : 'You left the contest screen. Choose Continue Contest to return and keep working, or Submit Contest to finish now.'
    );
  }

  function continueAfterSecurityViolation() {
    if (!securityViolationPending || securityEnding || state.ended) return;
    securityEnding = true;
    holdInputs();
    showOverlay('Restoring the protected contest screen…');

    requestContestFullscreen().then(function (ok) {
      securityEnding = false;
      if (!securityViolationPending || state.ended) return;
      if (ok || isFullscreenForContest()) {
        securityViolationPending = false;
        securityReason = '';
        hideOverlay();
        unlockInputs();
        return;
      }
      showSecurityChoice('Fullscreen is required to continue. Choose Continue Contest to try again, or Submit Contest to finish now.');
    });
  }

  function submitAfterSecurityViolation() {
    if (!securityViolationPending || securityEnding || state.ended) return;
    if (!state.session) return;

    securityEnding = true;
    holdInputs();
    showOverlay('Submitting your contest attempt…');

    // Explicit participant choice: leaving fullscreen/tab does not submit by
    // itself; submission happens only after this button is pressed.
    CC.callFunction('finish-attempt', {
      attempt_id: state.session.attempt_id,
      token: state.session.token
    }).then(function (res) {
      securityEnding = false;
      securityViolationPending = false;
      finishFromServer(res.summary, res.status);
    }).catch(function (err) {
      securityEnding = false;
      if (err.code === 'attempt_closed' || err.code === 'expired') {
        fetchState(false).catch(function () {
          showSecurityChoice('The contest could not be submitted yet. Choose Submit Contest to try again, or Continue Contest if you want to keep working.');
        });
        return;
      }
      showSecurityChoice(CC.errorMessage(err) + ' Choose Submit Contest to try again, or Continue Contest to keep working.');
    });
  }

  function finishFromServer(summary, status) {
    if (timer) timer.stop();
    clearInterval(resyncHandle);
    stopContestSecurity();
    lockInputs();
    hideOverlay();
    showResult(summary, status);
  }

  function showResult(summary, status) {
    if (timer) timer.stop();
    clearInterval(resyncHandle);
    state.ended = true;
    CC.session.clear();               // this browser is done with the attempt

    var s = summary || state.summary || {};
    var cs = s.coding_solved || 0;
    var ct = s.coding_total || 10;

    $('r-name').textContent = state.participant ? state.participant.name : '';
    $('r-no').textContent = state.participant ? state.participant.participant_no : '';
    $('r-coding-solved').textContent = cs + ' / ' + ct;
    $('r-total-solved').textContent = cs + ' / ' + ct;

    el.resultNote.textContent = status === 'expired'
      ? 'Time is up. Your answers have been locked.'
      : 'Your answers have been submitted and locked.';

    el.boot.hidden = true;
    el.app.hidden = true;
    hideOverlay();
    if (el.dialog.open) el.dialog.close();
    el.result.hidden = false;
    document.title = 'Contest Completed – Bug Busters | AIVORA 2K26';
    el.resultTitle.setAttribute('tabindex', '-1');
    el.resultTitle.focus();
  }

  function openFinishDialog() {
    if (state.ended) return;
    flushSave(currentQuestion());
    flushCodeSave(currentQuestion());
    var done = state.questions.filter(function (q) { return q.is_solved; }).length;
    var left = state.questions.length - done;
    el.finishSummary.textContent =
      'You have marked ' + done + ' of ' + state.questions.length + ' questions as solved' +
      (left ? ' (' + left + ' left).' : '.') +
      ' Your answers will be locked and you cannot change them afterwards.';
    if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
    else if (window.confirm('Finish the contest now? Your answers will be locked.')) doFinish();
  }

  function doFinish() {
    if (ending || state.ended) return;
    ending = true;
    showOverlay('Saving your answers…');

    // Wait for every queued save so nothing typed is lost, then finish.
    var pending = Object.keys(saveChain).map(function (id) { return saveChain[id].catch(function () {}); })
      .concat(Object.keys(codeSaveChain).map(function (id) { return codeSaveChain[id].catch(function () {}); }));
    Promise.all(pending).then(function () {
      var q = currentQuestion();
      // One last save of the visible text/code/query (silently skipped if unchanged).
      if (!q) return null;
      if (isCodingQuestion(q)) return saveCode(q.question_id, CodeEditor.currentLanguage(), CodeEditor.getCode());
      return saveAnswer(q);
    }).then(function () {
      return CC.callFunction('finish-attempt', {
        attempt_id: state.session.attempt_id,
        token: state.session.token
      });
    }).then(function (res) {
      ending = false;
      finishFromServer(res.summary, res.status);
    }).catch(function (err) {
      ending = false;
      if (err.code === 'attempt_closed' || err.code === 'expired') {
        fetchState(false).catch(function () { hideOverlay(); });
        return;
      }
      hideOverlay();
      CC.toast(CC.errorMessage(err), 'error');
    });
  }

  /* -------------------------------------------------------------- events */

  el.answer.addEventListener('input', function () { updateCharCount(); scheduleSave(); });

  // Tab key inserts spaces in the editor instead of jumping focus away.
  // Escape then Tab still lets keyboard users leave the box.
  var tabTrap = true;
  el.answer.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { tabTrap = false; return; }
    if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    if (!tabTrap) { tabTrap = true; return; }
    e.preventDefault();
    var a = el.answer, s = a.selectionStart, en = a.selectionEnd;
    a.setRangeText('    ', s, en, 'end');
    a.dispatchEvent(new Event('input', { bubbles: true }));
  });
  el.answer.addEventListener('blur', function () { tabTrap = true; flushSave(currentQuestion()); });

  el.tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      var cat = tab.getAttribute('data-cat');
      if (cat !== state.category) selectCategory(cat, 0);
    });
    tab.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var other = el.tabs[(i + 1) % el.tabs.length];
      other.focus();
      selectCategory(other.getAttribute('data-cat'), 0);
    });
  });

  el.solveBtn.addEventListener('click', toggleSolved);
  el.finishBtn.addEventListener('click', openFinishDialog);
  el.bootRetry.addEventListener('click', load);

  /* --------------------------------------------------- coding workspace */

  CodeEditor.onChange(function (questionId, language, code) {
    if (!questionId || state.ended) return;
    scheduleCodeSave(questionId, language, code);
  });
  CodeEditor.onRunShortcut(function () { runCode(); });          // Ctrl+Enter
  CodeEditor.onSaveShortcut(function () {                        // Ctrl+S
    var q = currentQuestion();
    if (!isCodingQuestion(q) || !hasCodingConfig(q) || state.ended) return;
    saveCode(q.question_id, CodeEditor.currentLanguage(), CodeEditor.getCode());
  });

  el.codeLang.addEventListener('change', function () {
    var q = currentQuestion();
    if (!isCodingQuestion(q) || !hasCodingConfig(q) || codeEditorLoading) return;
    // Save whatever is in the editor for the language we're leaving before switching.
    flushCodeSave(q);
    CodeEditor.switchLanguage(el.codeLang.value);
    setCodeSaveStatus('', '');
  });

  el.runBtn.addEventListener('click', runCode);
  el.submitBtn.addEventListener('click', submitCode);
  el.testTabCases.addEventListener('click', function () { selectTestTab('cases'); });
  el.testTabResult.addEventListener('click', function () { selectTestTab('result'); });

  // Best-effort save of unsaved code when the tab is hidden or closed.
  function saveCodeOnLeave() {
    var q = currentQuestion();
    if (!q || state.ended || !isCodingQuestion(q) || codeEditorFor !== q.question_id) return;
    var lang = CodeEditor.currentLanguage();
    var code = CodeEditor.getCode();
    var prevSaved = (lastSavedCode[q.question_id] || {})[lang];
    if (code === prevSaved || code.length > MAX_ANSWER) return;
    enqueueCode(q.question_id, code, lang).then(function (res) {
      if (res) { lastSavedCode[q.question_id] = lastSavedCode[q.question_id] || {}; lastSavedCode[q.question_id][lang] = code; }
    }).catch(function () {});
  }

  /* ------------------------------------------------------- SQL workspace */

  SqlEditor.onChange(function (questionId, dialect, query) {
    if (!questionId || state.ended) return;
    scheduleSqlSave(questionId, dialect, query);
  });
  SqlEditor.onRunShortcut(function () { runSql(); });            // Ctrl+Enter
  SqlEditor.onSaveShortcut(function () {                         // Ctrl+S
    var q = currentQuestion();
    if (!isSqlQuestion(q) || !hasSqlConfig(q) || state.ended) return;
    saveSql(q.question_id, SqlEditor.currentDialect(), SqlEditor.getQuery());
  });

  el.sqlLang.addEventListener('change', function () {
    var q = currentQuestion();
    if (!isSqlQuestion(q) || !hasSqlConfig(q) || sqlEditorLoading) return;
    flushSqlSave(q);
    SqlEditor.switchDialect(el.sqlLang.value);
    setSqlSaveStatus('', '');
  });

  el.sqlRunBtn.addEventListener('click', runSql);
  el.sqlSubmitBtn.addEventListener('click', submitSql);
  el.sqlTestTabCases.addEventListener('click', function () { selectSqlTestTab('cases'); });
  el.sqlTestTabResult.addEventListener('click', function () { selectSqlTestTab('result'); });

  // Best-effort save of unsaved SQL when the tab is hidden or closed.
  function saveSqlOnLeave() {
    var q = currentQuestion();
    if (!q || state.ended || !isSqlQuestion(q) || sqlEditorFor !== q.question_id) return;
    var dialect = SqlEditor.currentDialect();
    var query = SqlEditor.getQuery();
    var prevSaved = (lastSavedSql[q.question_id] || {})[dialect];
    if (query === prevSaved || query.length > MAX_ANSWER) return;
    enqueueSql(q.question_id, query, dialect).then(function (res) {
      if (res) { lastSavedSql[q.question_id] = lastSavedSql[q.question_id] || {}; lastSavedSql[q.question_id][dialect] = query; }
    }).catch(function () {});
  }

  el.dialog.addEventListener('close', function () {
    if (el.dialog.returnValue === 'finish') doFinish();
    el.dialog.returnValue = '';
  });

  // Best-effort save of unsaved text when the tab is hidden or closed.
  function saveOnLeave() {
    var q = currentQuestion();
    if (!q || state.ended || el.answer.disabled || editorFor !== q.question_id) return;
    var value = el.answer.value;
    if (value === lastSavedText[q.question_id] || value.length > MAX_ANSWER) return;
    q.answer = value;
    enqueue(q.question_id, { answer: value, keepalive: true }).then(function (res) {
      if (res) lastSavedText[q.question_id] = value;
    }).catch(function () {});
  }
  // ------------------------------------------------------------------
  // Strict contest security events. Visibility changes are the browser's
  // reliable signal that the participant switched tabs/windows. Exiting
  // fullscreen is also treated as leaving the protected contest screen.
  document.addEventListener('visibilitychange', function () {
    if (!securityLockActive || state.ended) {
      if (document.visibilityState === 'visible' && !state.ended && timer) resyncClock();
      return;
    }

    if (document.visibilityState === 'hidden') {
      saveOnLeave();
      saveCodeOnLeave();
        handleSecurityViolation('tab_switch');
      return;
    }

    // The participant came back. Require an explicit choice instead of
    // silently submitting the attempt.
    if (securityViolationPending) {
      showSecurityChoice(
        securityReason === 'fullscreen_exit'
          ? 'You exited fullscreen. Choose Continue Contest to return to fullscreen, or Submit Contest to finish now.'
          : 'You left the contest screen. Choose Continue Contest to return and keep working, or Submit Contest to finish now.'
      );
      return;
    }

    if (!state.ended && timer) resyncClock();
  });

  document.addEventListener('fullscreenchange', function () {
    if (!securityLockActive || state.ended) return;

    if (isFullscreenForContest()) {
      if (!securityViolationPending) {
        hideOverlay();
        unlockInputs();
      }
      return;
    }

    handleSecurityViolation('fullscreen_exit');
  });

  // Best-effort prevention of common browser navigation shortcuts. Protected
  // browser/OS shortcuts (including Alt+Tab) cannot be cancelled by a web page.
  document.addEventListener('keydown', function (e) {
    if (!securityLockActive || state.ended) return;
    var key = String(e.key || '').toLowerCase();
    var blocked =
      (e.ctrlKey && ['l', 't', 'n', 'r', 'w'].indexOf(key) !== -1) ||
      (e.metaKey && ['l', 't', 'n', 'r', 'w'].indexOf(key) !== -1) ||
      (e.key === 'F5') ||
      (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'));
    if (blocked) e.preventDefault();
  }, true);

  window.addEventListener('beforeunload', function (e) {
    if (!securityLockActive || state.ended || ending) return;
    e.preventDefault();
    e.returnValue = '';
  });

  window.addEventListener('pagehide', function () {
    saveOnLeave();
    saveCodeOnLeave();
  });

  load();
})();
