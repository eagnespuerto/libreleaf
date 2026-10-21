# LibreLeaf — Product & Build Spec (Draft v0.1)

> **LibreLeaf** — The LaTeX word processor for independent researchers.

*Drafted 2026-10-21. Status: **on hold**, author reconsidering scope. See [DESIGN.md](DESIGN.md) §4 for a smaller desktop-first, single-user path that defers multi-user collaboration.*

**Released so far:** v0.0.1 alpha (2026-10-21), a TeXCount-style word counter
(`packages/texcount`), published on GitHub Pages. It will become the editor's
word count (§2 parity table, Tools) and its journal word-limit check.

## 1. What LibreLeaf is

An open-source, community-supported alternative to Overleaf. It has the same core
features, but **WYSIWYG editing comes first** and LaTeX source is an optional mode
underneath it.

**Who it's for:** citizen scientists and independent researchers who don't have an
adviser, lab or department to teach them LaTeX, journal formatting or submission
conventions. The app has to do that teaching itself.

**Support model:** every feature is free and works when self-hosted. Nothing is
held back for a paid tier (Overleaf charges for track changes, full history, extra
collaborators and longer compiles). Donations, optional paid hosting and support
contracts pay for the project. The license is AGPL-3.0, the same as Overleaf
Community Edition, so hosted forks have to publish their source.

### Design principles
1. **No LaTeX knowledge needed to start.** A user can write, cite, insert figures
   and submit a paper without ever opening source mode.
2. **LaTeX is never hidden for good.** The source is always available, always
   valid, and never mangled by the visual editor (constructs it doesn't recognise
   are kept as-is).
3. **Explain, don't just report.** Errors, warnings and formatting problems come
   with plain-language explanations and a one-click fix where one is possible.
4. **Same features whether self-hosted or hosted.** The hosted instance runs
   exactly the code in the repo.
5. **Local-first where possible.** Editing works offline, and documents belong to
   the user (export everything, Git sync).

## 2. Feature parity checklist (vs. Overleaf)

| Area | Overleaf feature | LibreLeaf target | Phase |
|---|---|---|---|
| Editing | Source editor (syntax highlight, autocomplete) | ✅ secondary mode | 1 |
| Editing | Visual Editor | ✅ **primary mode**, goes further | 1 |
| Editing | Symbol palette, math input | ✅ visual math editor | 1 |
| Compile | pdfLaTeX / XeLaTeX / LuaLaTeX, latexmk | ✅ | 1 |
| Compile | PDF preview, SyncTeX jump to/from PDF | ✅ | 1 |
| Compile | Log viewer and error hints | ✅ plain-language explanations | 1–2 |
| Projects | Dashboard, file tree, uploads, folders, tags | ✅ | 1 |
| Projects | Templates gallery | ✅ curated and guided | 6 |
| Collab | Real-time multi-user editing | ✅ | 3 |
| Collab | Comments, track changes / review | ✅ free | 3 |
| Collab | Sharing by link / invite, roles | ✅ | 3 |
| History | Version history, labels, diff, restore | ✅ free and unlimited | 4 |
| Sync | Git access, GitHub sync | ✅ | 4 |
| Sync | Dropbox sync | ⏳ later (WebDAV or generic first) | 8 |
| References | BibTeX, Zotero / Mendeley import | ✅ plus DOI/arXiv lookup | 5 |
| Tools | Spell check, word count | ✅ plus grammar (opt-in, local) | 2 |
| Publishing | Submit to journals / arXiv | ✅ readiness checker | 6 |
| Admin | SSO, admin panel (Server Pro) | ✅ free | 7 |

## 3. Biggest technical decision (settle in Phase 0)

**What is the source of truth: the LaTeX text, or a structured document model?**

- **Option A: LaTeX text is canonical.** The visual mode draws on top of the source,
  the way Overleaf's Visual Editor does with CodeMirror 6 decorations.
  *Pros:* lossless, diffs cleanly in Git, collaboration is easy (one Y.Text).
  *Cons:* it never feels fully WYSIWYG, and complex tables and figures are hard to
  edit visually.
