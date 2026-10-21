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

  var VERSION = '0.0.1';

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
    includegraphics: 1, input: 1, include: 1, includeonly: 1, subfile: 1,
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
    return { title: title, level: level, text: 0, headerWords: 0, captionWords: 0, otherWords: 0, headers: 0, floats: 0, inlineMath: 0, displayMath: 0 };
  }

  function Counter() {
    this.sections = [newSection('Front matter', -1)];
    this.cur = this.sections[0];
    this.abstractWords = 0;
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
      var before = this.cur.text;
      this.walk(inner, mode);
      this.abstractWords += this.cur.text - before;
      return after;
    }
    this.walk(inner, mode);
    return after;
  };

  function sumOf(sec) { return sec.text + sec.headerWords + sec.captionWords; }

  /**
   * Count words in a LaTeX source string.
   * @param {string} src LaTeX source
   * @returns {object} totals plus a per-section breakdown
   */
  function count(src) {
    src = normaliseAccents(stripComments(String(src).replace(/\r\n?/g, '\n')));
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
      return idx > 0 || sumOf(sec) || sec.headers || sec.floats || sec.inlineMath || sec.displayMath;
    }).map(function (sec) {
      return Object.assign({}, sec, { sum: sumOf(sec) });
    });
    var total = { text: 0, headerWords: 0, captionWords: 0, otherWords: 0, headers: 0, floats: 0, inlineMath: 0, displayMath: 0 };
    counter.sections.forEach(function (sec) { Object.keys(total).forEach(function (k) { total[k] += sec[k]; }); });
    return Object.assign({ version: VERSION, sum: total.text + total.headerWords + total.captionWords, abstractWords: counter.abstractWords }, total, { sections: sections });
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
    if (r.sections.length > 1) {
      lines.push('Subcounts:', '  text+headers+captions (#headers/#floats/#inlines/#displayed)');
      r.sections.forEach(function (s) {
        lines.push('  ' + s.text + '+' + s.headerWords + '+' + s.captionWords + ' (' + s.headers + '/' + s.floats + '/' + s.inlineMath + '/' + s.displayMath + ') ' + s.title);
      });
    }
    return lines.join('\n');
  }

  var api = { version: VERSION, count: count, formatReport: formatReport, countWords: countWords, stripComments: stripComments };

  // Command-line use: node texcount.js paper.tex [--json] [--no-inputs]
  if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
    var fs = require('fs'), path = require('path');
    var args = process.argv.slice(2);
    var file = args.filter(function (a) { return a.charAt(0) !== '-'; })[0];
    if (!file || args.indexOf('--help') >= 0) {
      console.log('LibreLeaf TeXCount ' + VERSION + '\nUsage: node texcount.js main.tex [--json] [--no-inputs]\n  --json       print the result as JSON\n  --no-inputs  do not follow \\input and \\include');
      process.exit(file ? 0 : 1);
    }
    var expand = function (f, depth) {
      var text = stripComments(fs.readFileSync(f, 'utf8'));
      if (depth > 10 || args.indexOf('--no-inputs') >= 0) return text;
      return text.replace(/\\(input|include)\s*\{([^}]+)\}/g, function (m, kind, name) {
        var p = path.resolve(path.dirname(f), name.trim());
        if (!path.extname(p)) p += '.tex';
        return fs.existsSync(p) ? expand(p, depth + 1) : m;
      });
    };
    var result = count(expand(path.resolve(file), 0));
    console.log(args.indexOf('--json') >= 0 ? JSON.stringify(result, null, 2) : formatReport(result));
  }

  return api;
});
