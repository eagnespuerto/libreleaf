# Changelog

## v0.0.2 (alpha), 2026-10-28

Polish and a better word counter.

- **Closer to TeXCount.** Checked against TeXCount 3.1.1 on 23 recent arXiv
  papers: 19 now agree within 1%, and 12 within 0.1%. The rest differ for
  known reasons, listed in [docs/texcount-comparison.md](docs/texcount-comparison.md).
  - Footnotes now count outside the text, with captions, as in TeXCount.
  - The abstract's heading counts as a heading.
  - In figures and tables, maths outside the caption isn't counted, and
    `tabular` contents are skipped everywhere.
  - `\LaTeX`, `\TeX`, `\url` (with hyperref) and `\cite` options follow
    TeXCount's rules.
- **Projects with several files in the browser.** Open a folder or a .zip (an
  Overleaf download works). The main file is found, and `\input`, `\include`,
  `\subfile`, `\import` and `\subimport` are followed.
- **Counter options.** Leave the abstract, or captions and footnotes, out of the
  sum. Count only the part of the source you select. Lines between
  `%TC:ignore` and `%TC:endignore` are skipped.
- **Command line.** Give it a project folder. New options: `--no-abstract`,
  `--no-captions` and `--math-words` (TeXCount's `-sum`). Included files are
  now found relative to the main file, as TeX does.
- **Logo.** The empty space around the logo files is cropped, so it shows at
  full size in the page header.
- **Project.** Tests run on GitHub Actions. Issue forms, CONTRIBUTING.md and a
  code of conduct (Contributor Covenant 2.1).

## v0.0.1 (alpha), 2026-10-21

First public release.

- **Word counter:** LibreLeaf TeXCount, a word counter for LaTeX that follows
  TeXCount's rules. It works in the browser and from the command line.
  - Separate counts for text, headings and captions, plus the abstract
  - Counts of inline and displayed maths, headings and floats
  - A per-section breakdown
  - In the browser, a check against a journal's word limit
  - From the command line, `\input` and `\include` are followed
- **Website:** GitHub Pages site with the word counter, in light and dark mode
  using the brand palette.
- **Docs:** product spec, design notes, and the brand kit (logo, favicons,
  palette page).
