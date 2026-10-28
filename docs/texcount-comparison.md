# LibreLeaf TeXCount vs. TeXCount

*Checked 2026-10-28 for v0.0.2, against TeXCount 3.1.1 from TeX Live 2026.*

We ran the LaTeX sources of 23 recent arXiv papers through both counters. They
cover astrophysics, maths, computer science, physics, biology, economics and
general relativity, and range from one file to 28 files. TeXCount was run as
`texcount -merge -utf8 -sum main.tex`. LibreLeaf was run on the project folder
with `--math-words`, so both sums count each maths item as one word.

**Result: 19 of 23 papers agree within 1%, and 12 agree within 0.1%.** Each of
the other four has a known cause, listed below.

Before this check, most papers were 3–16% apart. The fixes, all in v0.0.2:

- TeXCount's `-sum` adds one word per maths item. LibreLeaf keeps maths out of
  its sum by default, as Overleaf does, and `--math-words` (or
  `{ mathAsWords: true }`) gives TeXCount's number.
- The abstract counts as one heading with one heading word ("Abstract").
- Footnotes count as words outside the text, with captions, not as text.
- In figures and tables, maths outside the caption isn't counted.
- The contents of `tabular`, `tabular*` and `tabbing` are skipped, even outside
  a float.
- `\LaTeX` and `\TeX` count as one word each. With `hyperref` loaded, each
  `\url` counts as one word.
- The first optional argument of `\cite`-style commands counts as text, so
  "see" in `\citep[see][]{key}` is counted.
- `\author`, `\date`, `\parbox` widths and several layout commands are skipped.

## Per paper

Text, headings and captions are shown as ours / TeXCount's.

