'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { count, formatReport, expandInputs, findMainFile } = require('./texcount.js');

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

// The expected numbers are real TeXCount 3.1.1 output for PAPER.
test('counts a full paper like TeXCount', () => {
  const r = count(PAPER);
  assert.equal(r.text, 24);
  assert.equal(r.headerWords, 8, 'the abstract adds one heading word');
  assert.equal(r.captionWords, 9, 'the footnote counts outside the text, with captions');
  assert.equal(r.sum, 41);
  assert.equal(r.headers, 4);
  assert.equal(r.floats, 1);
  assert.equal(r.inlineMath, 1);
  assert.equal(r.displayMath, 2);
  assert.equal(r.abstractWords, 4);
});

test('gives a per-section breakdown', () => {
  const r = count(PAPER);
  assert.deepEqual(r.sections.map((s) => [s.title, s.text, s.headerWords, s.captionWords]), [
    ['Front matter', 4, 6, 0],
    ['Section: Introduction', 10, 1, 0],
    ['Section: Results', 10, 1, 9],
  ]);
  assert.match(formatReport(r), /^Sum count: 41$/m);
  assert.match(formatReport(r), /^ {2}10\+1\+9 \(1\/1\/0\/1\) Section: Results$/m);
});

test('works on a fragment without \\begin{document}', () => {
  assert.equal(count('Hello {T}he world').sum, 3);
});

test('skips URLs but counts link text', () => {
  assert.equal(count('Visit \\href{https://example.org}{our site} or \\url{https://x.org}.').text, 4);
});

test('counts only captions inside floats, and skips tabular', () => {
  const r = count(String.raw`\begin{table}\caption{Data $n$}\begin{tabular}{lr} a & $b$ \\ \end{tabular} $c$ \end{table}`);
  assert.equal(r.captionWords, 1);
  assert.equal(r.text, 0);
  assert.equal(r.otherWords, 0);
  assert.equal(r.floats, 1);
  assert.equal(r.inlineMath, 1, 'only maths in the caption counts');
  assert.equal(count(String.raw`Text \begin{tabular}{c} cell words \end{tabular}`).text, 1);
});

test('ignores macro definitions and keeps escaped percent signs', () => {
  assert.equal(count('\\newcommand{\\foo}[1]{bar #1} text').text, 1);
  assert.equal(count('Up 5\\% today % not this').text, 3);
});

test('keeps accented and special letters inside one word', () => {
  assert.equal(count('Erd\\H{o}s and M\\o ller and Stra\\ss e').text, 5);
});

test('can leave the abstract or the captions out of the sum', () => {
  const r = count(PAPER, { excludeAbstract: true });
  assert.equal(r.sum, 37);
  assert.equal(r.text, 24, 'text still includes the abstract');
  assert.equal(count(PAPER, { excludeCaptions: true }).sum, 32);
  assert.equal(count(PAPER, { excludeAbstract: true, excludeCaptions: true }).sum, 28);
  assert.equal(r.sections[0].sum, 6);
  assert.match(formatReport(r), /^Left out of the sum: abstract$/m);
  assert.equal(count(PAPER, { mathAsWords: true }).sum, 44, 'TeXCount -sum adds one per maths item');
});

test('follows other TeXCount rules', () => {
  assert.equal(count(String.raw`Use \LaTeX{} and \TeX.`).text, 4);
  assert.equal(count(String.raw`As shown \citep[p.~5]{key}.`).text, 4);
  assert.equal(count(String.raw`As shown \citep[see also][chap two]{key}.`).text, 4, 'only the first option counts');
  assert.equal(count(String.raw`See \cref{sec:a} and \parencite{doe}.`).text, 2);
  const fn = count(String.raw`Body\footnote{Note words here.} text.`);
  assert.deepEqual([fn.text, fn.captionWords], [2, 3]);
  const linked = String.raw`\documentclass{article}\usepackage[colorlinks]{hyperref}\begin{document}Go to \url{https://x.org/a-b}.\end{document}`;
  assert.equal(count(linked).text, 3, 'with hyperref a URL is one word');
  assert.equal(count(String.raw`Go to \url{https://x.org/a-b}.`).text, 2);
});

test('skips %TC:ignore blocks', () => {
  assert.equal(count('one two\n%TC:ignore\nthree four\n% TC:endignore\nfive').text, 3);
});

function project(files) {
  return (p) => (Object.prototype.hasOwnProperty.call(files, p) ? files[p] : null);
}

test(String.raw`follows \input relative to the main file, like TeX`, () => {
  const read = project({
    'paper/main.tex': String.raw`\begin{document}\input{sec/intro}
\include{sec/end}
% \input{sec/skipped}
\end{document}`,
    'paper/sec/intro.tex': String.raw`Intro words here. \input{sec/nested}`,
    'paper/sec/nested.tex': 'Nested text.',
    'paper/sec/end.tex': 'The end.',
    'paper/sec/skipped.tex': 'should not count',
  });
  const p = expandInputs('paper/main.tex', read);
  assert.deepEqual(p.files, ['paper/main.tex', 'paper/sec/intro.tex', 'paper/sec/nested.tex', 'paper/sec/end.tex']);
  assert.deepEqual(p.missing, []);
  assert.equal(count(p.source).text, 7);
});

test(String.raw`handles \subimport, bare \input, missing files and loops`, () => {
  const read = project({
    'main.tex': String.raw`\input chap/a \subimport{chap/}{b} \input{nope} \input{main}`,
    'chap/a.tex': 'Alpha.',
    'chap/b.tex': String.raw`Beta \input{c}`,
    'chap/c.tex': 'Gamma.',
  });
  const p = expandInputs('main.tex', read);
  assert.deepEqual(p.missing, ['nope']);
  assert.equal(count(p.source).text, 3);
});

test('finds the main file in a project', () => {
  const read = project({
    'figs/plot.tex': String.raw`\begin{tikzpicture}\end{tikzpicture}`,
    'sections/intro.tex': 'Text',
    'standalone/fig.tex': String.raw`\documentclass{standalone}\begin{document}x\end{document}`,
    'main.tex': String.raw`\documentclass{article}\begin{document}\input{sections/intro}\end{document}`,
  });
  assert.equal(findMainFile(['figs/plot.tex', 'sections/intro.tex', 'standalone/fig.tex', 'main.tex'], read), 'main.tex');
  assert.equal(findMainFile(['sections/intro.tex'], read), null);
});
