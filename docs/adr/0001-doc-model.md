# ADR 0001: Document model

*Status: **accepted** (2026-11-18). Decides SPEC §3 and roadmap week 2.*

## The question

What is the master copy of a paper: the LaTeX text, or a structured document?

- **Option A.** The LaTeX text is the master copy. The visual editor draws on
  top of it, the way Overleaf's Visual Editor does.
- **Option C.** A structured document (ProseMirror/Tiptap JSON) is the master
  copy for body text. The preamble, maths, floats and any LaTeX the editor
  doesn't know are kept word for word in raw-LaTeX blocks, and edited as text.

(Option B, a structured document with no raw blocks, was ruled out in SPEC §3
because it loses LaTeX it doesn't understand.)

## What we built

- `packages/doc-model/latex.js`: option C. `parse()` turns a `.tex` file into
  Tiptap JSON and `serialize()` turns it back. It knows sections (1–3 levels,
  starred too), paragraphs, `itemize` and `enumerate`, `\textbf`, `\emph`,
  `\textit`, `\textsc`, `\footnote`, `~` and the escaped characters
  `\% \& \_ \# \$ \{ \}`. Everything else becomes a `rawBlock` or a `rawInline`
  node with the exact source text. The whitespace between blocks is kept in a
  `sep` attribute.
- `packages/doc-model/roundtrip.js`: runs both options over a folder of
  projects and prints the table below. Option A is the identity (the text is
  never converted), so it is always exact. What it can *show* visually is the
  same set of constructs that option C recognises, so the "editable" columns
  apply to both.
- `apps/web`: a draft word processor on option C, to try editing for real.

## Results

The week-1 arXiv sources were not kept on disk, and arXiv's `robots.txt`
does not allow scripted downloads of `/e-print`. So this run uses 21 local
papers instead: four of our own notes (RNAAS and Zenodo) and 17 journal
templates and samples that ship with TeX Live 2026 (AASTeX, REVTeX, IEEEtran,
elsarticle, MNRAS, amsart, SPIE, Kluwer and others).

```
npm run roundtrip -- ~/libreleaf-corpus-local
```

| | A | C |
|---|---|---|
| Files that come back byte for byte | 21 / 21 | **21 / 21** |
| Files that come back the same after editing (whitespace aside) | — | **21 / 21** |
| Share of the document body that is editable as text | same as C | **44.7%** (36–59% on our four notes) |
| Time to parse and save all 21 files | 0 | 53 ms |

Notes:

- "After editing" means what the editor does on load: line breaks inside a
  paragraph become spaces, and blank lines between blocks are made uniform.
  LaTeX treats both the same, so the PDF does not change.
- The editable share is low on some templates (0–5%). They are mostly
  comments and a long preamble with little body text, or they wrap the whole
  body in one environment (Kluwer's `\begin{article}`). That is correct
  behaviour: those parts stay raw.
- In our own papers, most of the raw share is maths, `\cite`/`\ref`, figures
  and tables. Those are week 4 (MathLive, citations, the figure wizard), so the
  editable share will rise as the editor learns them.
- Mixed nesting such as `\emph{\textbf{x}}` is kept raw rather than
  re-ordered, so the round trip stays exact.

## Decision

**Use option C**, as SPEC §3 recommended going in.

- It round-trips every file we tried, byte for byte, so it loses nothing.
- It gives a real word-processor page, which is the point of LibreLeaf.
  Option A would need its own visual layer over the text, and it would never
  feel like a word processor for the people we are building for.
- Raw blocks give a safe way in for anything new: the editor can learn one
  construct at a time without risking the rest of the file.

## What this costs us

- Two-way sync with a source view needs a re-parse when someone edits the
  LaTeX directly. For now the source view is read-only.
- Git diffs of a paper saved from the editor can show re-wrapped paragraphs.
  We keep `sep` so untouched blocks don't move, and later we can keep the
  original line breaks of unedited paragraphs too.
- Before v0.2.0 we should rerun the harness on 50 arXiv papers (SPEC 0.2).
  The sources need to be downloaded by hand, since arXiv doesn't allow it by
  script.
