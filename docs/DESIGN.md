# LibreLeaf — Design Notes

> **LibreLeaf** — The LaTeX word processor for independent researchers.

*Drafted 2026-10-21. Companion to [SPEC.md](SPEC.md).*

## 0. Messaging

**Tagline:** The LaTeX word processor for independent researchers.

**Subline** (under the tagline on the website and in app stores):
Write papers the way you write a document. LibreLeaf turns them into clean
LaTeX and explains every step, so you don't need an adviser or a lab.

**Short pitch** (README opening, about 50 words):
LibreLeaf is a free, open-source LaTeX editor for citizen scientists and
independent researchers. You write in a familiar word-processor view, with a
ribbon for figures, equations and citations. LibreLeaf writes the LaTeX for you
and explains errors in plain language. It also checks your paper before you
submit it to arXiv or a journal.

**Three points for the website** (what you can do, not what it's built with):
1. **Write, don't code.** Headings, equations, figures and citations all come
   from the ribbon, and the LaTeX is always there if you want to look.
2. **Guidance built in.** Plain-language errors, document health checks and
   step-by-step templates stand in for the adviser you don't have.
3. **Free for good.** Every feature is free, it runs on your own computer, and
   it's paid for by donations, not paywalls.

**Wording notes:**
- Say "LaTeX word processor". Avoid "publishing" (it
  suggests a publisher or preprint server) and bare "processing" (it sounds
  like a compiler).
- Spell it "LaTeX" (capital T and X) everywhere.
- "Grassroots" is still fine in longer copy, for example "built by and for
  grassroots science".

## 1. Platforms

| Target | Approach |
|---|---|
| Web | React app (the main codebase) |
| Windows | Same app wrapped with **Tauri 2**: small installer, uses the system WebView2 |
| Linux | Tauri 2 (AppImage, .deb, Flatpak) |

- Every platform shares one UI codebase. Desktop-only features (local files, local
  compile) sit behind a small platform adapter.
- **Compiling on desktop:** use **Tectonic**, a self-contained TeX engine that
  downloads packages on demand. It's bundled with the app, so users don't have to
  install a ~5 GB TeX Live. If the user already has TeX Live or MiKTeX, the app
  can use that instead.
- **Desktop works without an account or server.** Projects are plain folders on
  disk, with optional Git sync. The web version is what needs hosting.

## 2. Visual direction: Google Docs feel plus a Word-style Ribbon

**From Google Docs:**
- A clean, paper-on-canvas page view: a centred page on a soft grey background,
  with true page breaks shown in WYSIWYG mode.
- A light, uncluttered top area: a document title you can click to edit, a
  "Saved" status, and a Share button (web only).
- Comments in the right margin, an outline panel on the left (from headings), and
  real-name cursors when collaborating.
- Gentle typography and lots of white space, without the IDE look of Overleaf.

**From Word, the Ribbon:**
- Tabbed command groups, each with a short label underneath. A first draft of
  the tabs:

  | Tab | Groups |
  |---|---|
  | **Home** | Clipboard · Font (bold, italic, small caps…) · Paragraph · Styles (Title, Section, Abstract…) |
  | **Insert** | Figure · Table · Equation · Citation · Cross-reference · Footnote · Code / Algorithm |
  | **References** | Add source (DOI, arXiv ID) · Bibliography style · Insert bibliography · Manage library |
  | **Layout** | Template / document class · Margins · Columns · Page size · Line spacing |
  | **Review** | Spelling · Health check (SPEC §2.2) · Comments · Track changes |
  | **Publish** | Compile · Readiness check (arXiv / journal) · Export (PDF, DOCX, HTML, arXiv tarball) |
  | **Source** | Toggle LaTeX source mode · Preamble · Packages · "What does this do?" |

- **Contextual tabs** appear when something is selected (Figure, Table, or
  Equation tools), as in Word.
- **Collapsible:** double-click a tab to collapse the ribbon into a
  Docs-style single row. This is the default for small screens.
- **Discoverable and teaching:** every button's tooltip names the action, gives
  its keyboard shortcut, and shows *the LaTeX it produces* (Principle 3 in SPEC).
- **Search the commands:** Alt+/ (like Docs' "Search the menus") so nobody has to
  know which tab a command is on.

Earlier examples to study: LibreOffice's "Tabbed" NotebookBar, OnlyOffice, and
WPS Office.
*To check:* Microsoft used to offer a separate Office UI licence for the ribbon.
Confirm that a generic tabbed toolbar doesn't raise any problems before a public
launch.

## 2a. Colour palette

**Base palette (chosen 2026-10-21):**

| Name | Hex | RGB |
|---|---|---|
| Walnut (brown) | `#432323` | rgb(67, 35, 35) |
| Deep teal | `#2F5755` | rgb(47, 87, 85) |
| Sage teal | `#5A9690` | rgb(90, 150, 144) |
| Mist (warm grey) | `#E0D9D9` | rgb(224, 217, 217) |

In light mode Walnut is the text and Mist is the background. Dark mode swaps
them. The teals are the accents in both modes.

**Contrast (WCAG 2.2, measured):**

| Pair | Ratio | Verdict |
|---|---|---|
| Walnut ↔ Mist | 10.04 | ✅ body text, both modes |
| Deep teal on Mist | 5.77 | ✅ text and links in light mode |
| Mist on Deep teal | 5.77 | ✅ text on primary buttons, both modes |
| Sage teal on Walnut | 4.12 | ⚠️ large text and icons only (fails 4.5 for body text) |
| Sage teal on Mist | 2.43 | ❌ decorative only (fills, hover tints), never text |
| Deep teal on Walnut | 1.74 | ❌ only as a surface colour, never text on Walnut |

That's why there's one extra shade, **Sage light `#7DB3AD`**. It gives 5.94 on
Walnut, so it's the text-safe accent for dark mode.

**Design tokens (Tailwind / shadcn CSS variables):**

| Token | Light | Dark |
|---|---|---|
| `--canvas` (behind the page) | `#E0D9D9` Mist | `#432323` Walnut |
| `--page` (paper) | `#F7F4F4` | `#F7F4F4` by default (true print preview); optional "dark paper" `#523030` |
| `--surface` (ribbon, panels) | `#EEE9E9` | `#523030` |
| `--text` | `#432323` | `#E0D9D9` |
| `--primary` (buttons, active tab) | `#2F5755` with Mist text | `#2F5755` with Mist text |
| `--accent` (links, focus ring, selection text) | `#2F5755` | `#7DB3AD` |
| `--accent-subtle` (hover, selection fill, ribbon group dividers) | `#5A9690` at 20–30% opacity | `#2F5755` |

Notes:
- The paper stays light in dark mode by default, so WYSIWYG still matches the
  PDF. Only the app chrome around it goes dark.
### Status colours (second palette, chosen 2026-10-21)

**Source palette:** `#BF092F` crimson · `#132440` navy · `#16476A` ocean blue ·
`#3B9797` teal. It has no amber, so warning uses an added colour.

Each status gets a **text/icon** shade for each mode, measured against the
canvas, the surface and the paper:

| Status | Light mode | Contrast (Mist / paper) | Dark mode | Contrast (Walnut / surface) |
|---|---|---|---|---|
| **Error** | `#BF092F` crimson | 4.58 / 5.83 ✅ | `#F08A9C` (lighter crimson) | 5.87 / 4.84 ✅ |
| **Success** | `#1F6363` (darker `#3B9797`) | 4.99 / 6.35 ✅ | `#5FBDBD` (lighter `#3B9797`) | 6.32 / 5.21 ✅ |
| **Info** | `#16476A` ocean blue | 7.04 / 8.96 ✅ | `#8DBBE0` (lighter ocean) | 6.86 / 5.66 ✅ |
| **Warning** *(added)* | `#844C00` amber-brown | 5.01 / 6.37 ✅ | `#E0A030` amber | 6.15 / 5.07 ✅ |

- **Fills and banners:** use the full-strength colour at 12–18% opacity as the
  background, with the text/icon shade on top. Solid crimson buttons (for
  example "Delete project") use white text (6.37 ✅).
- **Navy `#132440`:** the text colour inside light-mode info banners (11+
  against light tints), and the background for tooltips and the command palette
  in light mode. It's too close to Walnut (1.11) to show up in dark mode.
- **Why the shades change between modes:** `#3B9797` and `#BF092F` as they are
  fail on the grey canvas (2.49) and on the brown (2.19), so each mode uses a
  darker or lighter version of the same hue.
- **The success teal and the brand teal are almost the same colour** (`#3B9797`
  vs `#5A9690`, 1.02). Users must never have to tell success apart from a normal
  accent by colour alone. Success messages always carry a ✓ icon and a word
  ("Compiled", "Ready for arXiv"). Every status needs an icon and a label anyway,
  for colour-blind users.
- In the editor, compile errors use a crimson wavy underline, and health-check
  warnings use an amber dotted underline. They differ in shape as well as
  colour.

## 2b. Logo and type

- **Logo:** hand-drawn paper stack with a sage leaf. The approach is maximalist
  and illustrated, and it uses only the four brand colours. Files are in
  `brand/logo/`:
  - `libreleaf-logo-deepteal`: Deep teal wordmark. This is the default.
  - `libreleaf-logo-sage`: Sage wordmark. For large sizes only, since Sage on
    light backgrounds is 2.4:1.
  - `libreleaf-logo-dark` (SVG and PNG): for Walnut backgrounds. The user's own
    version, with Mist line art, Walnut paper and Sage-light wordmark `#7DB3AD`.

  The PNGs are 2000×2000 with a transparent background.
- **Favicon:** one sheet of paper with the leaf, in `brand/favicon/`.
  - `favicon-light`: Mist paper, for light tab bars.
  - `favicon-dark`: Walnut paper with a Mist outline, for dark tab bars.

  Each comes as a cropped SVG, PNGs at 32, 180 and 512 px, and a .ico with 16,
  32 and 48 px. The user's originals are in `source/`. Use `<link rel="icon"
  media="(prefers-color-scheme: …)">` so the browser picks the right one.
- **Typefaces:**
  - **Red Hat Display:** wordmark and all interface text.
  - **Playfair Display:** tagline, headings, the editor's default document
    preview.
  - **Red Hat Mono:** code and source mode.
- **Preview page:** [`brand/palette.html`](brand/palette.html), published at
  https://claude.ai/artifact/3iZyCp8wxg4HxbkXZdzRqL

## 3. UI component stack (free, open source)

21st.dev's community registry is free and MIT-licensed. Its paid part is the
"Magic" AI generator. These are free alternatives at the same quality, all built
on shadcn/ui conventions, so their components work together:

| Library | Use it for | License |
|---|---|---|
| **shadcn/ui** (on Radix or Base UI) | Foundation: buttons, menus, dialogs, tabs, tooltips, popovers, command palette | MIT |
| **Origin UI** | Large catalogue of polished inputs, selects and toolbars | MIT (verify) |
| **ReUI** (KeenThemes) | Extra components and blocks, with both Radix and Base UI versions | MIT (verify) |
| **Kibo UI** | Complex pieces: tree view, Kanban, rich lists | MIT |
| **Magic UI** | Small touches of motion only (onboarding, empty states), used sparingly | MIT (free tier) |
| **Lucide** or **Fluent UI System Icons** | Icons. Fluent icons give a Word-like feel | ISC / MIT |

**The Ribbon itself:** I found no free, good-quality React ribbon component. The
plan is to build it from Radix primitives (`Tabs`, `Toolbar`, `DropdownMenu`,
`Tooltip`, `ToggleGroup`), which take care of keyboard navigation and screen
readers. Microsoft's **Fluent UI React v9** (MIT) is worth reading for patterns,
spacing and accessibility, but I wouldn't use it as a second design system next
to shadcn.

**Editor surface:** Tiptap/ProseMirror for WYSIWYG, CodeMirror 6 for source mode,
MathLive for equations, PDF.js for the preview. The theme is set with Tailwind
CSS variables, which gives light and dark modes for free.

## 4. Scope note: multi-user collaboration is optional

Real-time collaboration (SPEC Phase 3) is the hardest part to *run*. Libraries
like Yjs and Hocuspocus handle most of the algorithm; the real work is hosting,
uptime, permissions and abuse. It is **not needed for a useful first release:**

1. **Release 1, desktop-first and single-user:** Tauri app, local folders,
   Tectonic compile, Git or file-sync (Dropbox, OneDrive and Syncthing just work
   on folders), plus the full guidance layer. No server needed.
2. **Release 2, a web version for a single user:** the same app in the browser,
   with a simple hosted compile.
3. **Release 3 and later, collaboration:** only once there are users and
   contributors to help run it. Until then, "collaboration" means sharing a Git
   repo or a synced folder.

The project is now a much smaller, solo-sized effort. The main thing that makes
it different from Overleaf, guided WYSIWYG for researchers without an adviser,
arrives in Release 1.
