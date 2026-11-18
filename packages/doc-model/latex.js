/*!
 * LibreLeaf doc-model — LaTeX <-> structured document (option C, SPEC §3).
 * Copyright (C) 2026 Ella Agnes Puerto. AGPL-3.0-or-later.
 *
 * The document is ProseMirror/Tiptap JSON. Body text the editor understands
 * (headings, paragraphs, lists, bold, italic, small caps, footnotes) becomes
 * editable nodes. Everything else (the preamble, maths, floats, unknown
 * macros) is kept verbatim in `rawBlock` / `rawInline` nodes, so nothing is
 * lost. Whitespace between blocks is kept in a `sep` attribute, so
 * parse -> serialize gives back the same bytes for anything we recognise.
 */

const HEADINGS = { section: 1, subsection: 2, subsubsection: 3 };
const LISTS = { itemize: 'bulletList', enumerate: 'orderedList' };
// Mark name -> LaTeX command used when the mark has no `cmd` attribute.
const MARK_CMD = { bold: 'textbf', italic: 'emph', smallCaps: 'textsc' };
const CMD_MARK = { textbf: 'bold', emph: 'italic', textit: 'italic', textsc: 'smallCaps' };
// Fixed order for opening marks, so output is stable.
const MARK_ORDER = ['bold', 'italic', 'smallCaps'];
const ESCAPES = '%&_#${}';

// ---------------------------------------------------------------- scanning

/** Index just past the brace group that starts at s[i] === '{', or -1. */
function matchBrace(s, i, open = '{', close = '}') {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    if (c === '%' && open === '{') { const nl = s.indexOf('\n', j); if (nl < 0) return -1; j = nl; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j + 1;
  }
  return -1;
}

/** Index just past `\end{name}` matching a `\begin{name}` that ends at i. */
function matchEnv(s, i, name) {
  const begin = '\\begin{' + name + '}', end = '\\end{' + name + '}';
  let depth = 1, j = i;
  while (j < s.length) {
    const b = s.indexOf(begin, j), e = s.indexOf(end, j);
    if (e < 0) return -1;
    if (b >= 0 && b < e) { depth++; j = b + begin.length; continue; }
    if (--depth === 0) return e + end.length;
    j = e + end.length;
  }
  return -1;
}

/** Name and end index of a control word or symbol at s[i] === '\\'. */
function readCommand(s, i) {
  const m = /^\\([A-Za-z@]+\*?|.)/s.exec(s.slice(i, i + 64));
  return m ? { name: m[1], end: i + m[0].length } : { name: '', end: i + 1 };
}

/** Skip optional [..] and mandatory {..} arguments after a command. */
function skipArgs(s, i) {
  for (;;) {
    let j = i;
    while (s[j] === ' ' || s[j] === '\t') j++;
    if (s[j] === '{') { const k = matchBrace(s, j); if (k < 0) return i; i = k; continue; }
    if (s[j] === '[') { const k = matchBrace(s, j, '[', ']'); if (k < 0) return i; i = k; continue; }
    return i;
  }
}

function leadingSpace(s, i) {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  return j;
}

// ---------------------------------------------------------------- inline

function raw(latex, marks) {
  const node = { type: 'rawInline', attrs: { latex } };
  if (marks.length) node.marks = marks.slice();
  return node;
}

function pushText(out, text, marks) {
  const last = out[out.length - 1];
  if (last && last.type === 'text' && sameMarks(last.marks || [], marks)) { last.text += text; return; }
  const node = { type: 'text', text };
  if (marks.length) node.marks = marks.slice();
  out.push(node);
}

function sameMarks(a, b) {
  return a.length === b.length && a.every((m, k) => m.type === b[k].type && (m.attrs?.cmd ?? null) === (b[k].attrs?.cmd ?? null));
}