| arXiv ID | Files | Sum (ours) | Sum (TeXCount) | Diff | Text | Headings | Captions | Why |
|---|--:|--:|--:|--:|--:|--:|--:|---|
| [2610.34643](https://arxiv.org/abs/2610.34643) | 1 | 17,792 | 11,356 | +56.7% | 13,852 / 9,701 | 189 / 98 | 2,726 / 1,062 | TeXCount parse error |
| [2610.35161](https://arxiv.org/abs/2610.35161) | 1 | 2,795 | 2,795 | +0.0% | 2,354 / 2,354 | 20 / 20 | 316 / 316 |  |
| [2610.37004](https://arxiv.org/abs/2610.37004) | 1 | 5,593 | 5,593 | +0.0% | 5,119 / 5,119 | 27 / 27 | 295 / 295 |  |
| [2610.37306](https://arxiv.org/abs/2610.37306) | 1 | 4,299 | 4,290 | +0.2% | 3,825 / 3,816 | 66 / 66 | 363 / 363 |  |
| [2610.37512](https://arxiv.org/abs/2610.37512) | 1 | 3,968 | 3,961 | +0.2% | 3,319 / 3,312 | 30 / 30 | 0 / 0 |  |
| [2610.37540](https://arxiv.org/abs/2610.37540) | 1 | 5,749 | 5,789 | -0.7% | 5,267 / 5,307 | 21 / 21 | 300 / 300 |  |
| [2610.37569](https://arxiv.org/abs/2610.37569) | 1 | 15,219 | 15,219 | +0.0% | 13,488 / 13,488 | 164 / 164 | 443 / 443 |  |
| [2610.37574](https://arxiv.org/abs/2610.37574) | 1 | 7,737 | 7,744 | -0.1% | 6,193 / 6,195 | 60 / 60 | 1,076 / 1,081 |  |
| [2610.37586](https://arxiv.org/abs/2610.37586) | 1 | 15,192 | 15,434 | -1.6% | 13,477 / 13,714 | 200 / 209 | 803 / 803 | `\url`, `longtable` column specs |
| [2610.37591](https://arxiv.org/abs/2610.37591) | 1 | 8,862 | 8,868 | -0.1% | 7,052 / 7,063 | 150 / 150 | 1,227 / 1,222 |  |
| [2610.37614](https://arxiv.org/abs/2610.37614) | 1 | 4,866 | 4,869 | -0.1% | 4,104 / 4,107 | 33 / 33 | 30 / 30 |  |
| [2610.37615](https://arxiv.org/abs/2610.37615) | 1 | 3,957 | 3,958 | -0.0% | 3,520 / 3,521 | 32 / 32 | 215 / 215 |  |
| [2610.37616](https://arxiv.org/abs/2610.37616) | 2 | 5,751 | 5,753 | -0.0% | 4,823 / 4,819 | 35 / 35 | 71 / 77 |  |
| [2610.37617](https://arxiv.org/abs/2610.37617) | 4 | 11,005 | 11,021 | -0.1% | 9,401 / 9,405 | 109 / 109 | 862 / 874 |  |
| [2610.37638](https://arxiv.org/abs/2610.37638) | 1 | 6,473 | 6,476 | -0.0% | 5,557 / 5,560 | 80 / 80 | 428 / 428 |  |
| [2610.37646](https://arxiv.org/abs/2610.37646) | 1 | 7,574 | 7,584 | -0.1% | 6,316 / 6,318 | 95 / 95 | 615 / 623 |  |
| [2610.37650](https://arxiv.org/abs/2610.37650) | 1 | 27,713 | 27,795 | -0.3% | 23,456 / 23,539 | 126 / 126 | 0 / 0 |  |
| [2610.37651](https://arxiv.org/abs/2610.37651) | 11 | 9,387 | 9,083 | +3.3% | 8,346 / 8,356 | 127 / 127 | 862 / 538 | `\captionof` in figures |
| [2610.37657](https://arxiv.org/abs/2610.37657) | 26 | 11,742 | 12,468 | -5.8% | 10,068 / 10,737 | 169 / 169 | 1,348 / 1,363 | mostly `\cref` labels |
| [2610.37658](https://arxiv.org/abs/2610.37658) | 1 | 29,229 | 29,230 | -0.0% | 24,125 / 24,143 | 612 / 612 | 3,354 / 3,337 |  |
| [2610.37660](https://arxiv.org/abs/2610.37660) | 1 | 4,417 | 4,417 | +0.0% | 3,874 / 3,874 | 38 / 38 | 133 / 133 |  |
| [2610.37661](https://arxiv.org/abs/2610.37661) | 1 | 11,108 | 11,123 | -0.1% | 9,484 / 9,498 | 66 / 66 | 1,163 / 1,164 |  |
| [2610.37668](https://arxiv.org/abs/2610.37668) | 28 | 12,881 | 12,880 | +0.0% | 11,197 / 11,196 | 234 / 234 | 1,092 / 1,092 |  |

## Known differences

These are places where LibreLeaf deliberately doesn't copy TeXCount. In each,
TeXCount counts something that isn't prose.

- **Cross-reference and biblatex keys.** TeXCount has no rules for cleveref or
  biblatex, so it counts `sec:method` in `\cref{sec:method}` and `doe2020` in
  `\parencite{doe2020}` as words. LibreLeaf skips them, as it does for `\ref`
  and `\cite`.
- **URLs without an explicit package.** If `url` or `hyperref` isn't loaded with
  `\usepackage` (some journal classes load it themselves), TeXCount counts each
  piece of a URL as a word. LibreLeaf skips the URL, or counts it as one word
  when `hyperref` is loaded.
- **Table column specs.** TeXCount counts numbers in the column spec of
  `longtable` and `tabularx` (such as `p{0.22\linewidth}`) as words. LibreLeaf
  skips the spec.
- **`\captionof`.** Inside a figure TeXCount counts only `\caption`, so captions
  made with `\captionof` in a minipage are lost. LibreLeaf counts them as
  captions.
- **amsmath environments.** TeXCount only knows `equation`, `align`,
  `eqnarray` and `displaymath`, so it counts the contents of `gather`,
  `multline`, `flalign` and `alignat` as words. LibreLeaf counts them as
  displayed maths.
- **Parse errors.** In 2610.34643 the bibliography redefines `\url`, which
  TeXCount misreads. It then treats the rest of the file (about 580 lines of
  supplementary material) as bibliography and skips it. LibreLeaf counts it.

## Reproducing

The scripts aren't in the repository, since they download arXiv sources. In
outline: list recent papers per category with the arXiv API, download
`https://arxiv.org/e-print/<id>` 3 seconds apart, unpack, then run both counters
as above and compare the fields of `--json` output with TeXCount's report.
