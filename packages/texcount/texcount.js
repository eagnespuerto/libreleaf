/*!
 * LibreLeaf TeXCount — a TeXCount-style word counter for LaTeX.
 * Runs in the browser (window.LibreTeXCount) and in Node (require / CLI).
 * Copyright (C) 2026 Ella Agnes Puerto. AGPL-3.0-or-later.
 *
 * Counting rules follow TeXCount's defaults where practical:
 *   - only the document body is counted (plus \title from the preamble);
 *   - words in section headings, float captions and running text are counted
 *     separately, and their total is the "sum";
 *   - maths is counted as inline / displayed items, not as words;
 *   - references, citations, labels, URLs and package setup are ignored;
 *   - verbatim, code listings, TikZ pictures and the bibliography are ignored.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LibreTeXCount = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '0.0.2';

  // Heading macros and their level. Levels <= BREAKDOWN_LEVEL start a new
  // entry in the per-section breakdown.
  var SECTION_LEVELS = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4, paragraph: 5, subparagraph: 6 };
  var BREAKDOWN_LEVEL = 2;

  // Macros whose arguments are not words. Value = number of mandatory arguments
  // to skip (optional [..] arguments in front of each are skipped too).
  var IGNORE_ARGS = {
    label: 1, ref: 1, eqref: 1, pageref: 1, autoref: 1, cref: 1, Cref: 1, nameref: 1, vref: 1,
    cite: 1, citep: 1, citet: 1, citealp: 1, citealt: 1, citeauthor: 1, citeyear: 1, citeyearpar: 1,
    parencite: 1, textcite: 1, autocite: 1, footcite: 1, nocite: 1, fullcite: 1,
    includegraphics: 1, input: 1, include: 1, includeonly: 1, subfile: 1, import: 2, subimport: 2,
    bibliography: 1, bibliographystyle: 1, addbibresource: 1, printbibliography: 0,
    usepackage: 1, RequirePackage: 1, documentclass: 1,
    url: 1, href: 1, doi: 1, email: 1, orcid: 1,
    hspace: 1, vspace: 1, setlength: 2, addtolength: 2, setcounter: 2, addtocounter: 2,
    newcommand: 2, renewcommand: 2, providecommand: 2, DeclareMathOperator: 2,
    newenvironment: 3, renewenvironment: 3, newtheorem: 2, theoremstyle: 1,
    color: 1, textcolor: 1, colorbox: 1, fontsize: 2, linespread: 1, graphicspath: 1,
    pagestyle: 1, thispagestyle: 1, pagenumbering: 1, bibitem: 1, hypersetup: 1, geometry: 1,
    rule: 2, raisebox: 1, resizebox: 2, scalebox: 1, captionsetup: 1, setcitestyle: 1,
    definecolor: 3, newcounter: 1, numberwithin: 2, setbeamertemplate: 1
  };

  var DISPLAY_MATH_ENVS = toSet('equation equation* align align* gather gather* multline multline* eqnarray eqnarray* displaymath flalign flalign* alignat alignat* dmath dmath*');
  var FLOAT_ENVS = toSet('figure figure* table table* wrapfigure wraptable sidewaysfigure sidewaystable subfigure subtable algorithm');
  var IGNORE_ENVS = toSet('verbatim verbatim* Verbatim lstlisting minted comment tikzpicture pgfpicture thebibliography filecontents filecontents*');
  // Environments that take mandatory arguments right after \begin{env}.
  var ENV_ARGS = { tabular: 1, 'tabular*': 2, tabularx: 2, longtable: 1, array: 1, minipage: 1, multicols: 1, wrapfigure: 2, wraptable: 2, list: 2, subfigure: 1, subtable: 1 };

  var SPECIAL_LETTERS = { ss: 'ß', o: 'ø', O: 'Ø', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', aa: 'å', AA: 'Å', l: 'ł', L: 'Ł', i: 'i', j: 'j' };
  var WORD_RE = /[\p{L}\p{N}]+(?:['’.\-][\p{L}\p{N}]+)*/gu;

  function toSet(s) { var o = Object.create(null); s.split(' ').forEach(function (k) { o[k] = true; }); return o; }

  function countWords(text) {
    var m = text.match(WORD_RE);
    return m ? m.length : 0;
  }

  // Drop everything between %TC:ignore and %TC:endignore lines, as TeXCount does.
  function applyIgnoreMarkers(src) {
    var out = [], skipping = false;
    src.split('\n').forEach(function (line) {
      if (/^\s*%\s*TC:ignore\b/.test(line)) { skipping = true; return; }
      if (/^\s*%\s*TC:endignore\b/.test(line)) { skipping = false; return; }
      if (!skipping) out.push(line);
    });
    return out.join('\n');
  }

  // Newlines, %TC:ignore blocks and comments: the clean-up every file gets.
  function prepare(src) {
    return stripComments(applyIgnoreMarkers(String(src).replace(/\r\n?/g, '\n')));
  }

  // Remove % comments, keeping escaped \%.
  function stripComments(src) {
    return src.split('\n').map(function (line) {
      for (var i = 0; i < line.length; i++) {
        if (line[i] !== '%') continue;
        var bs = 0;
        for (var j = i - 1; j >= 0 && line[j] === '\\'; j--) bs++;
        if (bs % 2 === 0) return line.slice(0, i);
      }
      return line;
    }).join('\n');
  }

  // Turn accent macros into plain letters so Schr\"odinger counts as one word.
  function normaliseAccents(src) {
    return src
      .replace(/\\(['`^"~=.])\s*(?:\{\s*(\\?[A-Za-z])\s*\}|([A-Za-z]))/g, function (_, a, braced, bare) { return (braced || bare).replace('\\', ''); })
      .replace(/\\([uvHckrdbt])\s*\{\s*(\\?[A-Za-z])\s*\}/g, function (_, a, l) { return l.replace('\\', ''); })
      .replace(/\\(ss|ae|AE|oe|OE|aa|AA|o|O|l|L|i|j)(?![A-Za-z])(?:\{\}| (?=[A-Za-z]))?/g, function (_, k) { return SPECIAL_LETTERS[k]; });
  }

  function isLetter(c) { return /[A-Za-z@]/.test(c); }
  function skipSpace(s, i) { while (i < s.length && /\s/.test(s[i])) i++; return i; }

  // s[i] === open. Returns [content, indexAfterClose].
  function readBalanced(s, i, open, close) {
    var depth = 0, start = i + 1;
    for (; i < s.length; i++) {
      var c = s[i];
      if (c === '\\') { i++; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) return [s.slice(start, i), i + 1]; }
    }
    return [s.slice(start), s.length];
  }

  function skipOpts(s, i) {
    for (;;) {
      var j = skipSpace(s, i);
      if (s[j] !== '[') return i;
      i = readBalancedSquare(s, j)[1];
    }
  }

  // [..] may contain {..} with brackets inside, so track braces too.
  function readBalancedSquare(s, i) {
    var depth = 0, brace = 0, start = i + 1;
    for (; i < s.length; i++) {
      var c = s[i];
      if (c === '\\') { i++; continue; }
      if (c === '{') brace++;
      else if (c === '}') brace--;
      else if (brace === 0 && c === '[') depth++;
      else if (brace === 0 && c === ']') { depth--; if (depth === 0) return [s.slice(start, i), i + 1]; }
    }
    return [s.slice(start), s.length];
  }

  // Reads one macro argument: {group}, \command, or a single character.
  function readArg(s, i) {
    var j = skipSpace(s, i);
    if (j >= s.length) return ['', j];
    if (s[j] === '{') return readBalanced(s, j, '{', '}');
    if (s[j] === '\\') {
      var k = j + 1;
      if (isLetter(s[k] || '')) { while (k < s.length && isLetter(s[k])) k++; } else k++;
      return [s.slice(j, k), k];
    }
    return [s[j], j + 1];
  }

  function skipArgs(s, i, n) {
    for (var k = 0; k < n; k++) { i = skipOpts(s, i); i = readArg(s, i)[1]; }
    return i;
  }

  function findEnvEnd(s, i, env) {
    var open = '\\begin{' + env + '}', close = '\\end{' + env + '}', depth = 1, pos = i;
    for (;;) {
      var nb = s.indexOf(open, pos), ne = s.indexOf(close, pos);
      if (ne < 0) return [s.length, s.length];
      if (nb >= 0 && nb < ne) { depth++; pos = nb + open.length; }
      else { depth--; pos = ne + close.length; if (depth === 0) return [ne, pos]; }
    }
  }

  function plainTitle(arg) {
    return normaliseAccents(arg).replace(/\\[A-Za-z@]+\*?/g, ' ').replace(/[{}$~\\]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function newSection(title, level) {
    return { title: title, level: level, text: 0, headerWords: 0, captionWords: 0, otherWords: 0, abstractWords: 0, headers: 0, floats: 0, inlineMath: 0, displayMath: 0 };
  }

  function Counter() {
    this.sections = [newSection('Front matter', -1)];
    this.cur = this.sections[0];
  }

  Counter.prototype.addWords = function (text, mode) {
    var n = countWords(text);
    if (!n) return;
    if (mode === 'text') this.cur.text += n;
    else if (mode === 'header') this.cur.headerWords += n;
    else if (mode === 'caption') this.cur.captionWords += n;
    else this.cur.otherWords += n;
  };

  Counter.prototype.walk = function (s, mode) {
    var buf = '', i = 0, self = this;
    function flush() { if (buf) { self.addWords(buf, mode); buf = ''; } }
    while (i < s.length) {
      var c = s[i];
      if (c === '\\') {
        var next = s[i + 1];
        if (next === undefined) break;
        if (isLetter(next)) {
          var j = i + 1;
          while (j < s.length && isLetter(s[j])) j++;
          var name = s.slice(i + 1, j);
          if (s[j] === '*') j++;
          flush();
          i = this.command(name, s, j, mode);
          buf += ' ';
          continue;
        }
        if (next === '(' || next === '[') {
          flush();
          var endTok = next === '(' ? '\\)' : '\\]';
          var e = s.indexOf(endTok, i + 2);
          if (next === '(') this.cur.inlineMath++; else this.cur.displayMath++;
          i = e < 0 ? s.length : e + 2;
          continue;
        }
        if (next === '\\') { // line break, maybe \\* or \\[2pt]
          i += 2;
          if (s[i] === '*') i++;
          if (s[i] === '[') i = readBalancedSquare(s, i)[1];
          buf += ' ';
          continue;
        }
        buf += ' '; // \% \& \, \; \  and friends
        i += 2;
        continue;
      }
      if (c === '$') {
        flush();
        if (s[i + 1] === '$') {
          var d = s.indexOf('$$', i + 2);
          this.cur.displayMath++;
          i = d < 0 ? s.length : d + 2;
        } else {
          var k = i + 1;
          while (k < s.length && !(s[k] === '$' && s[k - 1] !== '\\')) k++;
          this.cur.inlineMath++;
          i = k + 1;
        }
        continue;
      }
      if (c === '{' || c === '}') { i++; continue; } // braces are transparent: {T}he = The
      if (c === '~' || c === '&') { buf += ' '; i++; continue; }
      buf += c;
      i++;
    }
    flush();
  };

  Counter.prototype.command = function (name, s, i, mode) {
    var arg;
    if (name === 'begin') {
      arg = readArg(s, i);
      return this.environment(arg[0].trim(), s, arg[1], mode);
    }
    if (name === 'end') return readArg(s, i)[1];
    if (name === 'verb' || name === 'lstinline') {
      i = skipOpts(s, i);
      var delim = s[i];
      if (delim === '{') return readBalanced(s, i, '{', '}')[1];
      var close = s.indexOf(delim, i + 1);
      return close < 0 ? s.length : close + 1;
    }
    if (Object.prototype.hasOwnProperty.call(SECTION_LEVELS, name) || name === 'title' || name === 'subtitle') {
      i = skipOpts(s, i);
      arg = readArg(s, i);
      var level = name === 'title' || name === 'subtitle' ? -1 : SECTION_LEVELS[name];
      if (level >= 0 && level <= BREAKDOWN_LEVEL) {
        this.cur = newSection(name.charAt(0).toUpperCase() + name.slice(1) + ': ' + plainTitle(arg[0]), level);
        this.sections.push(this.cur);
      }
      this.cur.headers++;
      this.walk(arg[0], 'header');
      return arg[1];
    }
    if (name === 'caption' || name === 'subcaption' || name === 'captionof') {
      if (name === 'captionof') i = skipArgs(s, i, 1);
      i = skipOpts(s, i);
      arg = readArg(s, i);
      this.walk(arg[0], 'caption');
      return arg[1];
    }
    if (name === 'footnote' || name === 'footnotetext' || name === 'thanks') {
      i = skipOpts(s, i);
      arg = readArg(s, i);
      this.walk(arg[0], mode === 'float' ? 'caption' : mode);
      return arg[1];
    }
    if (name === 'ensuremath') {
      this.cur.inlineMath++;
      return readArg(s, i)[1];
    }
    if (name === 'href') { // \href{url}{text}: skip the URL, count the text
      return skipArgs(s, i, 1);
    }
    if (Object.prototype.hasOwnProperty.call(IGNORE_ARGS, name)) return skipArgs(s, i, IGNORE_ARGS[name]);
    return i; // formatting macros (\emph, \textbf, …): their arguments are ordinary text
  };

  Counter.prototype.environment = function (env, s, i, mode) {
    var bounds = findEnvEnd(s, i, env);
    var inner = s.slice(i, bounds[0]);
    var after = bounds[1];
    if (IGNORE_ENVS[env]) return after;
    if (DISPLAY_MATH_ENVS[env]) { this.cur.displayMath++; return after; }
    if (env === 'math') { this.cur.inlineMath++; return after; }
    var start = 0;
    if (FLOAT_ENVS[env] || ENV_ARGS[env]) {
      start = skipOpts(inner, 0);
      if (ENV_ARGS[env]) start = skipArgs(inner, start, ENV_ARGS[env]);
    }
    inner = inner.slice(start);
    if (FLOAT_ENVS[env]) {
      this.cur.floats++;
      this.walk(inner, 'float');
      return after;
    }
    if (env === 'abstract') {
      var sec = this.cur, before = sec.text;
      this.walk(inner, mode);
      sec.abstractWords += sec.text - before;
      return after;
    }
    this.walk(inner, mode);
    return after;
  };

  // The sum is text + headings + captions. Options can leave out the abstract
  // (journals that count the main text only) or the captions.
  function sumOf(sec, opts) {
    return sec.text - (opts.excludeAbstract ? sec.abstractWords : 0) + sec.headerWords + (opts.excludeCaptions ? 0 : sec.captionWords);
  }

  /**
   * Count words in a LaTeX source string.
   * @param {string} src LaTeX source
   * @param {{excludeAbstract?: boolean, excludeCaptions?: boolean}} [options]
   * @returns {object} totals plus a per-section breakdown
   */
  function count(src, options) {
    var opts = { excludeAbstract: !!(options && options.excludeAbstract), excludeCaptions: !!(options && options.excludeCaptions) };
    src = normaliseAccents(prepare(src));
    var counter = new Counter();
    var b = src.indexOf('\\begin{document}');
    var body = src;
    if (b >= 0) {
      var preamble = src.slice(0, b);
      var t = preamble.search(/\\title\s*[\[{]/);
      if (t >= 0) counter.command('title', preamble, t + 6, 'text');
      body = src.slice(b + '\\begin{document}'.length);
      var e = body.indexOf('\\end{document}');
      if (e >= 0) body = body.slice(0, e);
    }
    counter.walk(body, 'text');

    var sections = counter.sections.filter(function (sec, idx) {
      return idx > 0 || sec.text || sec.headerWords || sec.captionWords || sec.headers || sec.floats || sec.inlineMath || sec.displayMath;
    }).map(function (sec) {
      return Object.assign({}, sec, { sum: sumOf(sec, opts) });
    });
    var total = { text: 0, headerWords: 0, captionWords: 0, otherWords: 0, abstractWords: 0, headers: 0, floats: 0, inlineMath: 0, displayMath: 0 };
    counter.sections.forEach(function (sec) { Object.keys(total).forEach(function (k) { total[k] += sec[k]; }); });
    return Object.assign({ version: VERSION, sum: sumOf(total, opts), options: opts }, total, { sections: sections });
  }

  // ---- Multi-file projects -------------------------------------------------

  // POSIX-style path helpers, so the same code runs on a folder in the
  // browser, a .zip, or the file system.
  function normPath(p) {
    var out = [];
    String(p).replace(/\\/g, '/').split('/').forEach(function (part) {
      if (part === '' || part === '.') return;
      if (part === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else out.push('..'); }
      else out.push(part);
    });
    return out.join('/');
  }
  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
  function joinPath(dir, name) { return normPath(dir ? dir + '/' + name : name); }

  var INPUT_RE = /\\(input|include|subfile)(?![A-Za-z@])\s*(?:\{([^{}]*)\}|([^\s{}\\%]+))|\\(import|subimport|inputfrom|subinputfrom|includefrom|subincludefrom)\*?\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g;

  /**
   * Inline \input, \include, \subfile and the import package's \import and
   * \subimport, the way TeX finds them: paths are relative to the main file's
   * folder (or to the \import folder), with .tex added when there's no
   * extension. Each file has %TC:ignore blocks and comments removed first, so a
   * commented-out \input isn't followed.
   *
   * @param {string} mainPath path of the main file, e.g. "paper/main.tex"
   * @param {(path: string) => (string|null|undefined)} readFile returns a file's text, or null if it doesn't exist
   * @returns {{source: string, files: string[], missing: string[]}}
   */
  function expandInputs(mainPath, readFile, options) {
    var maxDepth = (options && options.maxDepth) || 20;
    var files = [], missing = [];
    mainPath = normPath(mainPath);
    var rootDir = dirOf(mainPath);

    function tryRead(candidates) {
      for (var i = 0; i < candidates.length; i++) {
        var text = readFile(candidates[i]);
        if (text != null) return { path: candidates[i], text: text };
      }
      return null;
    }
    function withTex(p) { return /\.tex$/i.test(p) ? [p] : [p + '.tex', p]; }

    function expand(path, text, base, stack, depth) {
      files.push(path);
      var src = prepare(text);
      if (depth >= maxDepth) return src;
      return src.replace(INPUT_RE, function (m, kind, braced, bare, ikind, idir, ifile) {
        var name = (braced != null ? braced : bare != null ? bare : ifile || '').trim();
        if (!name) return m;
        var childBase = base, dirs;
        if (ikind) {
          var sub = /^sub/.test(ikind);
          childBase = joinPath(sub ? dirOf(path) : rootDir, idir.trim());
          dirs = [childBase];
        } else {
          dirs = [base, dirOf(path), rootDir].filter(function (d, i, a) { return a.indexOf(d) === i; });
        }
        var candidates = [];
        dirs.forEach(function (d) { withTex(joinPath(d, name)).forEach(function (c) { if (candidates.indexOf(c) < 0) candidates.push(c); }); });
        var hit = tryRead(candidates);
        if (!hit) { if (missing.indexOf(name) < 0) missing.push(name); return m; }
        if (stack.indexOf(hit.path) >= 0) return ' ';
        var kindName = kind || ikind;
        var body = expand(hit.path, hit.text, childBase, stack.concat(hit.path), depth + 1);
        return kindName === 'include' ? '\n' + body + '\n' : ' ' + body + ' ';
      });
    }

    var mainText = readFile(mainPath);
    if (mainText == null) throw new Error('File not found: ' + mainPath);
    var source = expand(mainPath, mainText, rootDir, [mainPath], 0);
    return { source: source, files: files, missing: missing };
  }

  var MAIN_NAMES = ['main.tex', 'ms.tex', 'paper.tex', 'manuscript.tex', 'article.tex', 'thesis.tex'];

  /**
   * Pick the main .tex file from a list of paths: one with \documentclass and
   * \begin{document}, preferring common names and then the shallowest path.
   * @returns {string|null}
   */
  function findMainFile(paths, readFile) {
    var best = null, bestScore = -Infinity;
    paths.forEach(function (p) {
      if (!/\.(tex|ltx|latex)$/i.test(p)) return;
      var text = readFile(p);
      if (text == null) return;
      var src = stripComments(String(text));
      var hasClass = /\\documentclass\b/.test(src), hasBody = /\\begin\s*\{document\}/.test(src);
      if (!hasClass && !hasBody) return;
      var name = p.split('/').pop().toLowerCase();
      var score = (hasClass ? 100 : 0) + (hasBody ? 100 : 0) + (MAIN_NAMES.indexOf(name) >= 0 ? 20 : 0) - 5 * (normPath(p).split('/').length - 1);
      if (score > bestScore || (score === bestScore && p < best)) { best = p; bestScore = score; }
    });
    return best;
  }

  /** Format a result the way TeXCount prints it. */
  function formatReport(r) {
    var lines = [
      'Sum count: ' + r.sum,
      'Words in text: ' + r.text,
      'Words in headers: ' + r.headerWords,
      'Words outside text (captions, etc.): ' + r.captionWords,
      'Number of headers: ' + r.headers,
      'Number of floats/tables/figures: ' + r.floats,
      'Number of math inlines: ' + r.inlineMath,
      'Number of math displayed: ' + r.displayMath
    ];
    if (r.abstractWords) lines.push('Words in abstract (included in text): ' + r.abstractWords);
    var left = [];
    if (r.options && r.options.excludeAbstract) left.push('abstract');
    if (r.options && r.options.excludeCaptions) left.push('captions');
    if (left.length) lines.push('Left out of the sum: ' + left.join(', '));
    if (r.sections.length > 1) {
      lines.push('Subcounts:', '  text+headers+captions (#headers/#floats/#inlines/#displayed)');
      r.sections.forEach(function (s) {
        lines.push('  ' + s.text + '+' + s.headerWords + '+' + s.captionWords + ' (' + s.headers + '/' + s.floats + '/' + s.inlineMath + '/' + s.displayMath + ') ' + s.title);
      });
    }
    return lines.join('\n');
  }

  var api = {
    version: VERSION, count: count, formatReport: formatReport, countWords: countWords, stripComments: stripComments,
    expandInputs: expandInputs, findMainFile: findMainFile, normPath: normPath
  };

  // Command-line use: node texcount.js paper.tex|folder [options]
  if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
    var fs = require('fs'), path = require('path');
    var args = process.argv.slice(2);
    var has = function (f) { return args.indexOf(f) >= 0; };
    var target = args.filter(function (a) { return a.charAt(0) !== '-'; })[0];
    if (!target || has('--help')) {
      console.log([
        'LibreLeaf TeXCount ' + VERSION,
        'Usage: node texcount.js main.tex|folder [options]',
        '  --json         print the result as JSON',
        '  --no-inputs    do not follow \\input, \\include and \\import',
        '  --no-abstract  leave the abstract out of the sum',
        '  --no-captions  leave captions out of the sum',
        'Lines between %TC:ignore and %TC:endignore are not counted.'
      ].join('\n'));
      process.exit(target ? 0 : 1);
    }
    var opts = { excludeAbstract: has('--no-abstract'), excludeCaptions: has('--no-captions') };
    var abs = path.resolve(target), root, main;
    if (fs.statSync(abs).isDirectory()) {
      root = abs;
      var all = [];
      (function walkDir(d) {
        fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
          var p = path.join(d, e.name);
          if (e.isDirectory()) { if (e.name.charAt(0) !== '.' && e.name !== 'node_modules') walkDir(p); }
          else all.push(path.relative(root, p).split(path.sep).join('/'));
        });
      })(root);
      main = findMainFile(all, function (p) { return fs.readFileSync(path.join(root, p), 'utf8'); });
      if (!main) { console.error('No main .tex file (with \\documentclass) found in ' + target); process.exit(1); }
    } else {
      root = path.dirname(abs);
      main = path.basename(abs);
    }
    var readFile = function (p) {
      var f = path.join(root, p);
      try { return fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null; } catch (e) { return null; }
    };
    var project = has('--no-inputs') ? { source: readFile(main), files: [main], missing: [] } : expandInputs(main, readFile);
    var result = Object.assign(count(project.source, opts), { files: project.files, missing: project.missing });
    if (has('--json')) console.log(JSON.stringify(result, null, 2));
    else {
      if (project.files.length > 1) console.error('Files: ' + project.files.join(', '));
      if (project.missing.length) console.error('Not found: ' + project.missing.join(', '));
      console.log(formatReport(result));
    }
  }

  return api;
});