/** Parse running text into inline nodes. */
export function parseInline(s, marks = [], out = []) {
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const nx = s[i + 1];
      if (nx && ESCAPES.includes(nx)) { pushText(out, nx, marks); i += 2; continue; }
      const { name, end } = readCommand(s, i);
      if (CMD_MARK[name] && s[end] === '{') {
        const close = matchBrace(s, end);
        if (close > 0 && !marks.some(m => m.type === CMD_MARK[name])) {
          const mark = { type: CMD_MARK[name] };
          if (MARK_CMD[mark.type] !== name) mark.attrs = { cmd: name };
          const inner = [...marks, mark].sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
          // Nesting order is not kept by marks; only accept the canonical order.
          if (inner[inner.length - 1] === mark) {
            const before = out.length;
            parseInline(s.slice(end + 1, close - 1), inner, out);
            if (out.length === before) out.push(raw(s.slice(i, close), marks)); // empty: keep verbatim
            i = close; continue;
          }
        }
      }
      if (name === 'footnote' && s[end] === '{') {
        const close = matchBrace(s, end);
        if (close > 0) {
          const node = { type: 'footnote', attrs: { latex: s.slice(end + 1, close - 1) } };
          if (marks.length) node.marks = marks.slice();
          out.push(node); i = close; continue;
        }
      }
      if (name === 'begin' && s[end] === '{') {
        const close = matchBrace(s, end);
        const stop = close > 0 ? matchEnv(s, close, s.slice(end + 1, close - 1)) : -1;
        if (stop > 0) { out.push(raw(s.slice(i, stop), marks)); i = stop; continue; }
      }
      if (name === '(') {
        const stop = s.indexOf('\\)', end);
        if (stop >= 0) { out.push(raw(s.slice(i, stop + 2), marks)); i = stop + 2; continue; }
      }
      const stop = /^[A-Za-z@]/.test(name) ? skipArgs(s, end) : end;
      out.push(raw(s.slice(i, stop), marks)); i = stop; continue;
    }
    if (c === '$') {
      const dbl = s[i + 1] === '$';
      let j = i + (dbl ? 2 : 1);
      for (; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === '$') break; }
      const stop = Math.min(s.length, j + (dbl ? 2 : 1));
      out.push(raw(s.slice(i, stop), marks)); i = stop; continue;
    }
    if (c === '%') {
      const nl = s.indexOf('\n', i);
      const stop = nl < 0 ? s.length : nl + 1;
      out.push(raw(s.slice(i, stop), marks)); i = stop; continue;
    }
    if (c === '{') {
      const close = matchBrace(s, i);
      const stop = close > 0 ? close : i + 1;
      out.push(raw(s.slice(i, stop), marks)); i = stop; continue;
    }
    if (c === '~') { pushText(out, ' ', marks); i++; continue; }
    if ('}&_^# '.includes(c)) { out.push(raw(c, marks)); i++; continue; }
    pushText(out, c, marks); i++;
  }
  return out;
}

// ---------------------------------------------------------------- blocks