- **Option B: a structured document (ProseMirror/Tiptap) is canonical.** It's
  serialised to LaTeX, and anything it doesn't recognise is kept as "raw LaTeX
  islands".
  *Pros:* real WYSIWYG, with good tables, figures and math (MathLive).
  *Cons:* the round trip back to LaTeX is lossy, edits made in source mode have to
  be re-parsed, and Git diffs are noisier.
- **Option C: a hybrid.** The structured model is canonical for body content, and
  the preamble, macros and unrecognised environments stay as opaque, verbatim
  LaTeX blocks that are edited in source mode.

**Recommendation going in:** Option C. Build a prototype of C next to A (Phase 0,
step 0.2), then decide using two tests: round-trip fidelity on 50 real arXiv
sources, and editing usability with 3–5 target users.

Other early choices (defaults, open to change):
- **Frontend:** TypeScript, React, Tiptap/ProseMirror, CodeMirror 6 for source
  mode, MathLive for math, PDF.js for preview.
- **Real-time:** Yjs CRDT through a Hocuspocus server, using y-prosemirror and
  y-codemirror.
- **Backend:** Node (Fastify or Hono), Postgres, S3-compatible storage (MinIO when
  self-hosting), Redis and BullMQ for compile jobs.
- **Compile:** TeX Live in sandboxed containers (no network, CPU/memory/time caps,
  gVisor or similar). Optionally add a WASM TeX engine in the browser later for
  offline drafts.
- **Monorepo:** pnpm workspaces with `apps/web`, `apps/server`, `apps/compiler`,
  `packages/doc-model`, `packages/latex-bridge`, `packages/guidance`.

## 4. Build plan (multi-step, each step about one session)

Each step should be finished on its own branch with a PR. "Done" means it's
verified, not just written.

### Phase 0: Foundations
- **0.1 Repo and governance.** Create the GitHub repo and add the AGPL-3.0 license,
  README, CONTRIBUTING, CODE_OF_CONDUCT, the monorepo scaffold, CI (lint,
  typecheck, test) and a docker-compose dev setup.
  *Done:* `pnpm dev` starts empty web and server apps, and CI is green.
- **0.2 Editor-model spike (A vs. C).** Build a throwaway prototype of each option.
  Write a round-trip test harness that runs over a corpus of real `.tex` files.
  *Done:* a written decision record (`docs/adr/0001-doc-model.md`) with the
  fidelity numbers.
- **0.3 Name and trademark check.** Check "LibreLeaf" against existing projects (OpenLeaf was dropped: two projects already use it, one an editor with LaTeX support) and
  marks, and the domain and npm/GitHub org. *Done:* the name is confirmed or
  replaced.

### Phase 1: Single-user MVP
- **1.1 Projects and files.** Auth (email plus OAuth), project dashboard, file tree,
  uploads, storage. *Done:* create, upload and rename work and survive a restart.
- **1.2 Compile service.** Sandboxed TeX Live worker, job queue, latexmk, engine
  choice, timeouts, caching. *Done:* compiles a 20-page paper with figures and
  bib in under 10 s warm, and a malicious `\write18` or network attempt is
  blocked.
- **1.3 WYSIWYG editor v1.** Headings, paragraphs, lists, emphasis, inline and
  display math, figures with captions, simple tables, citations and cross-refs,
  raw-LaTeX blocks. *Done:* the corpus round-trip passes the agreed threshold.
- **1.4 Source mode and switching.** CodeMirror 6 with LaTeX highlighting and
  autocomplete. Switching modes keeps the cursor and selection.
- **1.5 PDF preview and SyncTeX.** Side-by-side preview, click to jump in both
  directions, auto-compile on pause.

### Phase 2: Guidance layer (the main difference from Overleaf)
- **2.1 Plain-language error explainer.** Map common TeX errors and warnings to
  short explanations, a link to the exact place, and a suggested fix. Start with
  the top 50 errors and grow from compile telemetry (opt-in).
- **2.2 Document health checks.** Undefined or unused refs and citations, figures
  with no caption or never referenced, inconsistent citation style, overfull
  boxes shown visually, missing alt text, heading-level jumps.
