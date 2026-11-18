import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize, coverage, editorNormalize } from './latex.js';

const PAPER = String.raw`\documentclass{article}
\usepackage{amsmath}
\title{A Study of Variable Stars}
\begin{document}
\maketitle

\section{Introduction}
Amateur photometry is \textbf{precise}~\cite{smith2021}. % a comment
The period is $P = 0.5$ days, a 10\% change.\footnote{See \emph{Table 1}.}

\begin{equation}
P(t) = P_0 + \beta t \label{eq:p}
\end{equation}

\subsection*{Notes}
\begin{itemize}
  \item First \emph{and} \textsc{second}.
  \item Third.
\end{itemize}

\end{document}
`;

test('round trip gives back the same bytes', () => {
  assert.equal(serialize(parse(PAPER)), PAPER);
});

test('body text becomes editable nodes', () => {
  const doc = parse(PAPER);
  const types = doc.content.map(n => n.type);
  assert.deepEqual(types, ['rawBlock', 'paragraph', 'heading', 'paragraph', 'rawBlock', 'heading', 'bulletList', 'rawBlock']);
  const h = doc.content[2];
  assert.equal(h.attrs.level, 1);
  assert.equal(h.content[0].text, 'Introduction');
  const p = doc.content[3].content;
  assert.ok(p.some(n => n.type === 'text' && n.marks?.[0].type === 'bold' && n.text === 'precise'));
  assert.ok(p.some(n => n.type === 'footnote' && n.attrs.latex === 'See \\emph{Table 1}.'));
  assert.ok(p.some(n => n.type === 'text' && n.text.includes('10% change')));
  assert.equal(doc.content[5].attrs.star, true);
  assert.equal(doc.content[6].content.length, 2);
});

test('nested marks in the other order stay verbatim', () => {
  const src = 'a \\emph{\\textbf{b}} c\n';
  assert.equal(serialize(parse(src)), src);
  const src2 = 'a \\textbf{\\emph{b}} c\n';
  const doc = parse(src2);
  assert.deepEqual(doc.content[0].content[1].marks.map(m => m.type), ['bold', 'italic']);
  assert.equal(serialize(doc), src2);
});

test('\\textit is remembered, not turned into \\emph', () => {
  const src = 'x \\textit{y} z\n';
  assert.equal(serialize(parse(src)), src);
});

test('bare special characters are kept raw', () => {
  const src = 'a_b & c^d # e { f } g\n';
  assert.equal(serialize(parse(src)), src);
});

test('lists with options or nesting stay raw', () => {
  const src = '\\begin{itemize}\n\\item[a] x\n\\end{itemize}\n';
  const doc = parse(src);
  assert.equal(doc.content[0].type, 'rawBlock');
  assert.equal(serialize(doc), src);
});

test('typed text is escaped on export', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: '50% of A&B cost $5 ' },
    { type: 'text', text: 'now', marks: [{ type: 'italic' }] },
  ] }] };
  assert.equal(serialize(doc), '50\\% of A\\&B cost \\$5 \\emph{now}\n');
});

test('coverage counts raw LaTeX against the total', () => {
  const c = coverage(parse(PAPER));
  assert.ok(c.editable > 0.2 && c.editable < 0.6, String(c.editable));
});

test('editor round trip keeps the text up to whitespace', () => {
  const squash = s => s.replace(/\s+/g, ' ').trim();
  assert.equal(squash(serialize(editorNormalize(parse(PAPER)))), squash(PAPER));
});