const BLOCK_START = /^(\\(?:section|subsection|subsubsection|begin|end\{document\}|\[|item\b)|\$\$|%)/;

/** End of the paragraph that starts at i: a blank line or a block start. */
function paragraphEnd(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    if (c === '%') { const nl = s.indexOf('\n', j); if (nl < 0) return s.length; j = nl - 1; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth = Math.max(0, depth - 1);
    else if (c === '\n' && depth === 0) {
      let k = j + 1;
      while (s[k] === ' ' || s[k] === '\t') k++;
      if (s[k] === '\n' || s[k] === '\r' || k >= s.length) return trimEnd(s, i, j);
      if (BLOCK_START.test(s.slice(k, k + 16))) return trimEnd(s, i, j);
    }
  }
  return trimEnd(s, i, s.length);
}

function trimEnd(s, start, j) {
  while (j > start && /\s/.test(s[j - 1])) j--;
  return j;
}

function rawBlock(latex) {
  return { type: 'rawBlock', attrs: { latex, sep: '' } };
}

/** Try to read itemize/enumerate as an editable list. */
function parseList(s, i, name) {
  const head = '\\begin{' + name + '}';
  const stop = matchEnv(s, i + head.length, name);
  if (stop < 0) return null;
  const inner = s.slice(i + head.length, stop - ('\\end{' + name + '}').length);
  if (inner.includes('\\begin{') || inner.includes('\\item[')) return null;
  const parts = [];
  let depth = 0, last = -1;
  for (let j = 0; j < inner.length; j++) {
    const ch = inner[j];
    if (ch === '\\' && inner.startsWith('\\item', j) && !/[A-Za-z]/.test(inner[j + 5] || '') && depth === 0) {
      if (last < 0) { if (inner.slice(0, j).trim()) return null; parts.lead = inner.slice(0, j); }
      else parts.push(inner.slice(last, j));
      last = j + 5; j += 4; continue;
    }
    if (ch === '\\') { j++; continue; }
    if (ch === '%') { const nl = inner.indexOf('\n', j); if (nl < 0) break; j = nl; continue; }
    if (ch === '{') depth++; else if (ch === '}') depth--;
  }
  if (last < 0) return null;
  parts.push(inner.slice(last));
  const items = parts.map(p => {
    const a = leadingSpace(p, 0), b = trimEnd(p, a, p.length);
    const content = parseInline(p.slice(a, b));
    if (content.some(n => n.type === 'text' && n.text.includes('\n\n'))) return null;
    return { type: 'listItem', attrs: { pre: p.slice(0, a), sep: p.slice(b) },
      content: [{ type: 'paragraph', content }] };
  });
  if (items.some(x => !x)) return null;
  return { node: { type: LISTS[name], attrs: { lead: parts.lead, sep: '' }, content: items }, stop };
}

/** Parse a LaTeX body (or a whole file) into a list of block nodes. */
export function parseBlocks(s) {
  const blocks = [];
  let i = leadingSpace(s, 0);
  const lead = s.slice(0, i);
  while (i < s.length) {
    let node = null, stop = i;
    const rest = s.slice(i, i + 64);
    let m;
    if ((m = /^\\(section|subsection|subsubsection)(\*?)\{/.exec(rest))) {
      const open = i + m[0].length - 1, close = matchBrace(s, open);
      if (close > 0) {
        node = { type: 'heading', attrs: { level: HEADINGS[m[1]], star: m[2] === '*', sep: '' },
          content: parseInline(s.slice(open + 1, close - 1)) };
        stop = close;
      }
    } else if ((m = /^\\begin\{([^}]*)\}/.exec(rest))) {
      if (LISTS[m[1]]) { const got = parseList(s, i, m[1]); if (got) ({ node, stop } = got); }
      if (!node) {
        const end = matchEnv(s, i + m[0].length, m[1]);
        stop = end > 0 ? end : s.length;
        node = rawBlock(s.slice(i, stop));
      }
    } else if (rest.startsWith('\\[')) {
      const end = s.indexOf('\\]', i);
      stop = end < 0 ? s.length : end + 2; node = rawBlock(s.slice(i, stop));
    } else if (rest.startsWith('$$')) {
      const end = s.indexOf('$$', i + 2);
      stop = end < 0 ? s.length : end + 2; node = rawBlock(s.slice(i, stop));
    } else if (rest.startsWith('%')) {
      const nl = s.indexOf('\n', i);
      stop = nl < 0 ? s.length : nl; node = rawBlock(s.slice(i, stop));
    }
    if (!node) {
      stop = paragraphEnd(s, i);
      if (stop <= i) stop = Math.max(i + 1, s.indexOf('\n', i) < 0 ? s.length : s.indexOf('\n', i));
      const content = parseInline(s.slice(i, stop));
      node = { type: 'paragraph', attrs: { sep: '' }, content };
    }
    const next = leadingSpace(s, stop);
    node.attrs.sep = s.slice(stop, next);
    blocks.push(node);
    i = next;
  }
  return { lead, blocks };
}

/**
 * Parse a whole .tex file. The preamble (up to \begin{document}) and the
 * tail (from \end{document}) become raw blocks.
 */
export function parse(src) {
  const b = src.indexOf('\\begin{document}');
  const e = src.lastIndexOf('\\end{document}');
  let head = '', body = src, tail = '';
  if (b >= 0) {
    head = src.slice(0, b + '\\begin{document}'.length);
    const stop = e > b ? e : src.length;
    body = src.slice(head.length, stop);
    tail = src.slice(stop);
  }
  const { lead, blocks } = parseBlocks(body);
  const content = [];
  if (head) { const h = rawBlock(head); h.attrs.sep = lead; content.push(h); }
  content.push(...blocks);
  if (tail) content.push(rawBlock(tail));
  return { type: 'doc', attrs: { lead: head ? '' : lead }, content };
}

// ---------------------------------------------------------------- serialize

export function escapeText(t) {
  return t.replace(/[\\%&_#${}^~ ]/g, c =>
    c === '\\' ? '\\textbackslash{}' : c === '^' ? '\\textasciicircum{}' : c === '~' ? '\\textasciitilde{}'
      : c === ' ' ? '~' : '\\' + c);
}

function markKey(m) { return m.type + ':' + (m.attrs?.cmd ?? ''); }

export function serializeInline(nodes = []) {
  let out = '';
  const open = [];
  const closeTo = n => { while (open.length > n) { open.pop(); out += '}'; } };
  for (const node of nodes) {
    const marks = (node.marks || []).slice().sort((a, b) => MARK_ORDER.indexOf(a.type) - MARK_ORDER.indexOf(b.type));
    let k = 0;
    while (k < open.length && k < marks.length && markKey(open[k]) === markKey(marks[k])) k++;
    closeTo(k);
    for (; k < marks.length; k++) {
      const m = marks[k];
      if (!MARK_CMD[m.type]) continue;
      out += '\\' + (m.attrs?.cmd || MARK_CMD[m.type]) + '{';
      open.push(m);
    }
    if (node.type === 'text') out += escapeText(node.text);
    else if (node.type === 'rawInline') out += node.attrs.latex;
    else if (node.type === 'footnote') out += '\\footnote{' + node.attrs.latex + '}';
    else if (node.type === 'hardBreak') out += '\\\\\n';
  }
  closeTo(0);
  return out;
}

function sepOf(node, fallback) {
  const s = node.attrs?.sep;
  return s === undefined || s === null ? fallback : s;
}

export function serializeBlock(node) {
  switch (node.type) {
    case 'rawBlock': return node.attrs.latex;
    case 'paragraph': return serializeInline(node.content);
    case 'heading': {
      const name = Object.keys(HEADINGS).find(k => HEADINGS[k] === node.attrs.level) || 'subsubsection';
      return '\\' + name + (node.attrs.star ? '*' : '') + '{' + serializeInline(node.content) + '}';
    }
    case 'bulletList': case 'orderedList': {
      const env = node.type === 'bulletList' ? 'itemize' : 'enumerate';
      let out = '\\begin{' + env + '}' + (node.attrs?.lead ?? '\n');
      const items = node.content || [];
      items.forEach((item, k) => {
        const body = (item.content || []).map(serializeBlock).join(' ');
        out += '\\item' + (item.attrs?.pre ?? ' ') + body + (item.attrs?.sep ?? '\n');
      });
      return out + '\\end{' + env + '}';
    }
    default: return '';
  }
}

/** Serialize a document back to LaTeX. */
export function serialize(doc) {
  const blocks = doc.content || [];
  return (doc.attrs?.lead || '') + blocks.map((b, k) =>
    serializeBlock(b) + sepOf(b, k === blocks.length - 1 ? '\n' : '\n\n')).join('');
}

// ---------------------------------------------------------------- metrics

/** Characters of source kept as raw LaTeX, and the total, for coverage. */
export function coverage(doc, { bodyOnly = false } = {}) {
  let rawChars = 0, total = 0;
  const isFrame = n => n.type === 'rawBlock' && /\\(begin|end)\{document\}/.test(n.attrs.latex);
  const walk = n => {
    if (bodyOnly && isFrame(n)) return;
    if (n.type === 'rawBlock') { rawChars += n.attrs.latex.length; total += n.attrs.latex.length; return; }
    if (n.type === 'rawInline' || n.type === 'footnote') { const l = n.attrs.latex.length; rawChars += l; total += l; return; }
    if (n.type === 'text') { total += n.text.length; return; }
    (n.content || []).forEach(walk);
  };
  walk(doc);
  return { rawChars, total, editable: total ? 1 - rawChars / total : 1 };
}

/**
 * What the editor does to a document: whitespace inside paragraphs becomes
 * single spaces and the stored separators are dropped.
 */
export function editorNormalize(doc) {
  const clone = JSON.parse(JSON.stringify(doc));
  const walk = n => {
    if (n.type === 'text') n.text = n.text.replace(/[ \t\r\n]+/g, ' ');
    // An empty separator (`\section{X}\label{y}`) is meaningful; keep it.
    if (n.attrs && n.attrs.sep && n.type !== 'rawBlock') n.attrs.sep = null;
    if (n.attrs && 'pre' in n.attrs) n.attrs.pre = null;
    (n.content || []).forEach(walk);
  };
  walk(clone);
  return clone;
}
