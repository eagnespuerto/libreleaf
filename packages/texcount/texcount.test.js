'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { count, formatReport } = require('./texcount.js');

const PAPER = String.raw`\documentclass{article}
\usepackage{amsmath}
\title{A Study of Variable Stars}
\begin{document}
\maketitle
\begin{abstract}
We measure three stars.
\end{abstract}
\section{Introduction}
Amateur photometry is precise~\cite{smith2021}. % a comment with words
The period is $P = 0.5$ days, see Eq.~\eqref{eq:p}.
\begin{equation}
P(t) = P_0 + \beta t \label{eq:p}
\end{equation}
\section{Results}
Schr\"odinger's cat\footnote{Not a real cat.} ignores 50\% of data.
\begin{figure}[htbp]
\centering
\includegraphics[width=\linewidth]{lc.png}
\caption{Light curve of RR Lyr.}
\label{fig:lc}
\end{figure}
Line one\\[2pt] line two.
\begin{verbatim}
ignored words here
\end{verbatim}
\[ E = mc^2 \]
\end{document}
`;

test('counts a full paper like TeXCount', () => {
  const r = count(PAPER);
  assert.equal(r.text, 28);
  assert.equal(r.headerWords, 7);
  assert.equal(r.captionWords, 5);
  assert.equal(r.sum, 40);
  assert.equal(r.headers, 3);
  assert.equal(r.floats, 1);
  assert.equal(r.inlineMath, 1);
  assert.equal(r.displayMath, 2);
  assert.equal(r.abstractWords, 4);
});

test('gives a per-section breakdown', () => {
  const r = count(PAPER);
  assert.deepEqual(r.sections.map((s) => [s.title, s.text, s.headerWords, s.captionWords]), [
    ['Front matter', 4, 5, 0],
    ['Section: Introduction', 10, 1, 0],
    ['Section: Results', 14, 1, 5],
  ]);
  assert.match(formatReport(r), /^Sum count: 40$/m);
  assert.match(formatReport(r), /^ {2}14\+1\+5 \(1\/1\/0\/1\) Section: Results$/m);
});

test('works on a fragment without \\begin{document}', () => {
  assert.equal(count('Hello {T}he world').sum, 3);
});

test('skips URLs but counts link text', () => {
  assert.equal(count('Visit \\href{https://example.org}{our site} or \\url{https://x.org}.').text, 4);
});

test('counts only captions inside floats', () => {
  const r = count('\\begin{table}\\caption{Data}\\begin{tabular}{lr} a & b \\\\ \\end{tabular}\\end{table}');
  assert.equal(r.captionWords, 1);
  assert.equal(r.text, 0);
  assert.equal(r.otherWords, 2);
  assert.equal(r.floats, 1);
});

test('ignores macro definitions and keeps escaped percent signs', () => {
  assert.equal(count('\\newcommand{\\foo}[1]{bar #1} text').text, 1);
  assert.equal(count('Up 5\\% today % not this').text, 3);
});

test('keeps accented and special letters inside one word', () => {
  assert.equal(count('Erd\\H{o}s and M\\o ller and Stra\\ss e').text, 5);
});