- **2.3 Insert wizards.** Figure, table (paste from a spreadsheet), equation,
  algorithm, appendix. Each shows the LaTeX it will produce, for anyone who wants
  to learn.
- **2.4 "What does this do?" hovers.** Explain packages and commands in the
  preamble and in raw blocks, from a curated knowledge base.
- **2.5 Writing aids (opt-in, privacy-first).** Spell and grammar checking
  (LanguageTool, self-hostable). Any AI assistance is optional, off by default,
  and works with a local or self-hosted model.

### Phase 3: Collaboration
- **3.1 Real-time editing.** Yjs and Hocuspocus, with presence and cursors in both
  modes, and offline edits that merge cleanly when the user reconnects.
- **3.2 Sharing and roles.** Owner, editor, reviewer, viewer. Link sharing and
  email invites.
- **3.3 Comments and track changes.** Anchored comment threads, suggestion mode,
  accept/reject. All free.

### Phase 4: History and sync
- **4.1 Version history.** Automatic snapshots, named versions, visual and source
  diffs, restore.
- **4.2 Git bridge.** Every project is a Git repo (clone and push over HTTPS with
  tokens), plus two-way GitHub sync.

### Phase 5: References
- **5.1 Bibliography manager.** A visual `.bib` editor, add by DOI, arXiv ID, ISBN
  or PubMed ID (Crossref and arXiv APIs), duplicate detection, citation style
  picker (biblatex and natbib presets).
- **5.2 Integrations.** Zotero (API and Better BibTeX), Mendeley and
  CSL-JSON import.

### Phase 6: Publishing
- **6.1 Guided templates.** A curated gallery (arXiv preprint, the main journal
  classes, thesis, report, poster, CV), each with a step-by-step "fill this in"
  walkthrough.
- **6.2 Submission readiness checker.** arXiv rules (no `.bib` without `.bbl`,
  file names, figure formats, size limits, `00README`), journal-specific
  checklists, a one-click "build the arXiv tarball".
- **6.3 Export.** PDF, source zip, DOCX/ODT and HTML through Pandoc, Markdown.

### Phase 7: Self-hosting and the support model
- **7.1 One-command self-host.** A docker-compose bundle and Helm chart, a backup
  and restore guide, an upgrade path.
- **7.1b Hosted instance on Render (being evaluated).**
  - Web app and API as a Render web service, with Render Postgres.
  - The compile worker as a separate Docker-based service or background worker.
  - Object storage stays S3-compatible.

  Until then, static alphas ship on GitHub Pages. Before committing to Render,
  confirm that it allows the compile sandbox: no network, and CPU, memory and
  time limits.
- **7.2 Admin.** Admin panel, SSO (OIDC/SAML), quotas, an instance-wide template
  library.
- **7.3 Sustainability.** Donation and sponsor pages (GitHub Sponsors, Open
  Collective), a public budget, optional paid hosting and support tiers, and a
  "no feature paywalls" pledge in the governance docs.

### Phase 8: Hardening and reach
- **8.1** Accessibility audit (WCAG 2.2 AA, screen-reader-friendly math via MathML).
- **8.2** Internationalisation (UI strings, right-to-left scripts, CJK through
  XeLaTeX/LuaLaTeX).
- **8.3** Security review of the compile sandbox and auth, plus load testing.
- **8.4** Overleaf project import (zip and Git), and Dropbox or WebDAV sync.

## 5. Success measures
- A first-time user with no LaTeX experience gets from a template to an
  arXiv-ready PDF in **under 60 minutes**, without opening source mode (tested in
  usability sessions).
- At least **95%** of corpus documents round-trip through WYSIWYG with no change
  to their source.
- Self-hosting goes from `docker compose up` to a working instance in under 15
  minutes.

## 6. Open questions
1. Doc-model choice (A or C). Phase 0.2 settles this.
2. Is a WASM TeX engine in the browser worth it for offline compiles, or is a
   server-only compile fine?
3. AI features: include them at all, and if so, how do we keep them local or
   self-hosted by default?
4. Who curates the error explanations and the template walkthroughs? Community
   wiki, or a maintained knowledge base?
5. Hosted-instance funding: what level of donations makes a free public instance
   sustainable?
