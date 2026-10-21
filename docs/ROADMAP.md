# LibreLeaf — Feature Pipeline (Draft)

*Drafted 2026-10-21, right after v0.0.1. Covers about six weeks, to the end of
November 2026. Each item is sized for about one working session. Dates are
targets, not commitments: other projects come first.*

Scope follows [DESIGN.md](DESIGN.md) §4: **single-user first**, no real-time
collaboration. Every version is a branch, a PR and a tagged pre-release.

## At a glance

| Week | Dates | Version | Theme | Depends on the hosting decision? |
|---|---|---|---|---|
| 1 | Oct 21–26 | v0.0.2 | Polish and a better word counter | No |
| 2 | Oct 27–Nov 2 | — | Editor prototype and hosting research | No |
| 3 | Nov 3–9 | v0.1.0 | **Decide where it runs.** Editor shell with ribbon | Decision made this week |
| 4 | Nov 10–16 | v0.2.0 | Maths, citations, figures | No |
| 5 | Nov 17–23 | v0.3.0 | Compile to PDF and preview it | **Yes** |
| 6 | Nov 24–30 | v0.4.0 | Guidance layer v1, first deploy | **Yes** |

Weeks 1–4 run entirely in the browser and keep shipping on GitHub Pages, so
nothing waits for the hosting decision until week 5.

---

## Week 1: v0.0.2, polish and a better word counter

- [ ] **CI.** Run `gh auth refresh -s workflow`, then add a GitHub Actions
      workflow that runs `npm test` on every PR.
- [ ] **Logo crop.** Trim the empty space around the logo PNGs so the logo in
      the page header shows at full size.
- [ ] **Multi-file projects in the browser.** Open a folder or a .zip, and
      follow `\input`/`\include` the same way the command line does.
- [ ] **Check against real TeXCount.** Run 20 or more real arXiv sources through
      both TeXCount and our counter and record the differences. Fix the big ones
      and list the rest in the README.
- [ ] **More counter options.** Exclude the abstract or captions from the
      sum. Count words in a selected part only (for journals that count
      "main text" only).
- [ ] **Repo hygiene.** Issue templates ("wrong word count" asks for the .tex
      snippet), CONTRIBUTING.md, CODE_OF_CONDUCT.md.

**Done when:** CI is green, the per-file differences are documented, and you
can open a folder and count it.

## Week 2: editor prototype and hosting research (no release)

- [ ] **Prototype the document model (SPEC 0.2).** Build two throwaway versions:
      option A (the LaTeX text is the master copy) and option C (a structured
      document as the master copy, with raw-LaTeX blocks kept as-is). Measure
      how well each one round-trips the week-1 arXiv set.
      Record the result in `docs/adr/0001-doc-model.md`.
- [ ] **Project scaffold.** pnpm workspace, Vite, React and TypeScript in
      `apps/web`. The word counter becomes `packages/texcount`, published to the
      site as it is today.
- [ ] **Hosting research.** Write `docs/adr/0002-deployment.md`, comparing the
      options in the decision gate below. Prices, limits, and whether the
      compile sandbox is possible on each.

**Done when:** both decision records are written. ADR 0001 has a
recommendation, and ADR 0002 sets out the choice.

## Week 3: v0.1.0, editor shell with ribbon

> **Decision gate: where does LibreLeaf run?** Settle ADR 0002 this week.
> See the decision gate section below.

- [ ] **Ribbon.** Built from Radix Tabs and Toolbar with shadcn styling. Home
      and Insert tabs work; the others show as "coming soon". It collapses to
      one row, and Alt+/ searches all commands.
- [ ] **WYSIWYG page.** A Tiptap page on the canvas: headings, paragraphs,
      bold, italic and small caps, lists, footnotes.
- [ ] **Live word count** in the status bar, using `packages/texcount`.
- [ ] **Export .tex.** The LaTeX source is generated, shown in a read-only
      source view, and can be downloaded.
- [ ] **Local saving.** Projects are saved in the browser (IndexedDB), with
      export and import as .zip.

**Done when:** you can write a short paper with sections and footnotes, export
it, and it compiles in Overleaf or TeX Live without editing.

## Week 4: v0.2.0, maths, citations, figures

- [ ] **Equations.** Inline and displayed, using MathLive, with a LaTeX tooltip
      on every ribbon button.
- [ ] **Citations.** Import a .bib file, add a source by DOI or arXiv ID
      (Crossref and arXiv APIs), insert `\cite`, choose a bibliography style.
- [ ] **Figures and tables.** A figure wizard (image, caption, label,
      placement) and a table that you paste from a spreadsheet.
- [ ] **Cross-references.** Pick from a list. Labels are created automatically.
- [ ] **Import simple .tex.** Anything the editor doesn't understand opens as a
      raw-LaTeX block, so nothing is lost.

**Done when:** you can take the v0.0.1 example paper in, edit it and export it
again without losing anything.

## Week 5: v0.3.0, compile and preview (depends on hosting)

- [ ] **Compile.** Using whichever path ADR 0002 chose: a server, the desktop
      app, or the browser.
- [ ] **PDF preview.** PDF.js side by side with the page, recompiling when you
      pause typing.
- [ ] **Compile log.** Errors link to the right place in the document.
- [ ] **Security.** For a server compile: no network, no `\write18`, CPU,
      memory and time limits, and a test file that tries to break out.

**Done when:** the example paper compiles to PDF in under 10 s, and the
break-out test is blocked.

## Week 6: v0.4.0, guidance layer v1 and first deploy

- [ ] **Plain-language error help.** Explanations for the 20 most common TeX
      errors (SPEC 2.1), each with a one-click fix where possible.
- [ ] **Health checks** (SPEC 2.2): undefined references, figures never
      mentioned in the text, missing captions, citation keys with no entry.
- [ ] **Journal limits on the Review tab.** Check the paper against a
      journal's word limit (using the word counter).
- [ ] **First deploy** to the chosen environment, with a staging URL. Pages
      stays as the landing page and the word counter.

**Done when:** a first-time user can fix a compile error without reading the
log, and the app runs at its deployed URL.

---

## Decision gate: hosting (target: week 3)

| Option | Compiles where | Cost | Good | Hard |
|---|---|---|---|---|
| **A. Render** (web service + Docker compile worker + Postgres) | Server, full TeX Live | Paid instances once in use | Matches the final hosted plan, and it's easy to deploy | Need to confirm the compile sandbox works there; free instances spin down when idle |
| **B. Desktop first (Tauri + Tectonic)**, Pages for the website | The user's own computer | Free | Works offline with no server bills, matching DESIGN §4 Release 1 | Windows and Linux installers, code signing, no web editor yet |
| **C. All in the browser** (WASM TeX engine), Pages only | The user's browser | Free | Free and private, and it's static | WASM TeX engines are big, slower and missing some packages; experimental |
| **A + B** | Desktop locally, Render for the web version later | Mixed | Best long-term | Two compile paths to maintain |

**What changes:** only weeks 5–6. If the decision slips, start on week 6's
guidance items, which don't need compiling, and keep shipping static releases on
Pages.

## Not in this pipeline

Real-time collaboration, accounts and sharing, Git sync, the template gallery,
and the arXiv readiness checker. They come after v0.4.0, following
[SPEC.md](SPEC.md) phases 3–6.
