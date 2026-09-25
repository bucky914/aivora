/* SQL workspace: lazy-loaded Monaco Editor + per-dialect query storage.
 *
 * Deliberately a SEPARATE module from code-editor.js rather than a
 * generalization of it — the coding editor is a tested, working system
 * and this avoids touching it at all. The two share the same Monaco CDN
 * loading approach (loadMonaco() below is a near-duplicate of
 * code-editor.js's) but each keeps its own Monaco editor INSTANCE, since
 * a question is never coding and SQL at the same time, so only one of
 * the two editors is ever mounted into the page at once.
 *
 * This module knows nothing about Supabase, autosave timing, or scoring.
 * It only:
 *   - loads Monaco once, the first time a SQL question is opened,
 *   - keeps one in-memory buffer per dialect (sql / postgresql) for the
 *     question currently open, so switching dialects never erases what
 *     you wrote in the other one,
 *   - tells contest.js when the buffer changed (for autosave) and when
 *     Ctrl+Enter / Ctrl+S are pressed (for Run / manual save).
 *
 * contest.js owns loading saved queries from the server and sending them
 * back; this module only owns the on-screen editor and the dialect switch.
 */
(function (global) {
  'use strict';

  var DIALECTS = ['sql', 'postgresql'];
  var DIALECT_LABEL = { sql: 'SQL', postgresql: 'PostgreSQL' };

  var monacoReady = null;     // promise, resolves once window.monaco exists (shared loader logic, own promise)
  var editor = null;          // the single SQL Monaco editor instance (reused across questions)
  var models = {};            // dialect -> monaco.editor.ITextModel, for the CURRENT question
  var currentQuestionId = null;
  var currentDialect = 'postgresql';
  var onChangeCb = function () {};
  var onRunShortcutCb = function () {};
  var onSaveShortcutCb = function () {};
  var suppressChange = false; // true while we set a model's value programmatically

  function loadMonaco() {
    if (monacoReady) return monacoReady;
    monacoReady = new Promise(function (resolve, reject) {
      // If code-editor.js already loaded Monaco (a coding question was
      // opened earlier in this session), reuse the same window.monaco
      // instead of injecting the loader script a second time.
      if (global.monaco && global.monaco.editor) { resolve(global.monaco); return; }
      var base = global.MONACO_CDN_BASE || 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min';
      var loaderScript = document.createElement('script');
      loaderScript.src = base + '/vs/loader.js';
      loaderScript.onload = function () {
        global.require.config({ paths: { vs: base + '/vs' } });
        global.require(['vs/editor/editor.main'], function () {
          resolve(global.monaco);
        }, reject);
      };
      loaderScript.onerror = function () { reject(new Error('Could not load the SQL editor. Check your connection.')); };
      document.head.appendChild(loaderScript);
    });
    return monacoReady;
  }

  function ensureEditor(container) {
    return loadMonaco().then(function (monaco) {
      if (editor) return editor;
      // 'cc-dark' theme is defined by code-editor.js if a coding question
      // was opened first; define it here too in case SQL is opened first
      // in a session that never touches a coding question. Re-defining an
      // existing theme with the same name/colors is a harmless no-op.
      defineTheme(monaco);
      editor = monaco.editor.create(container, {
        theme: 'cc-dark',
        automaticLayout: true,
        fontFamily: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Consolas, monospace",
        fontSize: 13.5,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
        renderWhitespace: 'none',
        bracketPairColorization: { enabled: true },
        folding: true,
        wordWrap: 'off',
        padding: { top: 12, bottom: 12 }
      });
      editor.onDidChangeModelContent(function () {
        if (suppressChange) return;
        onChangeCb(currentQuestionId, currentDialect, editor.getValue());
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, function () {
        onRunShortcutCb();
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
        onSaveShortcutCb();
      });
      return editor;
    });
  }

  function defineTheme(monaco) {
    monaco.editor.defineTheme('cc-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#130a1b',
        'editor.lineHighlightBackground': '#1c1128',
        'editorLineNumber.foreground': '#5b4778',
        'editorLineNumber.activeForeground': '#a99cbf',
        'editorCursor.foreground': '#f2b441',
        'editor.selectionBackground': '#43315c',
        'editorIndentGuide.background': '#2e2042',
        'editorWidget.background': '#241833',
        'editorWidget.border': '#43315c'
      }
    });
  }

  /* Open a question's editor: build one model per dialect (from any saved
   * draft — SQL questions have no per-dialect starter code the way coding
   * questions do; both dialects start from the same starter_content-style
   * template if nothing is saved yet), show the given dialect, and mount
   * into `container`. Call this whenever the current SQL question changes. */
  function openQuestion(container, opts) {
    var questionId = opts.questionId;
    var starterQuery = opts.starterQuery || '';     // same starting text offered for both dialects
    var savedQuery = opts.savedQuery || {};         // { sql: "...", postgresql: "..." } from the server draft
    var initialDialect = opts.dialect && DIALECTS.indexOf(opts.dialect) !== -1 ? opts.dialect : 'postgresql';
    var disabled = !!opts.disabled;

    return loadMonaco().then(function (monaco) {
      return ensureEditor(container);
    }).then(function (ed) {
      Object.keys(models).forEach(function (dialect) { models[dialect].dispose(); });
      models = {};

      DIALECTS.forEach(function (dialect) {
        var text = (savedQuery[dialect] != null && savedQuery[dialect] !== '')
          ? savedQuery[dialect]
          : starterQuery;
        models[dialect] = global.monaco.editor.createModel(text, 'sql');
      });

      currentQuestionId = questionId;
      currentDialect = initialDialect;
      suppressChange = true;
      ed.setModel(models[currentDialect]);
      suppressChange = false;
      ed.updateOptions({ readOnly: disabled });
      if (!disabled) ed.focus();
      return currentDialect;
    });
  }

  /* Switch the visible dialect for the CURRENT question. Never touches
   * the other dialect's model, so its query is preserved untouched. */
  function switchDialect(dialect) {
    if (!editor || !models[dialect] || dialect === currentDialect) return;
    currentDialect = dialect;
    suppressChange = true;
    editor.setModel(models[dialect]);
    suppressChange = false;
  }

  function getQuery(dialect) {
    dialect = dialect || currentDialect;
    return models[dialect] ? models[dialect].getValue() : '';
  }

  function setDisabled(disabled) {
    if (editor) editor.updateOptions({ readOnly: disabled });
  }

  function destroy() {
    Object.keys(models).forEach(function (dialect) { models[dialect].dispose(); });
    models = {};
    currentQuestionId = null;
  }

  global.SqlEditor = {
    DIALECTS: DIALECTS,
    DIALECT_LABEL: DIALECT_LABEL,
    openQuestion: openQuestion,
    switchDialect: switchDialect,
    getQuery: getQuery,
    setDisabled: setDisabled,
    destroy: destroy,
    currentDialect: function () { return currentDialect; },
    onChange: function (cb) { onChangeCb = cb; },
    onRunShortcut: function (cb) { onRunShortcutCb = cb; },
    onSaveShortcut: function (cb) { onSaveShortcutCb = cb; }
  };
})(window);
