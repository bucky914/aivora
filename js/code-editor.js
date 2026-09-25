/* Coding workspace: lazy-loaded Monaco Editor + per-language code storage.
 *
 * This module knows nothing about Supabase, autosave timing, or scoring.
 * It only:
 *   - loads Monaco once, the first time a coding question is opened,
 *   - keeps one in-memory buffer per language for the question currently
 *     open (so switching languages never erases what you wrote),
 *   - tells contest.js when the buffer changed (for autosave) and when
 *     Ctrl+Enter / Ctrl+S are pressed (for Run / manual save).
 *
 * contest.js owns loading saved code from the server and sending it back;
 * this module only owns the on-screen editor and the language switch.
 */
(function (global) {
  'use strict';

  var LANGUAGES = ['python3', 'java', 'cpp', 'c'];
  var MONACO_LANG = { python3: 'python', java: 'java', cpp: 'cpp', c: 'c' };
  var LANGUAGE_LABEL = { python3: 'Python 3', java: 'Java', cpp: 'C++', c: 'C' };

  var monacoReady = null;     // promise, resolves once window.monaco exists
  var editor = null;          // the single Monaco editor instance (reused across questions)
  var models = {};            // language -> monaco.editor.ITextModel, for the CURRENT question
  var currentQuestionId = null;
  var currentLang = 'python3';
  var onChangeCb = function () {};
  var onRunShortcutCb = function () {};
  var onSaveShortcutCb = function () {};
  var suppressChange = false; // true while we set a model's value programmatically

  function loadMonaco() {
    if (monacoReady) return monacoReady;
    monacoReady = new Promise(function (resolve, reject) {
      var base = global.MONACO_CDN_BASE || 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min';
      var loaderScript = document.createElement('script');
      loaderScript.src = base + '/vs/loader.js';
      loaderScript.onload = function () {
        global.require.config({ paths: { vs: base + '/vs' } });
        global.require(['vs/editor/editor.main'], function () {
          resolve(global.monaco);
        }, reject);
      };
      loaderScript.onerror = function () { reject(new Error('Could not load the code editor. Check your connection.')); };
      document.head.appendChild(loaderScript);
    });
    return monacoReady;
  }

  function ensureEditor(container) {
    return loadMonaco().then(function (monaco) {
      if (editor) return editor;
      editor = monaco.editor.create(container, {
        theme: 'cc-dark',
        automaticLayout: true,
        fontFamily: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Consolas, monospace",
        fontSize: 13.5,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        insertSpaces: true,
        renderWhitespace: 'none',
        bracketPairColorization: { enabled: true },
        folding: true,
        wordWrap: 'off',
        padding: { top: 12, bottom: 12 }
      });
      editor.onDidChangeModelContent(function () {
        if (suppressChange) return;
        onChangeCb(currentQuestionId, currentLang, editor.getValue());
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

  /* Open a question's editor: build one model per language (from starter
   * code + any saved draft), show the given language, and mount into
   * `container`. Call this whenever the current coding question changes. */
  function openQuestion(container, opts) {
    var questionId = opts.questionId;
    var starterCode = opts.starterCode || {};     // { python3: "...", java: "...", ... }
    var savedCode = opts.savedCode || {};         // same shape, from the server draft
    var initialLang = opts.language && LANGUAGES.indexOf(opts.language) !== -1 ? opts.language : 'python3';
    var disabled = !!opts.disabled;

    return loadMonaco().then(function (monaco) {
      defineTheme(monaco);
      return ensureEditor(container);
    }).then(function (ed) {
      // Dispose the previous question's models; each question gets fresh ones.
      Object.keys(models).forEach(function (lang) { models[lang].dispose(); });
      models = {};

      LANGUAGES.forEach(function (lang) {
        var text = (savedCode[lang] != null && savedCode[lang] !== '')
          ? savedCode[lang]
          : (starterCode[lang] || '');
        models[lang] = monaco.editor.createModel(text, MONACO_LANG[lang]);
      });

      currentQuestionId = questionId;
      currentLang = initialLang;
      suppressChange = true;
      ed.setModel(models[currentLang]);
      suppressChange = false;
      ed.updateOptions({ readOnly: disabled });
      if (!disabled) ed.focus();
      return currentLang;
    });
  }

  /* Switch the visible language for the CURRENT question. Never touches
   * the other languages' models, so their code is preserved untouched. */
  function switchLanguage(lang) {
    if (!editor || !models[lang] || lang === currentLang) return;
    currentLang = lang;
    suppressChange = true;
    editor.setModel(models[lang]);
    suppressChange = false;
  }

  function getCode(lang) {
    lang = lang || currentLang;
    return models[lang] ? models[lang].getValue() : '';
  }

  function getAllCode() {
    var out = {};
    LANGUAGES.forEach(function (lang) { out[lang] = models[lang] ? models[lang].getValue() : ''; });
    return out;
  }

  function setDisabled(disabled) {
    if (editor) editor.updateOptions({ readOnly: disabled });
  }

  function destroy() {
    Object.keys(models).forEach(function (lang) { models[lang].dispose(); });
    models = {};
    currentQuestionId = null;
  }

  global.CodeEditor = {
    LANGUAGES: LANGUAGES,
    LANGUAGE_LABEL: LANGUAGE_LABEL,
    openQuestion: openQuestion,
    switchLanguage: switchLanguage,
    getCode: getCode,
    getAllCode: getAllCode,
    setDisabled: setDisabled,
    destroy: destroy,
    currentLanguage: function () { return currentLang; },
    onChange: function (cb) { onChangeCb = cb; },
    onRunShortcut: function (cb) { onRunShortcutCb = cb; },
    onSaveShortcut: function (cb) { onSaveShortcutCb = cb; }
  };
})(window);
